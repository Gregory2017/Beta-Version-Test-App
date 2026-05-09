
import { mean, median, matrix, column } from 'mathjs';

/**
 * Hill Estimator Service
 * Calculates the Hill Alpha tail index for financial returns.
 */

export interface HillResult {
  alpha: number;
  ks: number[];
  alphas: number[];
  n: number;
}

/**
 * Calculates absolute returns from a price series.
 */
export function calculateReturns(prices: number[], log: boolean = false): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (log) {
      returns.push(Math.log(prices[i]) - Math.log(prices[i - 1]));
    } else {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns.filter(r => isFinite(r) && !isNaN(r));
}

/**
 * Micro Hill Estimator logic
 */
export function calculateMicroHill(returns: number[]): HillResult {
  // Absolute values sorted descending
  const X = returns.map(Math.abs).sort((a, b) => b - a);
  const n = X.length;

  if (n < 50) {
    return { alpha: 0, ks: [], alphas: [], n };
  }

  const k_min = 10;
  const k_max = Math.floor(0.1 * n);

  const ks: number[] = [];
  const alphas: number[] = [];

  for (let k = k_min; k < k_max; k++) {
    const X_limit = X[k]; // The (k+1)-th order statistic
    if (X_limit === 0) continue;

    let sumLog = 0;
    let validK = 0;
    for (let i = 0; i < k; i++) {
      const ratio = X[i] / X_limit;
      if (ratio > 1) {
        sumLog += Math.log(ratio);
        validK++;
      }
    }

    if (validK > 0) {
      const meanLog = sumLog / validK;
      if (meanLog > 0 && isFinite(meanLog)) {
        const alpha = 1 / meanLog;
        ks.push(k);
        alphas.push(alpha);
      }
    }
  }

  const medianAlpha = alphas.length > 0 ? (median(alphas) as number) : 0;

  return { alpha: medianAlpha, ks, alphas, n };
}

/**
 * Calculates a rolling Hill Alpha series
 */
export function calculateRollingHill(returns: number[], windowSize: number): { dateIndex: number, alpha: number }[] {
  const results: { dateIndex: number, alpha: number }[] = [];
  if (returns.length < windowSize) return results;

  // We slide a window of windowSize over the returns
  for (let i = 0; i <= returns.length - windowSize; i++) {
    const window = returns.slice(i, i + windowSize);
    const hillResult = calculateMicroHill(window);
    if (hillResult.alpha > 0) {
      results.push({ 
        dateIndex: i + windowSize - 1, 
        alpha: hillResult.alpha 
      });
    }
  }
  return results;
}

/**
 * Macro Hill Estimator logic
 */
export function calculateMacroHill(multiAssetReturns: number[][]): { alpha: number; observations: number; k: number } {
  if (multiAssetReturns.length === 0) return { alpha: 0, observations: 0, k: 0 };

  // Sync returns: all series must be the same length
  const minLen = Math.min(...multiAssetReturns.map(r => r.length));
  if (minLen < 100) return { alpha: 0, observations: 0, k: 0 };

  // Alignment: ensure each series is aligned to the same end date/length
  const alignedReturns = multiAssetReturns.map(r => r.slice(r.length - minLen));

  // Use mathjs for matrix mean across assets (column-wise mean if assets are columns)
  const mat = matrix(alignedReturns);
  const marketReturns: number[] = [];
  
  for (let i = 0; i < minLen; i++) {
    const col = column(mat, i).toArray() as number[][];
    const dayReturns = col.map(row => row[0]);
    marketReturns.push(mean(dayReturns) as number);
  }

  // absolute returns
  const absReturns = marketReturns.map(Math.abs).filter(r => isFinite(r) && r > 1e-12);
  const X = absReturns.sort((a, b) => b - a);
  const n = X.length;
  
  if (n < 20) return { alpha: 0, observations: n, k: 0 };

  const k = Math.max(Math.floor(Math.sqrt(n)), 20);
  if (k >= n) return { alpha: 0, observations: n, k };

  const X_tail = X.slice(0, k);
  const X_k = X[k];

  let sumLog = 0;
  let validCount = 0;
  for (const val of X_tail) {
    if (val / X_k > 1 + 1e-12) {
      sumLog += Math.log(val / X_k);
      validCount++;
    }
  }

  const alpha = validCount > 0 ? 1 / (sumLog / validCount) : 0;

  return { alpha, observations: n, k };
}
