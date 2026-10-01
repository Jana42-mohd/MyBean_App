import { supabase } from './supabase';

export interface Baby {
  id: string;
  name: string;
  gender: string | null;
  birth_date: string | null;
  gestational_age: string | null;
  feeding_type: string | null;
}

// A baby being edited in the survey/babies form (id is missing until first saved)
export interface BabyDraft {
  id?: string;
  name: string;
  gender: string;
  birthDate: string;
  gestationalAge: string;
  feedingType: string;
}

export const emptyBaby = (copyFrom?: BabyDraft): BabyDraft => ({
  name: '',
  gender: '',
  // twins/triplets share a birth date and gestational age, so carry those over
  birthDate: copyFrom?.birthDate ?? '',
  gestationalAge: copyFrom?.gestationalAge ?? '',
  feedingType: copyFrom?.feedingType ?? '',
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
});

export async function saveBabies(drafts: BabyDraft[]) {
  for (const d of drafts) {
    const row = {
      name: d.name.trim(),
      gender: d.gender || null,
      birth_date: d.birthDate || null,
      gestational_age: d.gestationalAge || null,
      feeding_type: d.feedingType || null,
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
