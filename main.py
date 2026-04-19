import os
import json
import pandas as pd
import numpy as np
import yfinance as yf
from openbb import obb
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini if key is present
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

def research_historical_fcf(ticker: str):
    """Fallback to Gemini AI to find historical FCF data for years 6-10."""
    if not GOOGLE_API_KEY:
        return []
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""
        Search for and provide the annual Free Cash Flow (FCF) Yield for {ticker} for each of the missing 10 years (typically 2015-2020).
        Format the response ONLY as a JSON array of objects with 'year' (integer) and 'fcfYield' (float percentage, e.g. 4.5).
        Do not include any prose or markdown formatting outside of the JSON block.
        Example: [{"year": 2017, "fcfYield": 3.2}]
        """
        response = model.generate_content(prompt)
        text = response.text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        return json.loads(text)
    except Exception as e:
        print(f"Gemini Research Error: {e}")
        return []

@app.get("/api/stock/{ticker}")
def get_stock(ticker: str, aiFallback: bool = False):
    try:
        ticker = ticker.upper()
        ticker_obj = yf.Ticker(ticker)

        # 1. Fetch Profile Metadata via OpenBB (fast & reliable)
        p_data = {}
        try:
            profile_res = obb.equity.profile(ticker, provider="yfinance")
            if profile_res and profile_res.results:
                profile_list = profile_res.to_dict()
                if isinstance(profile_list, list) and len(profile_list) > 0:
                    p_data = profile_list[0]
        except Exception as e:
            print(f"OpenBB Profile fetch error: {e}")

        # 2. Get price/market data via fast_info (much faster than .info)
        try:
            fast_info = ticker_obj.fast_info
            info = ticker_obj.info if not fast_info else fast_info
        except:
            info = {}

        # 3. Resolve Company Name & Description
        final_name = p_data.get("name") or info.get("shortName") or info.get("longName") or ticker
        
        raw_desc = p_data.get("description") or info.get("longBusinessSummary") or "No description available."
        # Truncate to first 2 sentences for brevity as requested
        sentences = [s.strip() for s in raw_desc.split(". ") if s.strip()]
        final_description = ". ".join(sentences[:2])
        if final_description and not final_description.endswith("."):
            final_description += "."
        
        final_country = p_data.get("country") or info.get("country") or ""
        
        # Financial metrics extraction
        try:
            financials = ticker_obj.get_financials()
            balance_sheet = ticker_obj.get_balance_sheet()
            cashflow = ticker_obj.get_cashflow()
        except Exception as e:
            print(f"Error fetching financials for {ticker}: {e}")
            financials = pd.DataFrame()
            balance_sheet = pd.DataFrame()
            cashflow = pd.DataFrame()

        if financials.empty or balance_sheet.empty or cashflow.empty:
            raise HTTPException(status_code=404, detail="Could not retrieve full financial history for this ticker.")

        # Get TTM/Latest values (first column)
        try:
            inc = financials.iloc[:, 0]
            bs = balance_sheet.iloc[:, 0]
            cf = cashflow.iloc[:, 0]
        except:
            raise HTTPException(status_code=404, detail="Incomplete financial columns for this ticker.")

        def safe_get(series, keys):
            for k in keys:
                if k in series.index:
                    val = series.loc[k]
                    return val if val is not None and not pd.isna(val) else 0
            return 0

        # Calculate metrics using Traditional ROCE formula
        ebit = safe_get(inc, ["EBIT", "Operating Income", "OperatingIncome"])
        total_assets = safe_get(bs, ["Total Assets", "TotalAssets"])
        current_liab = safe_get(bs, ["Total Current Liabilities", "TotalCurrentLiabilities", "Current Liabilities"])
        cap_emp = total_assets - current_liab
        roce = (ebit / cap_emp * 100) if cap_emp > 0 else 0

        revenue = safe_get(inc, ["Total Revenue", "TotalRevenue", "Operating Revenue"])
        gross_profit = safe_get(inc, ["Gross Profit", "GrossProfit"])
        gross_margin = (gross_profit / revenue * 100) if revenue > 0 else 0
        op_margin = (ebit / revenue * 100) if revenue > 0 else 0

        ocf = safe_get(cf, ["Operating Cash Flow", "Total Cash From Operating Activities", "OperatingCashFlow"])
        net_income = safe_get(inc, ["Net Income", "NetIncome", "Net Income Common Stockholders"])
        cash_conv = (ocf / net_income * 100) if net_income > 0 else 0

        interest = safe_get(inc, ["Interest Expense", "InterestExpense", "Interest Expense Non Operating"])
        interest = abs(interest)
        interest_cover = (ebit / interest) if interest > 0 else 999.0 if ebit > 0 else 0

        cap_ex = safe_get(cf, ["Capital Expenditure", "Property Plant Equipment", "CapitalExpenditure"])
        fcf = ocf + cap_ex # capex is negative in yfinance usually

        market_cap = info.get("marketCap") or info.get("market_cap") or p_data.get("market_cap", 0)
        # If market cap is missing, try calculating it
        if not market_cap:
            price = info.get("currentPrice") or info.get("lastPrice") or info.get("regularMarketPrice", 0)
            shares = info.get("sharesOutstanding") or 0
            market_cap = price * shares

        fcf_yield = (fcf / market_cap * 100) if market_cap > 0 else 0

        # 1. API Historical FCF (Depth depends on provider, usually 4-5 years)
        fcf_history = []
        api_breakdown = []
        
        ocf_key = next((k for k in ["Operating Cash Flow", "OperatingCashFlow"] if k in cashflow.index), None)
        capex_key = next((k for k in ["Capital Expenditure", "CapitalExpenditure"] if k in cashflow.index), None)

        if ocf_key and capex_key:
            for col in cashflow.columns:
                try:
                    c_ocf = cashflow.loc[ocf_key, col]
                    c_capex = cashflow.loc[capex_key, col]
                    hist_fcf = (c_ocf if c_ocf is not None else 0) + (c_capex if c_capex is not None else 0)
                    hist_yield = (hist_fcf / market_cap * 100) if market_cap > 0 else 0
                    if not np.isnan(hist_yield) and not np.isinf(hist_yield) and hist_yield != 0:
                        fcf_history.append(hist_yield)
                        api_breakdown.append({
                            "year": int(col.year) if hasattr(col, 'year') else 0, 
                            "fcfYield": float(hist_yield), 
                            "source": "API"
                        })
                except Exception: continue

        # 2. AI Fallback Historical FCF (Years 6-10)
        ai_breakdown = []
        if aiFallback:
            ai_data = research_historical_fcf(ticker)
            for item in ai_data:
                if not any(b['year'] == item['year'] for b in api_breakdown):
                    fcf_history.append(item['fcfYield'])
                    ai_breakdown.append({**item, "source": "AI Research"})

        historical_fcf_yield = sum(fcf_history)/len(fcf_history) if fcf_history else 0

        # FCF Growth Rate (CAGR)
        fcf_growth = 0
        if len(fcf_history) > 1:
            full_history = sorted(api_breakdown + ai_breakdown, key=lambda x: x['year'], reverse=True)
            recent_yield = full_history[0]['fcfYield']
            oldest_yield = full_history[-1]['fcfYield']
            if oldest_yield > 0 and recent_yield > 0:
                years = len(full_history) - 1
                if years > 0:
                    fcf_growth = ((recent_yield / oldest_yield) ** (1/years) - 1) * 100

        score = 0
        score += 1 if roce > 15 else 0.5 if roce > 10 else 0
        score += 1 if gross_margin > 40 else 0.5 if gross_margin > 30 else 0
        score += 1 if op_margin > 20 else 0.5 if op_margin > 15 else 0
        score += 1 if cash_conv > 90 else 0.5 if cash_conv > 80 else 0
        score += 1 if interest_cover > 20 else 0.5 if interest_cover > 10 else 0

        data = {
            "ticker": ticker,
            "name": final_name,
            "country": final_country,
            "description": final_description,
            "price": info.get("currentPrice") or info.get("lastPrice") or 0,
            "changes": info.get("regularMarketChangePercent") or 0,
            "roce": roce,
            "grossMargin": gross_margin,
            "operatingMargin": op_margin,
            "cashConversion": cash_conv,
            "interestCover": interest_cover,
            "fcfYield": fcf_yield,
            "fcfGrowthRate": fcf_growth,
            "historicalFcfYield": historical_fcf_yield,
            "historicalBreakdown": sorted(api_breakdown + ai_breakdown, key=lambda x: x['year'], reverse=True),
            "isAiUsed": aiFallback and len(ai_breakdown) > 0,
            "source": "OpenBB / Yahoo Finance"
        }

        # Final sanitization for JSON compatibility
        for k, v in data.items():
            if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
                data[k] = 0

        return data

    except HTTPException: raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis Error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)
