import google.generativeai as genai
import os
import json

# Replace with your API key
api_key = os.environ.get("GOOGLE_API_KEY")

if not api_key:
    print("GOOGLE_API_KEY not found in environment.")
else:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')

    prompt = """
    Search for and provide the annual Free Cash Flow (FCF) Yield for Apple Inc (AAPL) for each of the last 10 years (2015-2024).
    Format the response as a JSON array of objects with 'year' and 'fcfYield' (as a percentage number, e.g., 4.5).
    Include only the JSON.
    """

    try:
        response = model.generate_content(prompt)
        print("--- Gemini Response ---")
        print(response.text)
    except Exception as e:
        print(f"Error calling Gemini: {e}")
