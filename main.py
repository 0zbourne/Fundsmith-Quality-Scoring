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
        # Using Gemini 3 Flash as suggested
        model = genai.GenerativeModel('gemini-3-flash-preview')
        prompt = f"Provide a single, professional one-sentence description of {name} ({ticker}). Focus only on its core business."
        response = model.generate_content(prompt)
        text = response.text.strip()
        import re
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return (sentences[0] if sentences else text).strip()
    except Exception:
        return ""

def research_historical_fcf(ticker: str):
    """AI Research for years 6-10 using Gemini 3 Flash."""
    if not GOOGLE_API_KEY:
        return []
    try:
        model = genai.GenerativeModel('gemini-3-flash-preview')
        prompt = f"Find the actual annual Free Cash Flow (FCF) Yield for {ticker} for the years 2015, 2016, 2017, 2018, 2019, 2020. Format ONLY as a JSON list: [{{'year': 2017, 'fcfYield': 3.2}}]. If uncertain, provide your best professional estimate based on historical performance."
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
        
        if not name or not desc or len(desc) < 30:
            try:
                full_info = ticker_obj.info
                name = name or full_info.get("shortName") or full_info.get("longName") or ticker
                desc = desc or full_info.get("longBusinessSummary") or ""
            except: pass

        # Enforce ONE sentence limit strictly
        final_name = name or ticker
        if not desc or len(desc) < 20:
            final_description = get_ai_company_summary(ticker, final_name)
        else:
            import re
            # Split by sentence-ending punctuation followed by whitespace or end of string
            sentences = re.split(r'(?<=[.!?])\s+', desc.strip())
            final_description = sentences[0] if sentences else ""
            if final_description and not final_description.endswith((".", "!", "?")):
                final_description += "."

        final_country = ensure_str(p_data.get("country") or "")
        
        # Financial metrics
        try:
            financials = ticker_obj.get_financials()
            balance_sheet = ticker_obj.get_balance_sheet()
            cashflow = ticker_obj.get_cashflow()
            
            if financials.empty or balance_sheet.empty or cashflow.empty:
                raise Exception("Missing data")
        except Exception:
            raise HTTPException(status_code=404, detail="Incomplete financial history.")

        inc = financials.iloc[:, 0]
        bs = balance_sheet.iloc[:, 0]
        
        def safe_get(series, keys):
            # Normalize index to remove spaces for more robust matching
            normalized_series = series.copy()
            normalized_series.index = [str(k).replace(" ", "") for k in series.index]
            
            for k in keys:
                # Check both normalized and original versions
                k_norm = k.replace(" ", "")
                if k_norm in normalized_series.index:
                    val = normalized_series.loc[k_norm]
                    # Handle multiple matches (take latest)
                    if isinstance(val, pd.Series): val = val.iloc[0]
                    return val if val is not None and not pd.isna(val) else 0
                if k in series.index:
                    val = series.loc[k]
                    if isinstance(val, pd.Series): val = val.iloc[0]
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

        # UNIT-SAFE FCF Yield Logic
        # 1. Normalize Market Cap to Base Currency (GBP/USD)
        price = fast_info.get("lastPrice") or ticker_obj.info.get("currentPrice", 0)
        shares = fast_info.get("shares") or ticker_obj.info.get("sharesOutstanding", 0)
        
        # Robust currency detection
        currency = ensure_str(fast_info.get("currency") or ticker_obj.info.get("currency") or "").strip()
        if not currency and ticker.endswith(".L"): 
            currency = "GBp" # High-confidence fallback for London stocks
            
        normalized_price = price
        # If price is in Pence (GBp or GBX), convert to Pounds for MC/FCF consistency
        if currency.lower() in ["gbp", "gbx"] or (price > 1000 and ticker.endswith(".L")):
            normalized_price = price / 100.0
            
        market_cap_base = normalized_price * shares
        
        # 2. Extract FCF History
        api_breakdown = []
        fcf_history = []
        
        # Look for FCF with or without spaces, normalized
        fcf_series = pd.Series()
        for k in ["Free Cash Flow", "FreeCashFlow"]:
            if k in cashflow.index:
                fcf_series = cashflow.loc[k]
                if isinstance(fcf_series, pd.DataFrame): 
                    fcf_series = fcf_series.iloc[0] # Take first row if multiple
                break
        
        if not fcf_series.empty:
            for date, val in fcf_series.items():
                if not pd.isna(val) and val != 0:
                    y_yield = (float(val) / market_cap_base * 100) if market_cap_base > 0 else 0
                    if not np.isinf(y_yield) and not np.isnan(y_yield):
                        year = int(date.year) if hasattr(date, 'year') else int(str(date)[:4])
                        fcf_history.append(y_yield)
                        api_breakdown.append({"year": year, "fcfYield": float(y_yield), "source": "API"})
        
        fcf_ttm_yield = api_breakdown[0]["fcfYield"] if api_breakdown else 0
        
        # Interest Cover
        interest = abs(safe_get(inc, ["Interest Expense"]))
        interest_cover = (ebit / interest) if interest > 0 else (999.0 if ebit > 0 else 0)

        # Cash Conversion
        ocf = safe_get(cashflow.iloc[:,0], ["Operating Cash Flow"])
        net_income = safe_get(inc, ["Net Income"])
        cash_conv = (ocf / net_income * 100) if net_income > 0 else 0

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
            "price": normalized_price, "changes": (fast_info.get("yearChange", 0) or 0) * 100,
            "roce": roce, "grossMargin": gross_margin, "operatingMargin": op_margin,
            "cashConversion": cash_conv, "interestCover": interest_cover,
            "fcfYield": fcf_ttm_yield, "fcfGrowthRate": 0, "historicalFcfYield": historical_fcf_yield,
            "historicalBreakdown": sorted(api_breakdown + ai_breakdown, key=lambda x: x['year'], reverse=True),
            "isAiUsed": aiFallback and len(ai_breakdown) > 0,
            "source": f"Yahoo Finance ({currency.upper()})"
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)
