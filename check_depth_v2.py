import yfinance as yf

tickers = ["AAPL", "MSFT", "GAW.L", "LVMUY", "IDXX"]
for ticker in tickers:
    print(f"--- {ticker} ---")
    tk = yf.Ticker(ticker)
    cf = tk.cashflow
    print(f"Years: {len(cf.columns)} | {list(cf.columns.year)}")
