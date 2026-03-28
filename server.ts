import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API Routes
app.get("/api/stock/:ticker", async (req, res) => {
  const { ticker } = req.params;
  const fmpKey = process.env.FMP_API_KEY;

  if (!fmpKey || fmpKey.trim() === "") {
    return res.status(404).json({ error: "FMP API key not configured" });
  }

  try {
    console.log(`Attempting FMP fetch for ${ticker}...`);
    const [profileRes, ratiosRes, metricsRes] = await Promise.all([
      fetch(`https://financialmodelingprep.com/api/v3/profile/${ticker}?apikey=${fmpKey}`),
      fetch(`https://financialmodelingprep.com/api/v3/ratios-ttm/${ticker}?apikey=${fmpKey}`),
      fetch(`https://financialmodelingprep.com/api/v3/key-metrics-ttm/${ticker}?apikey=${fmpKey}`)
    ]);

    const profile = await profileRes.json();
    const ratios = await ratiosRes.json();
    const metrics = await metricsRes.json();

    if (profile && profile.length > 0) {
      const p = profile[0];
      const r = ratios && ratios.length > 0 ? ratios[0] : {};
      const m = metrics && metrics.length > 0 ? metrics[0] : {};

      const stockData = {
        name: p.companyName,
        description: p.description,
        roce: r.returnOnCapitalEmployedTTM ? r.returnOnCapitalEmployedTTM * 100 : 0,
        grossMargin: r.grossProfitMarginTTM ? r.grossProfitMarginTTM * 100 : 0,
        operatingMargin: r.operatingProfitMarginTTM ? r.operatingProfitMarginTTM * 100 : 0,
        cashConversion: m.cashFlowToNetIncomeRatioTTM ? m.cashFlowToNetIncomeRatioTTM * 100 : 0,
        interestCover: r.interestCoverageTTM || 0,
        source: "Financial Modeling Prep"
      };
      console.log("FMP fetch successful");
      return res.json(stockData);
    } else {
      return res.status(404).json({ error: "Stock not found in FMP" });
    }
  } catch (error) {
    console.error("FMP fetch error:", error);
    res.status(500).json({ error: "Failed to fetch from FMP" });
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
