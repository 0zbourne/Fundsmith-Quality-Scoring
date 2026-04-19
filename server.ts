import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";

console.log("SERVER: Initializing backend...");
dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Helper to fetch from FMP with consistent error handling and correct parameter syntax
const fetchFMP = async (endpoint: string, params: string = "", customKey?: string) => {
  // Use custom key from header if provided, otherwise fallback to env
  const fmpKey = (customKey || process.env.FMP_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  
  if (!fmpKey) {
    throw new Error("FMP_API_KEY is not configured. Please add it in the Settings menu.");
  }

  const hasQuery = endpoint.includes("?");
  const separator = hasQuery ? "&" : "?";
  
  let url = `https://financialmodelingprep.com/api/v3/${endpoint}`;
  if (params) {
    url += `${separator}${params}&apikey=${fmpKey}`;
  } else {
    url += `${separator}apikey=${fmpKey}`;
  }
  
  const obfuscatedKey = fmpKey.length > 8 
    ? `${fmpKey.substring(0, 4)}...${fmpKey.substring(fmpKey.length - 4)}`
    : "****";
  console.log(`Fetching FMP (${obfuscatedKey}): ${url.replace(fmpKey, "********")}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });
    
    // Check for 403/401 first
    if (response.status === 403 || response.status === 401) {
      const contentType = response.headers.get("content-type");
      let errorMessage = `FMP API returned ${response.status} Forbidden/Unauthorized.`;
      
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        if (errorData["Error Message"]) {
          const msg = errorData["Error Message"].toLowerCase();
          // If it's a legacy endpoint error, return null so we can fallback to AI
          if (msg.includes("legacy")) {
            console.warn(`FMP Legacy Endpoint detected for ${endpoint}. Returning null for fallback.`);
            return null;
          }
          errorMessage = `FMP API Error: ${errorData["Error Message"]}`;
        }
      } else {
        const text = await response.text();
        console.warn(`FMP ${response.status} non-JSON response:`, text.substring(0, 200));
      }
      
      const isInternational = endpoint.includes(".") || params.includes(".");
      console.warn(`${errorMessage} for endpoint: ${endpoint}. ${isInternational ? "Note: International stocks are not supported on the Free plan." : ""}`);
      
      // Throw a specific error for auth issues so the caller knows it's a key problem
      throw new Error(`API Key Error: ${errorMessage}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error(`FMP non-JSON response (${response.status}):`, text.substring(0, 200));
      throw new Error(`FMP returned an unexpected response format (Status ${response.status}).`);
    }

    const data = await response.json();

    if (data && data["Error Message"]) {
      const msg = data["Error Message"].toLowerCase();
      console.warn(`FMP API Error Message for ${endpoint}: ${data["Error Message"]}`);
      
      // If it's a legacy endpoint error, return null so we can fallback to AI in the main flow
      if (msg.includes("legacy")) {
        return null;
      }
      
      // For any other error message (invalid key, unauthorized, plan limits, etc.), throw it
      throw new Error(`API Key Error: ${data["Error Message"]}`);
    }

    if (!response.ok) {
      console.warn(`FMP API returned status ${response.status} for ${endpoint}`);
      throw new Error(`FMP API returned status ${response.status}`);
    }

    return data;
  } catch (err: any) {
    // Re-throw if it's an API Key Error or configuration issue
    if (err.message.includes("API Key Error") || err.message.includes("not configured")) {
      throw err;
    }
    console.error(`fetchFMP network/system error for ${endpoint}:`, err.message);
    // For other errors (network, etc.), throw a generic error instead of returning null
    // so we don't misinterpret it as a 403 key rejection
    throw new Error(`Network or System Error: ${err.message}`);
  }
};

