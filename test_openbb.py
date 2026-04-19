from openbb import obb
import yfinance as yf

# check openbb
try:
    print("Testing OpenBB Profile")
    profile = obb.equity.profile("AAPL", provider="yfinance")
    print(profile.to_dict())
except Exception as e:
    import traceback
    traceback.print_exc()

# check yf financials
try:
    print("Testing yfinance Financials")
    tk = yf.Ticker("AAPL")
    cf = tk.cashflow.fillna(0)
    print("Columns:", len(cf.columns))
except Exception as e:
    import traceback
    traceback.print_exc()
