<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Investment Intelligence Terminal

A production-ready, quality-investing stock analysis terminal. Built for fundamental investors to rapidly evaluate companies against strict financial criteria (inspired by quality scoring frameworks like Fundsmith). The terminal pulls live financial data, aggregates 10-year trailing performance, and incorporates a cutting-edge Gemini AI research engine to extrapolate historical cash flows where traditional APIs fall short.

## 🚀 Features

*   **Quality Metrics Engine**: Calculates live Return on Capital Employed (ROCE), Gross/Operating Margins, Cash Conversion, and Interest Coverage.
*   **10-Year FCF Analytics**: Tracks historical Free Cash Flow yields and automatically computes a true 10-year Compounded Annual Growth Rate (CAGR).
*   **Volatility Detection**: Monitors the Coefficient of Variation in cash flows to warn against inconsistent financial patterns.
*   **Gemini AI Research Fallback**: Uses Google's `gemini-3-flash-preview` to extrapolate 5-10 year historical financial data if traditional APIs lack depth.
*   **Premium Visuals**: Built with React, Tailwind CSS, and Framer Motion for a sleek, responsive, and data-dense UI.

## 🛠️ Tech Stack

*   **Frontend**: React (Vite), Tailwind CSS, Lucide React, Framer Motion.
*   **Backend**: Python, FastAPI, Uvicorn, Pandas, `yfinance`.
*   **AI Engine**: `google-generativeai` (Gemini).

## ⚡ Getting Started

### Prerequisites
*   Node.js & npm
*   Python 3.10+
*   Google Gemini API Key

### 1. Backend Setup

```bash
# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create a .env file and add your Google API key for the AI Research
echo "GOOGLE_API_KEY=your_api_key_here" > .env

# Start the FastAPI server
uvicorn main:app --port 3000 --host 0.0.0.0 --reload
```

### 2. Frontend Setup

In a new terminal window:

```bash
# Install Node dependencies
npm install

# Start the Vite development frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## 🧠 Using the Terminal

1. Enter a stock ticker (e.g., `AAPL`, `MSFT`, or `GAW.L` for London Stock Exchange).
2. Toggle the **AI Research Data** switch if you want to perform a deep historical extrapolation using Gemini.
3. Review the **Quality Score** (from 0 to 5) benchmarking the company against long-term S&P 500 averages.
4. Analyze the **Valuation Verdict** to determine if the current FCF yield offers a premium or discount relative to the company's own history.

## 📄 License
MIT
