import yfinance as yf
ticker = "AAPL"
tk = yf.Ticker(ticker)
inc = tk.financials
bs = tk.balance_sheet
cf = tk.cashflow

print(f"Income Statement columns: {inc.columns}")
print(f"Balance Sheet columns: {bs.columns}")
print(f"Cash Flow columns: {cf.columns}")

print("\nNumber of years available:")
print(f"Income: {len(inc.columns)}")
print(f"Balance Sheet: {len(bs.columns)}")
print(f"Cash Flow: {len(cf.columns)}")
