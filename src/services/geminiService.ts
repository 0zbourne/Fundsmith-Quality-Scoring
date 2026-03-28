import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

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
}

export const SP500_AVERAGES = {
  roce: 15,
  grossMargin: 40,
  operatingMargin: 15,
  cashConversion: 90,
  interestCover: 10,
};

export async function fetchStockData(ticker: string): Promise<StockMetrics> {
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
          roce: { type: Type.NUMBER, description: "ROCE as a percentage (e.g. 15.5)" },
          grossMargin: { type: Type.NUMBER, description: "Gross Margin as a percentage (e.g. 40.2)" },
          operatingMargin: { type: Type.NUMBER, description: "Operating Margin as a percentage (e.g. 15.1)" },
          cashConversion: { type: Type.NUMBER, description: "Cash Conversion as a percentage (e.g. 95.0)" },
          interestCover: { type: Type.NUMBER, description: "Interest Cover as a ratio (e.g. 12.5)" },
          description: { type: Type.STRING },
        },
        required: ["name", "roce", "grossMargin", "operatingMargin", "cashConversion", "interestCover", "description"],
      },
    },
  });

  const data = JSON.parse(response.text);

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
