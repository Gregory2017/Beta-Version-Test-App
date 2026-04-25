import * as ss from 'simple-statistics';

/**
 * Module B: Black-Scholes Option Pricing
 */
export function blackScholesCall(S: number, K: number, T: number, r: number, sigma: number): { price: number; d1: number; d2: number; Nd1: number; Nd2: number } {
  if (sigma <= 0 || T <= 0) return { price: NaN, d1: NaN, d2: NaN, Nd1: NaN, Nd2: NaN };

  const d1 = (Math.log(S / K) + (r + 0.5 * Math.pow(sigma, 2)) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const Nd1 = ss.cumulativeStdNormalProbability(d1);
  const Nd2 = ss.cumulativeStdNormalProbability(d2);

  const price = S * Nd1 - K * Math.exp(-r * T) * Nd2;
  return { price, d1, d2, Nd1, Nd2 };
}

export function blackScholesPut(S: number, K: number, T: number, r: number, d: number, sigma: number): { price: number; d1: number; d2: number; Nnegd1: number; Nnegd2: number } {
  if (sigma <= 0 || T <= 0) return { price: NaN, d1: NaN, d2: NaN, Nnegd1: NaN, Nnegd2: NaN };

  const d1 = (Math.log(S / K) + (r - d + 0.5 * Math.pow(sigma, 2)) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const Nnegd1 = ss.cumulativeStdNormalProbability(-d1);
  const Nnegd2 = ss.cumulativeStdNormalProbability(-d2);

  const price = K * Math.exp(-r * T) * Nnegd2 - S * Math.exp(-d * T) * Nnegd1;
  return { price, d1, d2, Nnegd1, Nnegd2 };
}

/**
 * Module D: MACD Calculation
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

  // Filter out NaNs for signal calculation but maintain index alignment
  // Signal is 9-day EMA of MACD
  const signal = calculateEMA_MACD(macd, 9);
  const histogram = macd.map((v, i) => {
    if (isNaN(v) || isNaN(signal[i])) return NaN;
    return v - signal[i];
  });

  return { macd, signal, histogram };
}

function calculateEMA(data: number[], period: number): number[] {
  const ema = new Array(data.length).fill(NaN);
  if (data.length < period) return ema;

  const k = 2 / (period + 1);
  
  // Seed with SMA
  const seed = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema[period - 1] = seed;

  for (let i = period; i < data.length; i++) {
    ema[i] = (data[i] - ema[i - 1]) * k + ema[i - 1];
  }
  return ema;
}

// Special EMA for MACD that needs to skip initial NaNs
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
 * Module E: RSI Calculation
 */
export function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi = new Array(prices.length).fill(NaN);
  if (prices.length <= period) return rsi;

  let avgGain = 0;
  let avgLoss = 0;

  // First RSI calculation: SMA of gains and losses
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

  // Subsequent RSI calculations: Smoothing (Wilder's)
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

/**
 * Module G: Markov Model Prediction
 */
export function calculateMarkovPrediction(prices: number[], ema50: number[], sma3y: number[]): { probU: number; probD: number; lastState: string } {
  const states: string[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (isNaN(ema50[i]) || isNaN(sma3y[i])) continue;
    states.push(ema50[i] > sma3y[i] ? 'U' : 'D');
  }

  if (states.length < 2) return { probU: 0.5, probD: 0.5, lastState: 'U' };

  const transitions: Record<string, Record<string, number>> = {
    U: { U: 0, D: 0 },
    D: { U: 0, D: 0 }
  };

  for (let i = 1; i < states.length; i++) {
    const from = states[i - 1];
    const to = states[i];
    transitions[from][to]++;
  }

  const lastState = states[states.length - 1];
  const totalFromLast = transitions[lastState].U + transitions[lastState].D;
  
  if (totalFromLast === 0) return { probU: 0.5, probD: 0.5, lastState };

  return {
    probU: transitions[lastState].U / totalFromLast,
    probD: transitions[lastState].D / totalFromLast,
    lastState
  };
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

    // Golden Cross: SMA50 crosses ABOVE SMA200
    if (sma50[i] > sma200[i] && sma50[i - 1] <= sma200[i - 1]) {
      golden[i] = true;
    }
    // Death Cross: SMA50 crosses BELOW SMA200
    if (sma50[i] < sma200[i] && sma50[i - 1] >= sma200[i - 1]) {
      death[i] = true;
    }
  }

  return { golden, death };
}
