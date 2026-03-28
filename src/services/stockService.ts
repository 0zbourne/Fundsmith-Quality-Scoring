import { GoogleGenAI, Type } from "@google/genai";

export interface StockMetrics {
  ticker: string;
  name: string;
  roce: number;
  grossMargin: number;
  operatingMargin: number;
  cashConversion: number;
  interestCover: number;
  score: number;
  description: string;
  source: string;
}

export const SP500_AVERAGES = {
  roce: 15,
  grossMargin: 40,
  operatingMargin: 15,
  cashConversion: 90,
  interestCover: 10,
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function fetchFromGemini(ticker: string): Promise<any> {
  console.log(`Using Gemini fallback for ${ticker}...`);
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Find the most recent annual financial metrics for the stock with ticker symbol: ${ticker}. 
    I need:
    1. Full Company Name
    2. ROCE (Return on Capital Employed) as a percentage
    3. Gross Margin as a percentage
    4. Operating Margin as a percentage
    5. Cash Conversion (Cash Flow from Operations / Net Income) as a percentage
    6. Interest Cover (EBIT / Interest Expense) as a ratio
    7. A very brief (1 sentence) description of the company's business.

    Use Google Search to find the most accurate and recent data.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          roce: { type: Type.NUMBER },
          grossMargin: { type: Type.NUMBER },
          operatingMargin: { type: Type.NUMBER },
          cashConversion: { type: Type.NUMBER },
          interestCover: { type: Type.NUMBER },
          description: { type: Type.STRING },
        },
        required: ["name", "roce", "grossMargin", "operatingMargin", "cashConversion", "interestCover", "description"],
      },
    },
  });

  const data = JSON.parse(response.text);
  return { ...data, source: "Gemini AI (Search)" };
}

export async function fetchStockData(ticker: string, apiKey?: string): Promise<StockMetrics> {
  let data: any;

  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['X-FMP-API-Key'] = apiKey;
    }

    const response = await fetch(`/api/stock/${ticker}`, { headers });
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
  if (data.roce > SP500_AVERAGES.roce) score++;
  if (data.grossMargin > SP500_AVERAGES.grossMargin) score++;
  if (data.operatingMargin > SP500_AVERAGES.operatingMargin) score++;
  if (data.cashConversion > SP500_AVERAGES.cashConversion) score++;
  if (data.interestCover > SP500_AVERAGES.interestCover) score++;

  return {
    ticker: ticker.toUpperCase(),
    ...data,
    score,
  };
}
