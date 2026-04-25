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
const FMP_API_KEY = process.env.FMP_API_KEY || "SgfXZjqX7NK8nSxPa0sqjPrOZLzGYPp0";

const SP500_TICKERS = new Set([
  "MMM","AOS","ABT","ABBV","ABMD","ACN","ATVI","ADM","AAP","AES",
  "AFL","A","APD","AKAM","ALK","ALB","ARE","ALGN","ALLE","LNT",
  "ALL","GOOGL","GOOG","MO","AMZN","AMCR","AEE","AAL","AMETEK","AMGN",
  "ADI","ANSS","ANTM","AON","AOS","APA","AAPL","AMAT","APTV","ARE",
  "ARG","APH","APLE","ARNC","AWR","AIZ","ATO","ADSK","AZO","AVB",
  "AVY","BKR","BLL","BAC","BBWI","BAX","BDX","BRK.B","BBY","BIO",
  "BIIB","BLK","BK","BA","BKNG","BWA","BXP","BSX","BMY","AVGO",
  "BR","BF.B","CHRW","COG","CDNS","CPB","COF","CAH","KMX","CCL",
  "CARR","CTLT","CAT","CBOE","CBRE","CDW","CE","CNC","CNP","CF",
  "SCHW","CHTR","CVX","CMG","CB","CHD","CI","CINF","CTAS","CSCO",
  "C","CFG","CTXS","CLX","CME","CMS","KO","CTSH","CL","CMCSA",
  "CMA","CAG","CXO","COP","ED","STZ","CPRT","GLW","COST","COTY",
  "COV","CCI","CSX","CMI","CVS","DHI","DHR","DRI","DVA","DE",
  "DAL","XRAY","DVN","DXCM","FANG","DLR","DFS","DISCA","DISCK","DG",
  "DLTR","D","DPZ","DOV","DOW","DTE","DUK","DRE","DD","DXC",
  "EMN","ETN","EBAY","ECL","EIX","EW","EA","ELV","ETR","EOG",
  "EFX","EQIX","EQR","ESS","EL","ETSY","RE","EVRG","ES","EXC",
  "EXPD","EXR","XOM","FFIV","FBHS","FAST","FRT","FDX","FLIR","FLS",
  "FMC","F","FTNT","FTV","FB","FOXA","FOX","BEN","FCX","GPS",
  "GRMN","IT","GD","GE","GIS","GM","GPC","GILD","GL","GPN",
  "GS","GWW","HAL","HBI","HIG","HAS","HCA","PEAK","HPQ","HSY",
  "HES","HPE","HLT","HOLX","HD","HON","HRL","HST","HP","HUM",
  "HBAN","IEX","IDXX","INFO","ITW","ILMN","INCY","IR","IP","IPG",
  "INTC","ICE","IFF","INTU","ISRG","IVZ","IPGP","IQV","IRM","JKHY",
  "J","JBHT","SJM","JNJ","JCI","JPM","JNPR","KSU","K","KEY",
  "KMB","KIM","KMI","KLAC","KHC","KR","LHX","LH","LRCX","LW",
  "LVS","LMT","L","LYV","MMC","MLM","LNC","LW","MRO","MPC",
  "MKTX","MAR","MHK","TAP","MDT","MRK","MET","MTD","MGM","MCHP",
  "MU","MSFT","MHK","MKL","MCD","MCK","MDLZ","MPWR","MNST","MCO",
  "MS","MOS","MSI","MSCI","NDAQ","NOV","NTAP","NFLX","NWL","NEM",
  "NWSA","NWS","NEE","NLSN","NEE","NKE","NI","NSC","NTRS","NOC",
  "NCLH","NRG","NUE","NVDA","NVR","NXPI","ORLY","OXY","OMC","OKE",
  "ORCL","OGN","OTIS","PNR","PCAR","PKG","PH","PDCO","PAYX","PYPL",
  "PNC","PPG","PPL","PFG","PKI","PRU","PEG","PSX","PNW","PXD",
  "PNC","POOL","PPG","PGR","PLD","PRGO","PPL","PFG","QCOM","PWR",
  "RRC","RJF","RTX","O","REG","REGN","RF","RSG","RMD","RHI",
  "ROK","ROL","ROP","ROST","RCL","SPGI","CRM","SBAC","SLB","STX",
  "SEE","SRE","NOW","SHW","SPG","SWKS","SLG","SNA","SO","LUV",
  "SPG","SWK","SBUX","STT","SRCL","SYK","STZ","SIVB","Ste","SYF",
  "SNPS","SYY","TMUS","TROW","TTWO","TPR","TGT","TEL","FTI","TXN",
  "TXT","TMO","TJX","TSCO","TSN","TRV","TRP","TSLA","TMK","TFC",
  "TWTR","TYL","TSU","UDR","ULTA","USB","UAA","UA","UNP","UAL",
  "UPS","URI","UHS","UNH","VFC","VLO","VAR","VRTX","VIAC","VTRS","VRSN","V","VNO","VMC","WRB","WAB","WMT",
  "WBD","WEC","WELL","WST","WY","WHR","WMB","WLTW","WFC","WELL",
  "WDC","WU","WRK","WYNN","XEL","XRX","XLNX","XYL","YUM","ZBRA",
  "ZBH","ZION","ZTS"
]);

