
export interface AssetData {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

export interface QuoteData {
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  open: number;
  previousClose: number;
  marketCap: number;
  volume: number;
  symbol: string;
}

const BINANCE_BASES = [
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com"
];

async function fetchWithFallback(path: string) {
  let lastError: any;
  for (const base of BINANCE_BASES) {
    try {
      const res = await fetch(`${base}${path}`);
      if (res.ok) return res;
      lastError = new Error(`Status ${res.status}: ${res.statusText}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

export async function fetchBinanceQuote(ticker: string): Promise<QuoteData> {
  const symbol = ticker.replace("-USD", "").toUpperCase() + "USDT";
  const res = await fetchWithFallback(`/api/v3/ticker/24hr?symbol=${symbol}`);
  const data = await res.json();
  
  return {
    regularMarketPrice: parseFloat(data.lastPrice),
    regularMarketChange: parseFloat(data.priceChange),
    regularMarketChangePercent: parseFloat(data.priceChangePercent),
    fiftyTwoWeekHigh: parseFloat(data.highPrice),
    fiftyTwoWeekLow: parseFloat(data.lowPrice),
    open: parseFloat(data.openPrice),
    previousClose: parseFloat(data.prevClosePrice),
    marketCap: 0, 
    volume: parseFloat(data.volume),
    symbol: ticker
  };
}

export async function fetchBinanceCandles(ticker: string, days: number = 730): Promise<AssetData[]> {
  const symbol = ticker.replace("-USD", "").toUpperCase() + "USDT";
  const res = await fetchWithFallback(`/api/v3/klines?symbol=${symbol}&interval=1d&limit=${days}`);
  const data = await res.json();
  
  return data.map((d: any) => ({
    date: new Date(d[0]).toISOString(),
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4]),
    volume: parseFloat(d[5]),
  }));
}
