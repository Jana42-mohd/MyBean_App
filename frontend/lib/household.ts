import { supabase } from './supabase';

export interface Member {
  id: string;
  name: string;
}

export interface Household {
  id: string;
  invite_code: string;
  members: Member[];
}

export async function getHousehold(): Promise<Household | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data: me } = await supabase.from('profiles').select('household_id').eq('id', u.user.id).maybeSingle();
  if (!me?.household_id) return null;
  const [h, m] = await Promise.all([
    supabase.from('households').select('id,invite_code').eq('id', me.household_id).maybeSingle(),
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

// Survey (parent part). Babies are saved separately via lib/babies. Also updates the display name.
export async function saveSurvey(data: Record<string, any>) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not signed in');
  const r1 = await supabase.from('surveys').upsert({ user_id: u.user.id, data, updated_at: new Date().toISOString() });
  if (r1.error) throw r1.error;
  if (data.parentName) {
    const r2 = await supabase.from('profiles').update({ name: data.parentName }).eq('id', u.user.id);
    if (r2.error) throw r2.error;
  }
}

// My parent answers, or null if I haven't done the survey yet
export async function loadSurvey(): Promise<Record<string, any> | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.from('surveys').select('data').eq('user_id', u.user.id).maybeSingle();
  return (data?.data as any) ?? null;
}

// Onboarding is done once I've answered the survey and there is at least one baby in the household
export async function hasCompletedSurvey(): Promise<boolean> {
  const [survey, { count }] = await Promise.all([
    loadSurvey(),
    supabase.from('babies').select('id', { count: 'exact', head: true }),
  ]);
  return !!survey && (count ?? 0) > 0;
}