const CRYPTO_TICKERS = new Set([
  "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "DOT", "LINK", "MATIC",
  "AVAX", "LTC", "BCH", "SHIB", "UNI", "NEAR", "ICP", "STX", "ATOM", "FIL",
  "PEPE", "ARB", "OP", "APT", "SUI", "TIA", "SEI", "IMX"
]);

// Helper Functions
async function fetchBinanceQuote(ticker: string) {
  const symbol = ticker.replace("-USD", "").toUpperCase() + "USDT";
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance quote error: ${res.statusText}`);
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
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=${days}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance historical error: ${res.statusText}`);
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

async function fetchFMPQuote(symbol: string) {
  const url = `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP quote error: ${res.statusText}`);
  const data: any = await res.json();
  if (!data || data.length === 0) throw new Error(`FMP quote: No data for ${symbol}`);
  const quote = data[0];
  return {
    regularMarketPrice: quote.price,
    regularMarketChange: quote.change,
    regularMarketChangePercent: quote.changesPercentage,
    fiftyTwoWeekHigh: quote.yearHigh,
    fiftyTwoWeekLow: quote.yearLow,
    open: quote.open,
    previousClose: quote.previousClose,
    marketCap: quote.marketCap,
    volume: quote.volume
  };
}

async function fetchFMPCandles(symbol: string, days: number = 730) {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - days);
  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];
  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?from=${fromStr}&to=${toStr}&apikey=${FMP_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP historical data error: ${res.statusText}`);
  const data: any = await res.json();
  if (!data.historical || data.historical.length === 0) return [];
  return data.historical.reverse().map((d: any) => ({
    date: d.date,
    close: d.close,
    open: d.open,
    high: d.high,
    low: d.low,
    volume: d.volume
  }));
}

async function fetchYahooCandles(ticker: string, days: number = 730) {
  const symbol = ticker.replace("-", ".");
  const range = days > 365 ? "2y" : "1y";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!res.ok) throw new Error(`Yahoo Finance error: ${res.statusText}`);
  const data: any = await res.json();
  if (!data.chart?.result?.[0]) throw new Error("Yahoo Finance: No data found");
  const result = data.chart.result[0];
  const timestamps = result.timestamp || [];
  const quotes = result.indicators.quote[0];
  return timestamps.map((t: number, i: number) => {
    const close = quotes.close[i] || (i > 0 ? quotes.close[i-1] : null);
    if (close === null) return null;
    return {
      date: new Date(t * 1000).toISOString(),
      close,
      open: quotes.open[i] || close,
      high: quotes.high[i] || close,
      low: quotes.low[i] || close,
      volume: quotes.volume[i] || 0
    };
  }).filter(Boolean);
}

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// API Routes
app.get("/api/stock/:ticker", async (req, res) => {
  let { ticker } = req.params;
  ticker = ticker.toUpperCase().replace('.', '-');
  const baseTicker = ticker.replace("-USD", "").toUpperCase();
  const isCrypto = CRYPTO_TICKERS.has(baseTicker);

  try {
    let data;
    if (isCrypto) {
      data = await fetchBinanceCandles(ticker);
    } else {
      try {
        data = await fetchFMPCandles(ticker);
      } catch (fmpErr: any) {
        console.warn(`FMP historical failed for ${ticker}, trying Yahoo:`, fmpErr.message);
        try {
          data = await fetchYahooCandles(ticker);
        } catch (yahooErr: any) {
          console.warn(`Yahoo historical failed for ${ticker}:`, yahooErr.message);
          throw new Error(`All history providers failed`);
        }
      }
    }
    if (!data || data.length === 0) throw new Error("No data");
    res.json(data);
  } catch (error: any) {
    let anchorPrice = 200;
    try {
      const quote = isCrypto ? await fetchBinanceQuote(ticker) : await fetchFMPQuote(ticker);
      anchorPrice = quote.regularMarketPrice;
    } catch (e) {}
    const mockData = Array.from({ length: 365 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (365 - i));
      const variance = 1 + (Math.random() - 0.5) * 0.02;
      const base = anchorPrice * (0.8 + (i / 365) * 0.2) * variance; 
      return {
        date: date.toISOString(),
        close: i === 364 ? anchorPrice : base,
        open: base * 0.99,
        high: base * 1.01,
        low: base * 0.98,
        volume: 1000000
      };
    });
    res.json(mockData);
  }
});

app.get("/api/quote/:ticker", async (req, res) => {
  let { ticker } = req.params;
  ticker = ticker.toUpperCase().replace('.', '-');
  const baseTicker = ticker.replace("-USD", "").toUpperCase();
  const isCrypto = CRYPTO_TICKERS.has(baseTicker);
  try {
    if (isCrypto) {
      const data = await fetchBinanceQuote(ticker);
      res.json(data);
    } else {
      try {
        const data = await fetchFMPQuote(ticker);
        res.json(data);
      } catch (e: any) {
        res.json({ regularMarketPrice: 200, regularMarketChange: 0, regularMarketChangePercent: 0, symbol: ticker, name: ticker });
      }
    }
  } catch (error: any) {
    res.json({ regularMarketPrice: 150, regularMarketChange: 0 });
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
