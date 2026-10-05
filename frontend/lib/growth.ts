import { GrowthMetric, Sex, WHO_LMS } from './whoGrowthData';

export type { GrowthMetric, Sex };
export type Units = 'metric' | 'imperial';

// Percentile maths follows the WHO LMS method: z = ((x / M)^L - 1) / (L * S)
const DAYS_PER_MONTH = 30.4375;
export const STANDARD_PERCENTILES = [
  { p: 3, z: -1.8808 },
  { p: 15, z: -1.0364 },
  { p: 50, z: 0 },
  { p: 85, z: 1.0364 },
  { p: 97, z: 1.8808 },
] as const;

export const sexFromGender = (gender?: string | null): Sex | null => (gender === 'boy' ? 'boys' : gender === 'girl' ? 'girls' : null);

const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

// Age in (fractional) months between two YYYY-MM-DD dates
export function ageMonths(birthDate: string, onDate: string): number {
  return (parseDay(onDate) - parseDay(birthDate)) / 86400000 / DAYS_PER_MONTH;
}

// LMS values for a (possibly fractional) age, interpolated between the whole months WHO publishes
export function lmsAt(metric: GrowthMetric, sex: Sex, months: number): [number, number, number] {
  const rows = WHO_LMS[metric][sex];
  const m = Math.min(Math.max(months, 0), rows.length - 1);
  const lo = Math.floor(m);
  const hi = Math.min(lo + 1, rows.length - 1);
  const f = m - lo;
  const a = rows[lo];
  const b = rows[hi];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function zScore(metric: GrowthMetric, sex: Sex, months: number, value: number): number {
  const [L, M, S] = lmsAt(metric, sex, months);
  return L !== 0 ? (Math.pow(value / M, L) - 1) / (L * S) : Math.log(value / M) / S;
}

export function valueAtZ(metric: GrowthMetric, sex: Sex, months: number, z: number): number {
  const [L, M, S] = lmsAt(metric, sex, months);
  return L !== 0 ? M * Math.pow(1 + L * S * z, 1 / L) : M * Math.exp(S * z);
}

// Standard normal CDF (Abramowitz & Stegun 7.1.26 error-function approximation, error < 1.5e-7)
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

// Percentile 0-100 (shown as e.g. "45th"), clamped so extreme values read as <1 or >99
export function percentile(metric: GrowthMetric, sex: Sex, months: number, value: number): number {
  const p = normalCdf(zScore(metric, sex, months, value)) * 100;
  return Math.min(Math.max(p, 0.1), 99.9);
}

export function ordinal(n: number): string {
  const r = Math.round(n);
  if (n < 1) return 'below the 1st';
  if (n > 99) return 'above the 99th';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = r % 100;
  return `${r}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// ---- units: values are always STORED in kg / cm ----
export const kgToLbOz = (kg: number) => {
  const totalOz = kg * 35.27396195;
  let lb = Math.floor(totalOz / 16);
  let oz = Math.round((totalOz - lb * 16) * 10) / 10;
  if (oz >= 16) { lb += 1; oz = 0; }
  return { lb, oz };
};
export const lbOzToKg = (lb: number, oz: number) => (lb * 16 + oz) / 35.27396195;
export const cmToIn = (cm: number) => cm / 2.54;
export const inToCm = (inches: number) => inches * 2.54;

export function formatWeight(kg: number, units: Units): string {
  if (units === 'metric') return `${(Math.round(kg * 100) / 100).toString()} kg`;
  const { lb, oz } = kgToLbOz(kg);
  return `${lb} lb ${oz} oz`;
}
export function formatLength(cm: number, units: Units): string {
  return units === 'metric' ? `${Math.round(cm * 10) / 10} cm` : `${Math.round(cmToIn(cm) * 10) / 10} in`;
}

// Sanity limits for what a person can type (stops a typo like 65 kg for a newborn)
export const LIMITS = {
  weightKg: [0.4, 30],
  lengthCm: [30, 130],
  headCm: [20, 60],
} as const;

export interface GrowthData {
  date: string; // YYYY-MM-DD
  weightKg?: number;
  lengthCm?: number;
  headCm?: number;
  notes?: string;
}

// "3 weeks old", "4 months old", "1 year 2 months old": how old a baby was on a date.
// Months are calendar months (14 March to 14 May is exactly 2 months), not days / 30.
export function ageAtLabel(birthDate: string, onDate: string): string {
  const days = Math.round((parseDay(onDate) - parseDay(birthDate)) / 86400000);
  if (days < 0) return 'before birth';
  if (days < 14) return days === 1 ? '1 day old' : `${days} days old`;
  if (days < 61) return `${Math.floor(days / 7)} weeks old`;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ny, nm, nd] = onDate.split('-').map(Number);
  const months = (ny - by) * 12 + (nm - bm) - (nd < bd ? 1 : 0);
  if (months < 24) return `${months} months old`;
  const y = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? `${y} year${y > 1 ? 's' : ''} ${rem} month${rem > 1 ? 's' : ''} old` : `${y} year${y > 1 ? 's' : ''} old`;
}
