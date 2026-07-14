export function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

// simple moving average, window 3, edge-clamped (shrinks at the boundaries
// instead of padding) — used for the weekly-volume trend line
export function sma3(values: number[]): number[] {
  return values.map((_, i) => {
    const lo = Math.max(0, i - 1);
    const hi = Math.min(values.length - 1, i + 1);
    return mean(values.slice(lo, hi + 1));
  });
}

export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  const cov = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const sx = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0));
  const sy = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return sx > 0 && sy > 0 ? cov / (sx * sy) : 0;
}

export function linreg(xs: number[], ys: number[]): { m: number; b: number } {
  const mx = mean(xs);
  const my = mean(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const m = den > 0 ? num / den : 0;
  return { m, b: my - m * mx };
}

// sample standard deviation (ddof=1); 0 for n < 2
export function sampleStd(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const sumSq = values.reduce((s, v) => s + (v - m) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}
