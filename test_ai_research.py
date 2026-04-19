import os
import google.generativeai as genai
from dotenv import load_dotenv
import json

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GOOGLE_API_KEY)

def test_research(ticker):
    print(f"Testing AI Research for {ticker}...")
    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = f"Provide annual FCF Yield for {ticker} for the years 2015-2020. Format ONLY as JSON array: [{{'year': 2017, 'fcfYield': 3.2}}]"
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        print(f"Raw Response: {text}")
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[2].split("```")[0].strip() if text.count("```") >= 4 else text.split("```")[1].split("```")[0].strip()
        data = json.loads(text)
        print(f"Parsed Data: {data}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_research("GAW.L")
    test_research("AAPL")
