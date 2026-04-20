


export interface StockMetrics {
  ticker: string;
  name: string;
  country?: string;
  website?: string;
  roce: number;
  averageRoce?: number;
  grossMargin: number;
  operatingMargin: number;
  cashConversion: number;
  interestCover: number;
  fcfYield: number;
  fcfGrowthRate: number;
  historicalFcfYield: number;
  historicalBreakdown?: Array<{
    year: number;
    fcfYield: number;
    fcfValue?: number;
    source: string;
  }>;
  isAiUsed?: boolean;
  volatileFcf?: boolean;
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

export async function fetchStockData(
  ticker: string, 
  apiKey?: string, 
  benchmarks: typeof SP500_AVERAGES = SP500_AVERAGES,
  aiFallback: boolean = false
): Promise<StockMetrics> {
  let data: any;
  try {
    const url = `/api/stock/${ticker}?aiFallback=${aiFallback}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.error || `Failed to fetch data for ${ticker}`);
    }
    data = await response.json();
  } catch (error: any) {
    console.error("Error fetching data:", error);
    throw new Error(error.message || `Could not fetch data for ${ticker}`);
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
