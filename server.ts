import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

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
  
  console.log(`Fetching FMP: ${url.replace(fmpKey, "********")}`);
  
  try {
    const response = await fetch(url);
    
    // Check for 403 first as it often returns HTML
    if (response.status === 403) {
      throw new Error("FMP API Key is invalid, unauthorized, or your plan does not cover this endpoint (403).");
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error(`FMP non-JSON response (${response.status}):`, text.substring(0, 200));
      throw new Error(`FMP returned an unexpected response format (Status ${response.status}). This usually happens if the API key is rejected or the endpoint is restricted.`);
    }

    const data = await response.json();

    if (data && data["Error Message"]) {
      throw new Error(`FMP API Error: ${data["Error Message"]}`);
    }

    if (!response.ok) {
      throw new Error(`FMP API returned status ${response.status}: ${response.statusText}`);
    }

    return data;
  } catch (err: any) {
    console.error("fetchFMP error:", err.message);
    throw err;
  }
};

// API Routes
app.get("/api/debug/fmp", async (req, res) => {
  const customKey = req.headers["x-fmp-api-key"] as string;
  try {
    // Test with a basic profile call for AAPL
    const data = await fetchFMP("profile/AAPL", "", customKey);
    if (data && Array.isArray(data) && data.length > 0) {
      return res.json({ status: "ok", message: "Connection successful! Your API key is valid and working." });
    }
    return res.json({ status: "error", message: "Key is valid but returned no data. This is unusual for AAPL." });
  } catch (err: any) {
    console.error("Debug Error:", err.message);
    return res.json({ status: "error", message: err.message });
  }
});

app.get("/api/stock/:ticker", async (req, res) => {
  const { ticker } = req.params;
  const customKey = req.headers["x-fmp-api-key"] as string;

  try {
    console.log(`Processing request for ticker: "${ticker}"`);
    
    const getFullStockData = async (symbol: string) => {
      // Fetch core data in parallel
      const [profile, ratios, metrics] = await Promise.all([
        fetchFMP(`profile/${symbol}`, "", customKey),
        fetchFMP(`ratios-ttm/${symbol}`, "", customKey),
        fetchFMP(`key-metrics-ttm/${symbol}`, "", customKey)
      ]);

      return { profile, ratios, metrics };
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

    const { profile, ratios, metrics } = data;

    if (profile && Array.isArray(profile) && profile.length > 0) {
      const p = profile[0];
      const r = (Array.isArray(ratios) && ratios.length > 0) ? ratios[0] : {};
      const m = (Array.isArray(metrics) && metrics.length > 0) ? metrics[0] : {};

      const stockData = {
        ticker: p.symbol,
        name: p.companyName,
        description: p.description,
        price: p.price,
        changes: p.changes,
        image: p.image,
        roce: (r.returnOnCapitalEmployedTTM || 0) * 100,
        grossMargin: (r.grossProfitMarginTTM || 0) * 100,
        operatingMargin: (r.operatingProfitMarginTTM || 0) * 100,
        cashConversion: (m.cashFlowToNetIncomeRatioTTM || 0) * 100,
        interestCover: r.interestCoverageTTM || 0,
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