// API Routes
app.get("/api/debug/fmp", async (req, res) => {
  console.log("DEBUG: Received request for /api/debug/fmp");
  const customKey = (req.query.apiKey as string) || (req.headers["x-fmp-api-key"] as string);
  
  if (!customKey) {
    return res.json({ status: "error", message: "No API key provided for testing." });
  }

  const tests = [
    { name: "Quote", endpoint: "quote/AAPL", params: "" },
    { name: "Profile", endpoint: "profile/AAPL", params: "" },
    { name: "Search", endpoint: "search", params: "query=AAPL&limit=1" },
    { name: "Quote Short", endpoint: "quote-short/AAPL", params: "" }
  ];

  const results: any[] = [];
  let successCount = 0;

  for (const test of tests) {
    try {
      const data = await fetchFMP(test.endpoint, test.params, customKey);
      const hasData = data && Array.isArray(data) && data.length > 0;
      if (hasData) successCount++;
      
      results.push({
        endpoint: test.name,
        status: hasData ? "ok" : (data === null ? "legacy/restricted" : "empty"),
        message: hasData ? "Data returned successfully." : (data === null ? "Legacy endpoint or restricted by plan." : "Endpoint returned no data.")
      });
    } catch (err: any) {
      results.push({
        endpoint: test.name,
        status: "error",
        message: err.message
      });
    }
  }

  if (successCount > 0) {
    const workingEndpoints = results.filter(r => r.status === "ok").map(r => r.endpoint).join(", ");
    return res.json({
      status: "ok",
      message: `Connection successful! Working endpoints: ${workingEndpoints}.`,
      details: results
    });
  }

  // If all failed, check if any were "legacy/restricted"
  const restricted = results.filter(r => r.status === "legacy/restricted");
  if (restricted.length > 0) {
    return res.json({
      status: "error",
      message: "Your API key is valid, but FMP is restricting access to these endpoints (Legacy/Plan restriction). The app will automatically use Gemini AI to fetch data for you.",
      details: results
    });
  }

  return res.json({
    status: "error",
    message: "Your API key is valid but all tested endpoints returned no data. This often happens with brand new keys (syncing) or regional restrictions. Try searching for a stock anyway; the app will use AI as a fallback.",
    details: results
  });
});

