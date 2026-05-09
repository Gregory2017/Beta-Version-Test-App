/**
 * Module A: MACD Calculation
 */
export function calculateMACD(prices: number[]): { macd: number[]; signal: number[]; histogram: number[] } {
  if (prices.length < 26) {
    return { 
      macd: new Array(prices.length).fill(NaN), 
      signal: new Array(prices.length).fill(NaN), 
      histogram: new Array(prices.length).fill(NaN) 
    };
  }

  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  const macd = ema12.map((v, i) => {
    if (isNaN(v) || isNaN(ema26[i])) return NaN;
    return v - ema26[i];
  });

  const signal = calculateEMA_MACD(macd, 9);
  const histogram = macd.map((v, i) => {
    if (isNaN(v) || isNaN(signal[i])) return NaN;
    return v - signal[i];
  });

  return { macd, signal, histogram };
}

export function calculateEMA(data: number[], period: number): number[] {
  const ema = new Array(data.length).fill(NaN);
  if (data.length < period) return ema;

  const k = 2 / (period + 1);
  const seed = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema[period - 1] = seed;

  for (let i = period; i < data.length; i++) {
    ema[i] = (data[i] - ema[i - 1]) * k + ema[i - 1];
  }
  return ema;
}

function calculateEMA_MACD(data: number[], period: number): number[] {
  const ema = new Array(data.length).fill(NaN);
  const firstValidIndex = data.findIndex(v => !isNaN(v));
  if (firstValidIndex === -1 || (data.length - firstValidIndex) < period) return ema;

  const k = 2 / (period + 1);
  const startIndex = firstValidIndex + period - 1;
  
  const seed = data.slice(firstValidIndex, startIndex + 1).reduce((a, b) => a + b, 0) / period;
  ema[startIndex] = seed;

  for (let i = startIndex + 1; i < data.length; i++) {
    ema[i] = (data[i] - ema[i - 1]) * k + ema[i - 1];
  }
  return ema;
}

/**
 * Module B: RSI Calculation
 */
export function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi = new Array(prices.length).fill(NaN);
  if (prices.length <= period) return rsi;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }

  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) rsi[period] = 100;
  else {
    const rs = avgGain / avgLoss;
    rsi[period] = 100 - (100 / (1 + rs));
  }

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) rsi[i] = 100;
    else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }

  return rsi;
}

export function calculateSMA(data: number[], period: number): number[] {
  const sma = new Array(data.length).fill(NaN);
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma[i] = sum / period;
  }
  return sma;
}

export function detectCrosses(sma50: number[], sma200: number[]): { golden: boolean[]; death: boolean[] } {
  const golden = new Array(sma50.length).fill(false);
  const death = new Array(sma50.length).fill(false);

  for (let i = 1; i < sma50.length; i++) {
    if (isNaN(sma50[i]) || isNaN(sma200[i]) || isNaN(sma50[i-1]) || isNaN(sma200[i-1])) continue;

    if (sma50[i] > sma200[i] && sma50[i - 1] <= sma200[i - 1]) {
      golden[i] = true;
    }
    if (sma50[i] < sma200[i] && sma50[i - 1] >= sma200[i - 1]) {
      death[i] = true;
    }
  }

  return { golden, death };
}
