import { toDate, formatDuration } from './time';

export interface InsightRow {
  type: string;
  logged_at: string;
  data: any;
  baby_id: string | null;
}

export interface DayBucket {
  key: string; // local date YYYY-MM-DD
  label: string; // short weekday
  date: Date; // local midnight
  sleepMin: number;
  feedings: number;
  wet: number;
  dirty: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// One bucket per local day, oldest first, ending with today
export function buildDays(rows: InsightRow[], days: number, now = new Date()): DayBucket[] {
  const today = startOfDay(now);
  const buckets: DayBucket[] = [];
  const byKey = new Map<string, DayBucket>();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const b: DayBucket = {
      key: dayKey(date),
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date,
      sleepMin: 0,
      feedings: 0,
      wet: 0,
      dirty: 0,
    };
    buckets.push(b);
    byKey.set(b.key, b);
  }

  for (const r of rows) {
    if (r.type === 'nap') {
      const start = toDate(r.data?.start);
      const end = toDate(r.data?.end);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) continue;
      // split a sleep that crosses midnight across the days it covers
      let cursor = start;
      while (cursor < end) {
        const nextMidnight = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
        const segEnd = end < nextMidnight ? end : nextMidnight;
        const b = byKey.get(dayKey(cursor));
        if (b) b.sleepMin += (segEnd.getTime() - cursor.getTime()) / 60000;
        cursor = segEnd;
      }
      continue;
    }
    const b = byKey.get(dayKey(toDate(r.logged_at)));
    if (!b) continue;
    if (r.type === 'feeding') b.feedings += 1;
    if (r.type === 'diaper') (r.data?.type === 'poop' ? (b.dirty += 1) : (b.wet += 1));
  }
  return buckets;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export interface Stats {
  avgSleepMin: number; // per day that has sleep logged
  longestSleepMin: number;
  avgFeedings: number; // per day that has feedings logged
  avgFeedGapHours: number; // between consecutive feedings
  lastFeedingAt: Date | null;
  avgDiapers: number;
  daysWithData: number;
}

export function computeStats(rows: InsightRow[], buckets: DayBucket[]): Stats {
  const sleepDays = buckets.filter(b => b.sleepMin > 0);
  const feedDays = buckets.filter(b => b.feedings > 0);
  const diaperDays = buckets.filter(b => b.wet + b.dirty > 0);

  let longest = 0;
  for (const r of rows) {
    if (r.type !== 'nap') continue;
    const m = (toDate(r.data?.end).getTime() - toDate(r.data?.start).getTime()) / 60000;
    if (m > longest) longest = m;
  }

  const feedTimes = rows
    .filter(r => r.type === 'feeding')
    .map(r => toDate(r.logged_at).getTime())
    .sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < feedTimes.length; i++) {
    const h = (feedTimes[i] - feedTimes[i - 1]) / 3600000;
    if (h < 12) gaps.push(h); // longer gaps are overnight/missed logs, not a feeding rhythm
  }

  return {
    avgSleepMin: avg(sleepDays.map(b => b.sleepMin)),
    longestSleepMin: longest,
    avgFeedings: avg(feedDays.map(b => b.feedings)),
    avgFeedGapHours: avg(gaps),
    lastFeedingAt: feedTimes.length ? new Date(feedTimes[feedTimes.length - 1]) : null,
    avgDiapers: avg(diaperDays.map(b => b.wet + b.dirty)),
    daysWithData: new Set([...sleepDays, ...feedDays, ...diaperDays].map(b => b.key)).size,
  };
}

// Plain-text summary a parent can send to a doctor
export function summaryText(babyName: string, days: number, buckets: DayBucket[], s: Stats): string {
  const lines = [
    `${babyName}: last ${days} days (My Bean)`,
    `Sleep: ${formatDuration(s.avgSleepMin)} per day on average, longest stretch ${formatDuration(s.longestSleepMin)}`,
    `Feedings: ${s.avgFeedings.toFixed(1)} per day${s.avgFeedGapHours ? `, about every ${s.avgFeedGapHours.toFixed(1)} hours` : ''}`,
    `Diapers: ${s.avgDiapers.toFixed(1)} per day`,
    '',
    'Day by day (sleep / feedings / wet / dirty):',
    ...buckets.map(b => `${b.key}: ${formatDuration(b.sleepMin)} / ${b.feedings} / ${b.wet} / ${b.dirty}`),
  ];
  return lines.join('\n');
}