app.get("/api/stock/:ticker", async (req, res) => {
  const { ticker } = req.params;
  console.log(`DEBUG: Received request for /api/stock/${ticker}`);
  const customKey = (req.query.apiKey as string) || (req.headers["x-fmp-api-key"] as string);

  try {
    console.log(`Processing request for ticker: "${ticker}"`);
    
    const getFullStockData = async (symbol: string) => {
      // Fetch core data in parallel. Some may return null if on Free plan or Legacy restriction.
      // For new users (post Aug 31, 2025), many v3 endpoints are restricted.
      const [profile, ratios, metrics, growth, annualMetrics, quote, searchResults, quoteShort] = await Promise.all([
        fetchFMP(`profile/${symbol}`, "", customKey),
        fetchFMP(`ratios-ttm/${symbol}`, "", customKey),
        fetchFMP(`key-metrics-ttm/${symbol}`, "", customKey),
        fetchFMP(`financial-growth/${symbol}`, "limit=1", customKey),
        fetchFMP(`key-metrics/${symbol}`, "limit=10", customKey),
        fetchFMP(`quote/${symbol}`, "", customKey),
        fetchFMP("search", `query=${symbol}&limit=1`, customKey),
        fetchFMP(`quote-short/${symbol}`, "", customKey)
      ]);

      return { profile, ratios, metrics, growth, annualMetrics, quote, searchResults, quoteShort };
    };

    let data: any;
    try {
      data = await getFullStockData(ticker.toUpperCase());
    } catch (e: any) {
      // If direct ticker fails (common for international stocks), try search
      console.log(`Direct fetch for "${ticker}" failed. Trying search fallback...`);
      const searchResults = await fetchFMP("search", `query=${ticker}&limit=3`, customKey);
      
      if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
        const bestMatch = searchResults[0].symbol;
        console.log(`Found match via search: ${bestMatch}`);
        data = await getFullStockData(bestMatch);
      } else {
        throw e; // Re-throw original error if search finds nothing
      }
    }

    const { profile, ratios, metrics, growth, annualMetrics, quote, searchResults, quoteShort } = data;

    // Use whichever basic data endpoint worked
    const p = (profile && profile.length > 0) ? profile[0] : {};
    const q = (quote && quote.length > 0) ? quote[0] : {};
    const s = (searchResults && searchResults.length > 0) ? searchResults[0] : {};
    const qs = (quoteShort && quoteShort.length > 0) ? quoteShort[0] : {};

    // If we have a profile but no ratios/metrics (common on Free plan or Legacy restriction), 
    // we should consider this a partial failure and let the frontend fallback to Gemini
    const hasEssentialMetrics = (Array.isArray(ratios) && ratios.length > 0) || (Array.isArray(metrics) && metrics.length > 0);
    
    // Check if we have basic data (either profile, quote, search or quote-short)
    const hasBasicData = (profile && Array.isArray(profile) && profile.length > 0) || 
                         (quote && Array.isArray(quote) && quote.length > 0) ||
                         (searchResults && Array.isArray(searchResults) && searchResults.length > 0) ||
                         (quoteShort && Array.isArray(quoteShort) && quoteShort.length > 0);

    if (hasBasicData) {
      if (!hasEssentialMetrics) {
        console.log("Basic data found but essential metrics (ratios/metrics) are missing. Likely a Free plan or Legacy restriction.");
        throw new Error("FMP Free plan (or Legacy restriction) does not support the required technical metrics for this analysis. Falling back to AI search...");
      }

      const r = (Array.isArray(ratios) && ratios.length > 0) ? ratios[0] : {};
      const m = (Array.isArray(metrics) && metrics.length > 0) ? metrics[0] : {};
      const g = (Array.isArray(growth) && growth.length > 0) ? growth[0] : {};
      
      // Calculate historical FCF yield average
      let historicalFcfYield = 0;
      if (Array.isArray(annualMetrics) && annualMetrics.length > 0) {
        const yields = annualMetrics.map((am: any) => am.freeCashFlowYield || 0).filter((y: number) => y !== 0);
        if (yields.length > 0) {
          historicalFcfYield = (yields.reduce((a: number, b: number) => a + b, 0) / yields.length) * 100;
        }
      }

      const stockData = {
        ticker: p.symbol || q.symbol || qs.symbol || s.symbol || ticker.toUpperCase(),
        name: p.companyName || q.name || qs.name || s.name || ticker.toUpperCase(),
        country: p.country || s.country || "",
        description: p.description || `Financial data for ${p.symbol || q.symbol || qs.symbol || s.symbol}`,
        price: p.price || q.price || qs.price || 0,
        changes: p.changes || q.changes || qs.changes || 0,
        image: p.image || "",
        roce: (r.returnOnCapitalEmployedTTM || 0) * 100,
        grossMargin: (r.grossProfitMarginTTM || 0) * 100,
        operatingMargin: (r.operatingProfitMarginTTM || 0) * 100,
        cashConversion: (m.cashFlowToNetIncomeRatioTTM || 0) * 100,
        interestCover: r.interestCoverageTTM || 0,
        fcfYield: (m.freeCashFlowYieldTTM || 0) * 100,
        fcfGrowthRate: (g.tenYFreeCashFlowGrowthPerShare || g.fiveYFreeCashFlowGrowthPerShare || 0) * 100,
        historicalFcfYield: historicalFcfYield,
        source: "Financial Modeling Prep"
      };
      return res.json(stockData);
    } else {
      return res.status(404).json({ error: `No data found for "${ticker}".` });
    }
  } catch (error: any) {
    console.error("FMP processing error:", error.message);
    const isAuthError = error.message.includes("403") || error.message.includes("Key is invalid") || error.message.includes("unauthorized");
    res.status(isAuthError ? 403 : 500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
