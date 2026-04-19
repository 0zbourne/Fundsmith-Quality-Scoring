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

def ensure_str(val):
    if isinstance(val, (list, tuple, np.ndarray)):
        return str(val[0]) if len(val) > 0 else ""
    return str(val) if val is not None else ""

def get_ai_company_summary(ticker: str, name: str):
    """Fallback to Gemini AI only if traditional sources fail."""
    if not GOOGLE_API_KEY:
        return ""
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"Provide a very concise 2-sentence description of {name} ({ticker}). Focus only on core operations."
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception:
        return ""

def research_historical_fcf(ticker: str):
    """AI Research for years 6-10."""
    if not GOOGLE_API_KEY:
        return []
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""
        Provide annual FCF Yield for {ticker} for the years 2015-2020.
        Format ONLY as JSON array: [{"year": 2017, "fcfYield": 3.2}]
        """
        response = model.generate_content(prompt)
        text = response.text.strip()
        if "```json" in text: text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text: text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except Exception: return []

@app.get("/api/stock/{ticker}")
def get_stock(ticker: str, aiFallback: bool = False):
    try:
        ticker = ticker.upper()
        ticker_obj = yf.Ticker(ticker)

        # 1. Fetch Profile Metadata
        p_data = {}
        try:
            profile_res = obb.equity.profile(ticker, provider="yfinance")
            if profile_res:
                p_out = profile_res.to_dict()
                if isinstance(p_out, list) and len(p_out) > 0: p_data = p_out[0]
                elif isinstance(p_out, dict): p_data = p_out.get("results", [p_out])[0] if isinstance(p_out.get("results"), list) else p_out
        except Exception: pass

        # 2. Get price/market data via fast_info
        try:
            fast_info = ticker_obj.fast_info
        except:
            fast_info = {}

        # 3. Resolve Metadata: Yahoo/OpenBB FIRST
        name = ensure_str(p_data.get("name"))
        desc = ensure_str(p_data.get("description"))
        
        # If OpenBB is thin, try Yahoo's full info object
        if not name or not desc or len(desc) < 30:
            try:
                full_info = ticker_obj.info
                name = name or full_info.get("shortName") or full_info.get("longName") or ticker
                desc = desc or full_info.get("longBusinessSummary") or ""
            except: pass

        # ONLY if both are missing do we call AI
        final_name = name or ticker
        if not desc or len(desc) < 20:
            final_description = get_ai_company_summary(ticker, final_name)
        else:
            # Truncate to first 2 sentences
            sentences = [s.strip() for s in desc.split(". ") if s.strip()]
            final_description = ". ".join(sentences[:2])
            if final_description and not final_description.endswith("."):
                final_description += "."

        final_country = ensure_str(p_data.get("country") or "")
        
        # Financial metrics
        try:
            financials = ticker_obj.get_financials()
            balance_sheet = ticker_obj.get_balance_sheet()
            cashflow = ticker_obj.get_cashflow()
        except Exception:
            financials, balance_sheet, cashflow = pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

        if financials.empty or balance_sheet.empty or cashflow.empty:
            raise HTTPException(status_code=404, detail="Financial data footprint too small for this ticker.")

        inc = financials.iloc[:, 0]
        bs = balance_sheet.iloc[:, 0]
        cf = cashflow.iloc[:, 0]

        def safe_get(series, keys):
            for k in keys:
                if k in series.index:
                    val = series.loc[k]
                    return val if val is not None and not pd.isna(val) else 0
            return 0

        # Traditional ROCE
        ebit = safe_get(inc, ["EBIT", "Operating Income"])
        total_assets = safe_get(bs, ["Total Assets"])
        current_liab = safe_get(bs, ["Total Current Liabilities", "Current Liabilities"])
        roce = (ebit / (total_assets - current_liab) * 100) if (total_assets - current_liab) > 0 else 0

        revenue = safe_get(inc, ["Total Revenue"])
        gross_profit = safe_get(inc, ["Gross Profit"])
        gross_margin = (gross_profit / revenue * 100) if revenue > 0 else 0
        op_margin = (ebit / revenue * 100) if revenue > 0 else 0

        ocf = safe_get(cf, ["Operating Cash Flow"])
        net_income = safe_get(inc, ["Net Income"])
        cash_conv = (ocf / net_income * 100) if net_income > 0 else 0

        interest = abs(safe_get(inc, ["Interest Expense"]))
        interest_cover = (ebit / interest) if interest > 0 else (999.0 if ebit > 0 else 0)

        cap_ex = safe_get(cf, ["Capital Expenditure", "Property Plant Equipment"])
        fcf = ocf + cap_ex # cap_ex is negative

        market_cap = fast_info.get("marketCap") or 0
        if not market_cap:
            price = fast_info.get("lastPrice") or 0
            shares = fast_info.get("shares") or 0
            market_cap = price * shares

        fcf_yield = (fcf / market_cap * 100) if market_cap > 0 else 0

        # Historical Logic
        fcf_history, api_breakdown = [], []
        ocf_key = next((k for k in ["Operating Cash Flow"] if k in cashflow.index), None)
        capex_key = next((k for k in ["Capital Expenditure", "CapitalExpenditure"] if k in cashflow.index), None)

        if ocf_key and capex_key:
            for col in cashflow.columns:
                try:
                    hist_fcf = (cashflow.loc[ocf_key, col] or 0) + (cashflow.loc[capex_key, col] or 0)
                    yield_val = (hist_fcf / market_cap * 100) if market_cap > 0 else 0
                    if not np.isnan(yield_val) and yield_val != 0:
                        fcf_history.append(yield_val)
                        api_breakdown.append({"year": int(col.year), "fcfYield": float(yield_val), "source": "API"})
                except Exception: continue

        ai_breakdown = []
        if aiFallback:
            ai_data = research_historical_fcf(ticker)
            for item in ai_data:
                if not any(b['year'] == item['year'] for b in api_breakdown):
                    fcf_history.append(item['fcfYield'])
                    ai_breakdown.append({**item, "source": "AI Research"})

        historical_fcf_yield = sum(fcf_history)/len(fcf_history) if fcf_history else 0

        return {
            "ticker": ticker, "name": final_name, "country": final_country, "description": final_description,
            "price": fast_info.get("lastPrice") or 0, "changes": fast_info.get("yearChange", 0) * 100,
            "roce": roce, "grossMargin": gross_margin, "operatingMargin": op_margin,
            "cashConversion": cash_conv, "interestCover": interest_cover,
            "fcfYield": fcf_yield, "fcfGrowthRate": 0, "historicalFcfYield": historical_fcf_yield,
            "historicalBreakdown": sorted(api_breakdown + ai_breakdown, key=lambda x: x['year'], reverse=True),
            "isAiUsed": aiFallback and len(ai_breakdown) > 0,
            "source": "Yahoo Finance (Normalized)"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)
