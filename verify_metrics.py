import yfinance as yf
import pandas as pd
import numpy as np

def verify_stock(ticker):
    print(f"\n==========================================")
    print(f"VERIFICATION REPORT: {ticker}")
    print(f"==========================================\n")
    
    tk = yf.Ticker(ticker)
    info = tk.info
    inc = tk.financials.fillna(0)
    bs = tk.balance_sheet.fillna(0)
    cf = tk.cashflow.fillna(0)
    
    def safe_get(df, keys, period=0):
        for k in keys:
            if k in df.index:
                series = df.loc[k]
                if len(series) > period:
                    return series.iloc[period]
        return 0

    # 1. ROCE (Traditional ROCE)
    ebit = safe_get(inc, ["EBIT", "Operating Income"])
    total_assets = safe_get(bs, ["Total Assets"])
    current_liab = safe_get(bs, ["Total Current Liabilities", "Current Liabilities"])
    
    cap_emp = total_assets - current_liab
    roce = (ebit / cap_emp * 100) if cap_emp > 0 else 0
    
    print(f"--- TRADITIONAL ROCE CALCULATION ---")
    print(f"EBIT: {ebit:,.0f}")
    print(f"Total Assets: {total_assets:,.0f}")
    print(f"Current Liabilities: {current_liab:,.0f}")
    print(f"Capital Employed: {cap_emp:,.0f}")
    print(f"ROCE: {roce:.2f}%\n")

    # 2. MARGINS
    revenue = safe_get(inc, ["Total Revenue", "Operating Revenue"])
    gross_profit = safe_get(inc, ["Gross Profit"])
    gross_margin = (gross_profit / revenue * 100) if revenue > 0 else 0
    op_margin = (ebit / revenue * 100) if revenue > 0 else 0
    
    print(f"--- MARGINS ---")
    print(f"Revenue: {revenue:,.0f}")
    print(f"Gross Profit: {gross_profit:,.0f}")
    print(f"Gross Margin: {gross_margin:.2f}%")
    print(f"Operating Margin: {op_margin:.2f}%\n")

    # 3. CASH CONVERSION
    ocf = safe_get(cf, ["Operating Cash Flow", "Total Cash From Operating Activities"])
    net_income = safe_get(inc, ["Net Income", "Net Income Common Stockholders"])
    cash_conv = (ocf / net_income * 100) if net_income > 0 else 0
    
    print(f"--- CASH CONVERSION ---")
    print(f"OCF: {ocf:,.0f}")
    print(f"Net Income: {net_income:,.0f}")
    print(f"Cash Conversion: {cash_conv:.2f}%\n")

    # 4. FCF YIELD & HISTORICAL
    market_cap = info.get("marketCap", 0)
    cap_ex = safe_get(cf, ["Capital Expenditure", "Property Plant Equipment"])
    fcf = ocf + cap_ex # Capex is negative
    fcf_yield = (fcf / market_cap * 100) if market_cap > 0 else 0
    
    print(f"--- FCF YIELD ---")
    print(f"Market Cap: {market_cap:,.0f}")
    print(f"Current FCF (OCF {ocf:,.0f} + CapEx {cap_ex:,.0f}): {fcf:,.0f}")
    print(f"Current FCF Yield: {fcf_yield:.2f}%\n")

    # Historical (All available years in Cash Flow statement)
    print(f"--- HISTORICAL FCF YIELD (Last {len(cf.columns)} Years) ---")
    yields = []
    for i in range(len(cf.columns)):
        year = cf.columns[i].year
        h_ocf = safe_get(cf, ["Operating Cash Flow"], i)
        h_capex = safe_get(cf, ["Capital Expenditure"], i)
        h_fcf = h_ocf + h_capex
        h_yield = (h_fcf / market_cap * 100) if market_cap > 0 else 0
        yields.append(h_yield)
        print(f"Year {year}: OCF {h_ocf:,.0f} | CapEx {h_capex:,.0f} | FCF {h_fcf:,.0f} | Yield {h_yield:.2f}%")
    
    avg_yield = sum(yields) / len(yields) if yields else 0
    print(f"Historical Average FCF Yield: {avg_yield:.2f}%\n")

if __name__ == "__main__":
    import sys
    ticker = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    verify_stock(ticker)
