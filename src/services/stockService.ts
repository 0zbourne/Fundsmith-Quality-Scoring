import { GoogleGenAI, Type } from "@google/genai";

export interface StockMetrics {
  ticker: string;
  name: string;
  country?: string;
  roce: number;
  averageRoce?: number;
  grossMargin: number;
  operatingMargin: number;
  cashConversion: number;
  interestCover: number;
  fcfYield: number;
  fcfGrowthRate: number;
  historicalFcfYield: number;
  score: number;
  description: string;
  source: string;
}

export const SP500_AVERAGES = {
  roce: 17,
  grossMargin: 45,
  operatingMargin: 18,
  cashConversion: 89,
  interestCover: 9,
};

export async function fetchSP500Benchmarks(): Promise<typeof SP500_AVERAGES> {
  // Hardcoded to Fundsmith Equity figures as requested
  return SP500_AVERAGES;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function fetchFromGemini(ticker: string): Promise<any> {
  console.log(`Using Gemini fallback for ${ticker}...`);
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are a professional equity researcher. Find the historical financial metrics for the stock: ${ticker}.
    
    CRITICAL: I need data covering the last 20 YEARS (from roughly 2006 to present) to understand performance across multiple market cycles (including the 2008 financial crisis).

    I need:
    1. Full Company Name and Headquarter Country.
    2. CURRENT annual ROCE (Return on Capital Employed) as a percentage.
    3. 20-YEAR AVERAGE ROCE (if not available, 10-year) as a percentage.
    4. Gross Margin and Operating Margin (Current).
    5. Cash Conversion Rate (Cash Flow from Operations / Net Income).
    6. Interest Cover ratio (EBIT / Interest Expense).
    7. Current Free Cash Flow (FCF) Yield.
    8. 20-YEAR FCF Growth Rate (CAGR).
    9. 20-YEAR Average FCF Yield (historical average).
    10. A very brief (1 sentence) description of the company state.

    Search sources like Yahoo Finance, Morningstar, Macrotrends (for 20-year trends), and official Investor Relations pages. If it is an international stock (e.g. .L, .PA, .DE), ensure you are looking at the correct exchange and local currency figures then convert to % as requested.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          country: { type: Type.STRING },
          roce: { type: Type.NUMBER, description: "Current ROCE %" },
          averageRoce: { type: Type.NUMBER, description: "20-year or 10-year average ROCE %" },
          grossMargin: { type: Type.NUMBER },
          operatingMargin: { type: Type.NUMBER },
          cashConversion: { type: Type.NUMBER },
          interestCover: { type: Type.NUMBER },
          fcfYield: { type: Type.NUMBER },
          fcfGrowthRate: { type: Type.NUMBER, description: "20-year FCF CAGR %" },
          historicalFcfYield: { type: Type.NUMBER, description: "20-year average FCF Yield %" },
          description: { type: Type.STRING },
        },
        required: ["name", "country", "roce", "grossMargin", "operatingMargin", "cashConversion", "interestCover", "fcfYield", "fcfGrowthRate", "historicalFcfYield", "description"],
      },
    },
  });

  const data = JSON.parse(response.text);
  return { ...data, source: "Gemini AI (Search)" };
}

export async function fetchStockData(ticker: string, apiKey?: string, benchmarks: typeof SP500_AVERAGES = SP500_AVERAGES): Promise<StockMetrics> {
  let data: any;

  try {
    const url = apiKey 
      ? `/api/stock/${ticker}?apiKey=${encodeURIComponent(apiKey.trim())}`
      : `/api/stock/${ticker}`;

    const response = await fetch(url);
    if (response.ok) {
      data = await response.json();
    } else {
      console.warn("FMP fetch failed, falling back to Gemini...");
      data = await fetchFromGemini(ticker);
    }
  } catch (error) {
    console.error("Error fetching from FMP, falling back to Gemini:", error);
    try {
      data = await fetchFromGemini(ticker);
    } catch (geminiError) {
      console.error("Gemini fallback also failed:", geminiError);
      throw new Error("Both FMP and Gemini fallback failed to retrieve data. Please check your connection.");
    }
  }

  // Calculate score
  let score = 0;
  if (data.roce > benchmarks.roce) score++;
  if (data.grossMargin > benchmarks.grossMargin) score++;
  if (data.operatingMargin > benchmarks.operatingMargin) score++;
  if (data.cashConversion > benchmarks.cashConversion) score++;
  if (data.interestCover > benchmarks.interestCover) score++;

  return {
    ticker: ticker.toUpperCase(),
    ...data,
    score,
  };
}
