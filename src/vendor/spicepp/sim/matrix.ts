import { Complex } from "./types";

/** Dense real linear solver: Ax = b, Gaussian elimination with partial pivoting. Mutates copies. Returns null if singular. */
export function solveReal(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (n === 0) return [];
  const M: number[][] = A.map((r) => r.slice());
  const x = b.slice();
  for (let k = 0; k < n; k++) {
    let p = k, max = Math.abs(M[k][k]);
    for (let i = k + 1; i < n; i++) { const v = Math.abs(M[i][k]); if (v > max) { max = v; p = i; } }
    if (!isFinite(max) || max < 1e-300) return null;
    if (p !== k) { const t = M[k]; M[k] = M[p]; M[p] = t; const tb = x[k]; x[k] = x[p]; x[p] = tb; }
    const piv = M[k][k];
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / piv;
      if (f === 0) continue;
      const Mi = M[i], Mk = M[k];
      for (let j = k; j < n; j++) Mi[j] -= f * Mk[j];
      x[i] -= f * x[k];
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    const d = M[i][i];
    if (Math.abs(d) < 1e-300) return null;
    x[i] = s / d;
  }
  for (const v of x) if (!isFinite(v)) return null;
  return x;
}

const cm = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cs = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const cd = (a: Complex, b: Complex): Complex => { const den = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / den, im: (a.im * b.re - a.re * b.im) / den }; };
const ca = (a: Complex): number => Math.hypot(a.re, a.im);

/** Dense complex linear solver. */
export function solveComplex(A: Complex[][], b: Complex[]): Complex[] | null {
  const n = b.length;
  if (n === 0) return [];
  const M: Complex[][] = A.map((r) => r.map((c) => ({ ...c })));
  const x: Complex[] = b.map((c) => ({ ...c }));
  for (let k = 0; k < n; k++) {
    let p = k, max = ca(M[k][k]);
    for (let i = k + 1; i < n; i++) { const v = ca(M[i][k]); if (v > max) { max = v; p = i; } }
    if (!isFinite(max) || max < 1e-300) return null;
    if (p !== k) { const t = M[k]; M[k] = M[p]; M[p] = t; const tb = x[k]; x[k] = x[p]; x[p] = tb; }
    const piv = M[k][k];
    for (let i = k + 1; i < n; i++) {
      const f = cd(M[i][k], piv);
      if (f.re === 0 && f.im === 0) continue;
      for (let j = k; j < n; j++) M[i][j] = cs(M[i][j], cm(f, M[k][j]));
      x[i] = cs(x[i], cm(f, x[k]));
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    let s: Complex = { ...x[i] };
    for (let j = i + 1; j < n; j++) s = cs(s, cm(M[i][j], x[j]));
    x[i] = cd(s, M[i][i]);
  }
  for (const v of x) if (!isFinite(v.re) || !isFinite(v.im)) return null;
  return x;
}

export const zeros2 = (n: number, m: number): number[][] => Array.from({ length: n }, () => new Array(m).fill(0));
export const czeros2 = (n: number, m: number): Complex[][] => Array.from({ length: n }, () => Array.from({ length: m }, () => ({ re: 0, im: 0 })));
