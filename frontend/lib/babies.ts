import { supabase } from './supabase';

export interface Baby {
  id: string;
  name: string;
  gender: string | null;
  birth_date: string | null;
  gestational_age: string | null;
  feeding_type: string | null;
  status: 'born' | 'expected';
  due_date: string | null;
}

// A baby being edited in the survey/babies form (id is missing until first saved)
export interface BabyDraft {
  id?: string;
  name: string;
  gender: string;
  birthDate: string;
  gestationalAge: string;
  feedingType: string;
  status: 'born' | 'expected';
  dueDate: string;
}

export const emptyBaby = (copyFrom?: BabyDraft): BabyDraft => ({
  name: '',
  gender: '',
  // twins/triplets share a birth date and gestational age, so carry those over
  birthDate: copyFrom?.birthDate ?? '',
  gestationalAge: copyFrom?.gestationalAge ?? '',
  feedingType: copyFrom?.feedingType ?? '',
  status: copyFrom?.status ?? 'born',
  dueDate: copyFrom?.dueDate ?? '',
});

export async function fetchBabies(): Promise<Baby[]> {
  const { data, error } = await supabase.from('babies').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Baby[];
}

export const toDraft = (b: Baby): BabyDraft => ({
  id: b.id,
  name: b.name,
  gender: b.gender ?? '',
  birthDate: b.birth_date ?? '',
  gestationalAge: b.gestational_age ?? '',
  feedingType: b.feeding_type ?? '',
  status: b.status ?? 'born',
  dueDate: b.due_date ?? '',
});

export async function saveBabies(drafts: BabyDraft[]) {
  for (const d of drafts) {
    const expected = d.status === 'expected';
    const row = {
      name: d.name.trim() || 'Baby',
      status: d.status,
      gender: d.gender || null,
      birth_date: expected ? null : d.birthDate || null,
      due_date: expected ? d.dueDate || null : null,
      gestational_age: expected ? null : d.gestationalAge || null,
      feeding_type: expected ? null : d.feedingType || null,
    };
    const { error } = d.id
      ? await supabase.from('babies').update(row).eq('id', d.id)
      : await supabase.from('babies').insert(row); // household_id is filled in by the database
    if (error) throw error;
  }
}

// Deletes the baby AND all of their logs
export async function deleteBaby(id: string) {
  const { error } = await supabase.from('babies').delete().eq('id', id);
  if (error) throw error;
}

export function babyNames(babies: { name: string }[]): string {
  const n = babies.map(b => b.name);
  if (n.length <= 1) return n[0] ?? '';
  return n.slice(0, -1).join(', ') + ' & ' + n[n.length - 1];
}

export const bornBabies = (babies: Baby[]) => babies.filter(b => b.status !== 'expected');
export const expectedBabies = (babies: Baby[]) => babies.filter(b => b.status === 'expected');

// "2025-03-14" typed digit by digit: keeps only digits and inserts the dashes
export function formatDateInput(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length > 6) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
  if (d.length > 4) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return d;
}

// True only for real calendar dates in YYYY-MM-DD form (rejects 2025-02-30)
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export const todayStr = () => new Date().toISOString().slice(0, 10);

// Days from today until a YYYY-MM-DD date (negative if in the past)
export function daysUntil(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}
