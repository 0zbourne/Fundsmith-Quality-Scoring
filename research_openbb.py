from openbb import obb
import json

def test_provider(provider, ticker):
    print(f"--- Testing {provider} for {ticker} ---")
    try:
        # Check cash flow for historical depth
        res = obb.equity.fundamental.cash(ticker, provider=provider)
        d = res.to_dict()
        if isinstance(d, dict) and len(d) > 0:
            # Check the length of any list in the dict
            first_val = next(iter(d.values()))
            print(f"Years available: {len(first_val)}")
        else:
            print("No data or empty results.")
    except Exception as e:
        print(f"Error with {provider}: {str(e)}")

# Common free-ish providers in OpenBB (yfinance is the default free one)
for p in ["yfinance"]:
    test_provider(p, "AAPL")
