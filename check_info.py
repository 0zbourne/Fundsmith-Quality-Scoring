import yfinance as yf

tk = yf.Ticker("AAPL")
info = tk.info
for k, v in info.items():
    if "Yield" in k or "Average" in k or "Growth" in k:
        print(f"{k}: {v}")
