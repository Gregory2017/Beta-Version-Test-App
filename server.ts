import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = 3000;

// Keys setup
const CRYPTO_TICKERS = new Set([
  "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "DOT", "LINK", "MATIC",
  "AVAX", "LTC", "BCH", "SHIB", "UNI", "NEAR", "ICP", "STX", "ATOM", "FIL",
  "PEPE", "ARB", "OP", "APT", "SUI", "TIA", "SEI", "IMX"
]);

// Helper Functions
async function fetchWithFallback(endpoints: string[], options: any) {
  let lastError: any;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      const errorBody = await res.text().catch(() => "No body");
      console.warn(`Fetch to ${url} failed with status ${res.status}: ${errorBody}`);
      lastError = new Error(`Status ${res.status}: ${res.statusText}`);
    } catch (e) {
      console.warn(`Fetch to ${url} threw:`, e);
      lastError = e;
    }
  }
  throw lastError;
}

async function fetchBinanceQuote(ticker: string) {
  const symbol = ticker.replace("-USD", "").toUpperCase() + "USDT";
  const bases = ["https://api.binance.com", "https://api1.binance.com", "https://api2.binance.com", "https://api3.binance.com"];
  const urls = bases.map(b => `${b}/api/v3/ticker/24hr?symbol=${symbol}`);
  
  const res = await fetchWithFallback(urls, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  });
  
  const data: any = await res.json();
  return {
    regularMarketPrice: parseFloat(data.lastPrice),
    regularMarketChange: parseFloat(data.priceChange),
    regularMarketChangePercent: parseFloat(data.priceChangePercent),
    fiftyTwoWeekHigh: parseFloat(data.highPrice),
    fiftyTwoWeekLow: parseFloat(data.lowPrice),
    open: parseFloat(data.openPrice),
    previousClose: parseFloat(data.prevClosePrice),
    marketCap: 0,
    volume: parseFloat(data.volume)
  };
}

async function fetchBinanceCandles(ticker: string, days: number = 730) {
  const symbol = ticker.replace("-USD", "").toUpperCase() + "USDT";
  const bases = ["https://api.binance.com", "https://api1.binance.com", "https://api2.binance.com", "https://api3.binance.com"];
  const urls = bases.map(b => `${b}/api/v3/klines?symbol=${symbol}&interval=1d&limit=${days}`);

  const res = await fetchWithFallback(urls, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    }
  });

  const data: any = await res.json();
  return data.map((d: any) => ({
    date: new Date(d[0]).toISOString(),
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4]),
    volume: parseFloat(d[5])
  }));
}

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// API Routes
app.get("/api/crypto/:ticker", async (req, res) => {
  let { ticker } = req.params;
  ticker = ticker.toUpperCase().replace("-USD", "");

  try {
    const data = await fetchBinanceCandles(ticker);
    if (!data || data.length === 0) throw new Error("No data");
    res.json(data);
  } catch (error: any) {
    console.error(`Crypto history fetch failed for ${ticker}:`, error.message);
    res.status(500).json({ error: `Failed to fetch price data for ${ticker}: ${error.message}` });
  }
});

app.get("/api/quote/:ticker", async (req, res) => {
  let { ticker } = req.params;
  ticker = ticker.toUpperCase().replace("-USD", "");
  try {
    const data = await fetchBinanceQuote(ticker);
    res.json(data);
  } catch (error: any) {
    console.error(`Quote fetch failed for ${ticker}:`, error.message);
    res.status(500).json({ error: `Failed to fetch quote for ${ticker}: ${error.message}` });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", isVercel: !!process.env.VERCEL });
});

// Production Static Serving
if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(__dirname, "dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  } else {
    const altDist = path.join(process.cwd(), "dist");
    app.use(express.static(altDist));
    app.get("*", (req, res) => {
      res.sendFile(path.join(altDist, "index.html"));
    });
  }
} else {
  // Hot Module Replacement / Dev Server logic
  async function setupDev() {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      if (req.originalUrl.startsWith("/api")) return next();
      try {
        const template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        const transformed = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(transformed);
      } catch (e) { next(e); }
    });
  }
  setupDev();
}

// Port Listening
if (!process.env.VERCEL && !process.env.NETLIFY) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on ${PORT}`);
  });
}

export default app;
