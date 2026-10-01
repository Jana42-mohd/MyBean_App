import { supabase } from './supabase';

export interface Member {
  id: string;
  name: string;
}

export interface Household {
  id: string;
  invite_code: string;
  baby: Record<string, any>;
  members: Member[];
}

// Fields of the survey that belong to the shared baby (the rest are per-parent)
export const BABY_FIELDS = ['babyName', 'babyGender', 'babyBirthDate', 'gestationalAge', 'feedingType', 'trackingPreferences'];

export async function getHousehold(): Promise<Household | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data: me } = await supabase.from('profiles').select('household_id').eq('id', u.user.id).maybeSingle();
  if (!me?.household_id) return null;
  const [h, m] = await Promise.all([
    supabase.from('households').select('id,invite_code,baby').eq('id', me.household_id).maybeSingle(),
    supabase.from('profiles').select('id,name').eq('household_id', me.household_id),
  ]);
  if (!h.data) return null;
  return { ...(h.data as any), members: (m.data ?? []) as Member[] };
}

export async function joinHousehold(code: string) {
  const { error } = await supabase.rpc('join_household', { code });
  if (error) throw error;
}

export async function leaveHousehold() {
  const { error } = await supabase.rpc('leave_household');
  if (error) throw error;
}

// Survey: parent fields -> surveys (private), baby fields -> household (shared). Also updates display name.
export async function saveSurvey(data: Record<string, any>) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not signed in');
  const baby: Record<string, any> = {};
  const parent: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) (BABY_FIELDS.includes(k) ? baby : parent)[k] = v;

  const hh = await getHousehold();
  if (!hh) throw new Error('No household found');

  const r1 = await supabase.from('surveys').upsert({ user_id: u.user.id, data: parent, updated_at: new Date().toISOString() });
  if (r1.error) throw r1.error;
  const r2 = await supabase.from('households').update({ baby }).eq('id', hh.id);
  if (r2.error) throw r2.error;
  if (parent.parentName) {
    const r3 = await supabase.from('profiles').update({ name: parent.parentName }).eq('id', u.user.id);
    if (r3.error) throw r3.error;
  }
}

// Combined survey (my parent answers + shared baby info), or null if I haven't done it yet
export async function loadSurvey(): Promise<Record<string, any> | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const [s, hh] = await Promise.all([
    supabase.from('surveys').select('data').eq('user_id', u.user.id).maybeSingle(),
    getHousehold(),
  ]);
  if (!s.data) return null;
  return { ...(s.data.data as any), ...(hh?.baby ?? {}) };
}
