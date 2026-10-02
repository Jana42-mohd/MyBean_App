// Time helpers. Logs store real instants (ISO strings with Z); screens show and edit LOCAL time.

// Older entries stored naps as "YYYY-MM-DD HH:MM" in UTC. Accept both forms.
export function toDate(v: string): Date {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v)) return new Date(v.replace(' ', 'T') + ':00Z');
  return new Date(v);
}

const pad = (n: number) => String(n).padStart(2, '0');

// "2025-03-14 08:30" in the phone's local time
export function toLocalInput(v: string | Date): string {
  const d = typeof v === 'string' ? toDate(v) : v;
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Typing digits only: "202503140830" -> "2025-03-14 08:30"
export function formatDateTimeInput(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 12);
  let out = d.slice(0, 4);
  if (d.length > 4) out += '-' + d.slice(4, 6);
  if (d.length > 6) out += '-' + d.slice(6, 8);
  if (d.length > 8) out += ' ' + d.slice(8, 10);
  if (d.length > 10) out += ':' + d.slice(10, 12);
  return out;
}

// Local "YYYY-MM-DD HH:MM" -> ISO instant, or null if it isn't a real date/time
export function localInputToIso(s: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const dt = new Date(y, mo - 1, d, h, mi);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d || dt.getHours() !== h || dt.getMinutes() !== mi) return null;
  return dt.toISOString();
}

export function formatShort(v: string): string {
  const d = toDate(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatDuration(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

// "just now", "25 min ago", "3 h ago", "2 days ago"
export function timeAgo(v: string | Date, now = new Date()): string {
  const d = typeof v === 'string' ? toDate(v) : v;
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ${mins % 60 ? `${mins % 60} min ` : ''}ago`;
  const days = Math.floor(h / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
