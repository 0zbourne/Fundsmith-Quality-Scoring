from yahooquery import Ticker
import pandas as pd

ticker = "AAPL"
tk = Ticker(ticker)
cf = tk.cash_flow(frequency="annual")

print("--- YahooQuery Data ---")
if isinstance(cf, pd.DataFrame) and not cf.empty:
    print(f"Columns: {cf.columns}")
    print(f"Index Names: {cf.index.names}")
    # Inspect the index
    print(cf.index)
    # Most likely it's a MultiIndex (symbol, asOfDate)
    try:
        if 'asOfDate' in cf.index.names:
            dates = cf.index.get_level_values('asOfDate')
        else:
            # Fallback to just print the first row's index or search for date-like index
            dates = cf.index.get_level_values(1)
        print(f"Years available: {len(dates)}")
        print(dates)
    except Exception as e:
        print(f"Error accessing dates: {e}")
        print(cf.head())
else:
    print("No data found or returned as dict.")
    print(cf)
