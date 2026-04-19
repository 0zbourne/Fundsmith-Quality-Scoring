from openbb import obb
import yfinance as yf
res = obb.equity.profile("AAPL", provider="yfinance")
d = res.to_dict()
print(type(d))
print(d)
