import type { LogRow } from './logs';
import { toDate } from './time';

// "Right now" for each baby, worked out from the last week of entries: asleep or awake and for how long, when they last
// ate and had a diaper, how often they usually feed, and about when the next feeding might be.
// This is information from the parents' own logs, not advice: the app never says a baby *should* eat or sleep.

export interface BabyStatus {
  babyId: string;
  name: string;
  asleepSince: Date | null;
  awakeSince: Date | null;   // when the last logged nap ended (null when there is none to go by)
  lastFeeding: { at: Date; method?: string; amount?: string; by?: string } | null;
  lastDiaper: { at: Date; type?: string; by?: string } | null;
  feedGapMinutes: number | null;   // the usual time between feedings (middle value of recent gaps)
  nextFeedAt: Date | null;
}

export interface SleepRef {
  baby_id: string;
  started_at: string;
}

const MIN_GAP = 20;           // closer than this is one long feeding or a top-up, not a new gap
const MAX_GAP = 8 * 60;       // longer than this is a night or a missed log, not the usual pattern
const MIN_GAPS_NEEDED = 3;
const GAPS_USED = 10;

const valid = (d: Date) => !isNaN(d.getTime());
const timeOf = (r: LogRow) => toDate(r.data?.time ?? r.logged_at);

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Usual minutes between feedings, or null when there are not enough feedings to say
export function usualFeedGap(times: Date[]): number | null {
  const sorted = times.filter(valid).sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const m = (sorted[i].getTime() - sorted[i - 1].getTime()) / 60000;
    if (m >= MIN_GAP && m <= MAX_GAP) gaps.push(m);
  }
  const recent = gaps.slice(-GAPS_USED);
  return recent.length >= MIN_GAPS_NEEDED ? Math.round(median(recent)) : null;
}

export function computeStatus(baby: { id: string; name: string }, rows: LogRow[], sleeps: SleepRef[], now = new Date(), names: Record<string, string> = {}): BabyStatus {
  const mine = rows.filter(r => r.baby_id === baby.id);
  const sleep = sleeps.find(s => s.baby_id === baby.id);

  let awakeSince: Date | null = null;
  for (const r of mine) {
    if (r.type !== 'nap') continue;
    const end = toDate(r.data?.end ?? '');
    if (valid(end) && end <= now && (!awakeSince || end > awakeSince)) awakeSince = end;
  }

  const feedings = mine.filter(r => r.type === 'feeding' && valid(timeOf(r)) && timeOf(r) <= now).sort((a, b) => timeOf(b).getTime() - timeOf(a).getTime());
  const diapers = mine.filter(r => r.type === 'diaper' && valid(timeOf(r)) && timeOf(r) <= now).sort((a, b) => timeOf(b).getTime() - timeOf(a).getTime());
  const lf = feedings[0];
  const ld = diapers[0];

  const gap = usualFeedGap(feedings.map(timeOf));
  let nextFeedAt: Date | null = null;
  if (lf) {
    const planned = Number(lf.data?.nextInHours);   // "next feeding in (hours)" typed by the parent wins
    if (planned > 0 && planned <= 12) nextFeedAt = new Date(timeOf(lf).getTime() + planned * 3600_000);
    else if (gap) nextFeedAt = new Date(timeOf(lf).getTime() + gap * 60_000);
  }

  return {
    babyId: baby.id,
    name: baby.name,
    asleepSince: sleep ? new Date(sleep.started_at) : null,
    awakeSince: sleep ? null : awakeSince,
    lastFeeding: lf ? { at: timeOf(lf), method: lf.data?.method, amount: lf.data?.amount, by: lf.author } : null,
    lastDiaper: ld ? { at: timeOf(ld), type: ld.data?.type, by: ld.author } : null,
    feedGapMinutes: gap,
    nextFeedAt,
  };
}

export function computeStatuses(babies: { id: string; name: string }[], rows: LogRow[], sleeps: SleepRef[], now = new Date()): BabyStatus[] {
  return babies.map(b => computeStatus(b, rows, sleeps, now));
}

// "3 h", "1 h 30 min", "45 min"
export function gapText(minutes: number): string {
  const m = Math.round(minutes / 5) * 5; // 175 min reads better as "3 h"
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

// How a next-feeding estimate is shown: "around 4:30 pm", "any time now", or "a little past the usual time"
export function nextFeedText(next: Date, now = new Date()): string {
  const diff = (next.getTime() - now.getTime()) / 60000;
  if (diff > 10) return `around ${next.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (diff >= -30) return 'around now';
  return 'a little past the usual time';
}
