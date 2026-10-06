// Wellbeing over the weeks, worked out on the phone from the parent's own private entries (nothing here is sent anywhere).
// It describes what was logged and, when scores stay low, gently suggests talking to someone. It never diagnoses.

export interface WellbeingEntry {
  kind: 'checkin' | 'epds';
  score: number | null;
  created_at: string;
}

export interface Week {
  start: Date;            // first moment of this 7-day window
  average: number | null; // mean mood (1-5) of the check-ins in it, null when there were none
  count: number;
}

const DAY = 86400000;
export const LOW_MOOD = 2.5;     // a weekly average at or below this is "low" (between Down and Okay)
export const EPDS_WORTH_A_CHAT = 10;

// The last `weeks` windows of 7 days ending now, oldest first. The last one is the most recent 7 days.
export function weeklyMood(entries: WellbeingEntry[], now: number, weeks = 8): Week[] {
  const out: Week[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const from = now - (i + 1) * 7 * DAY;
    const to = now - i * 7 * DAY;
    const scores = entries
      .filter(e => e.kind === 'checkin' && e.score != null)
      .filter(e => {
        const t = new Date(e.created_at).getTime();
        return t >= from && t < to + (i === 0 ? 1 : 0); // the newest window includes "right now"
      })
      .map(e => e.score as number);
    out.push({ start: new Date(from), count: scores.length, average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null });
  }
  return out;
}

export type Nudge = 'low-mood' | 'epds' | null;

// A gentle prompt when things have stayed low:
//  - 'low-mood': the last two weeks each had at least 2 check-ins and each averaged low
//  - 'epds': the last two screenings (within 10 weeks) were both in the range worth talking about
// One low week, or one low screening, is not enough: bad days happen.
export function nudgeFor(entries: WellbeingEntry[], now: number): Nudge {
  const w = weeklyMood(entries, now, 2);
  if (w.every(x => x.count >= 2 && x.average !== null && x.average <= LOW_MOOD)) return 'low-mood';
  const epds = entries
    .filter(e => e.kind === 'epds' && e.score != null && now - new Date(e.created_at).getTime() <= 70 * DAY)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (epds.length >= 2 && epds[0].score! >= EPDS_WORTH_A_CHAT && epds[1].score! >= EPDS_WORTH_A_CHAT) return 'epds';
  return null;
}
