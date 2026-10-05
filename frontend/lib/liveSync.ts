import { AppState } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Live sync: one realtime connection per signed-in phone, scoped to the person's household.
// Screens do not talk to it directly; they use the hooks in hooks/use-live.ts.

export type LiveTable = 'logs' | 'babies' | 'profiles' | 'active_sleeps';
export interface LiveEvent {
  table: LiveTable | 'resync';
  type: 'INSERT' | 'UPDATE' | 'DELETE' | 'RESYNC';
  record?: any; // the new row (INSERT / UPDATE)
  old?: any; // the old row (DELETE)
}
export type LiveStatus = 'off' | 'connecting' | 'live' | 'offline';

const listeners = new Set<(e: LiveEvent) => void>();
const statusListeners = new Set<(s: LiveStatus) => void>();
let channel: RealtimeChannel | null = null;
let householdId: string | null = null;
let myId: string | null = null;
let status: LiveStatus = 'off';
let hasBeenLive = false;
let appStateSub: { remove: () => void } | null = null;

const setStatus = (s: LiveStatus) => {
  status = s;
  statusListeners.forEach(l => l(s));
};
const emit = (e: LiveEvent) => listeners.forEach(l => { try { l(e); } catch {} });

export const onLiveChange = (l: (e: LiveEvent) => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};
export const onLiveStatus = (l: (s: LiveStatus) => void) => {
  statusListeners.add(l);
  return () => { statusListeners.delete(l); };
};
// Lets other modules ask every screen to reload (e.g. after the offline queue was sent)
export const emitResync = () => emit({ table: 'resync', type: 'RESYNC' });
export const getLiveStatus = () => status;
export const getMyId = () => myId;

export async function stopLiveSync() {
  appStateSub?.remove();
  appStateSub = null;
  if (channel) {
    const c = channel;
    channel = null;
    await supabase.removeChannel(c).catch(() => {});
  }
  householdId = null;
  hasBeenLive = false;
  setStatus('off');
}

export async function startLiveSync() {
  await stopLiveSync();
  const { data: sess } = await supabase.auth.getSession(); // local read, no network
  if (!sess.session) return;
  myId = sess.session.user.id;
  setStatus('connecting');

  const { data: me } = await supabase.from('profiles').select('household_id').eq('id', myId).maybeSingle();
  if (!me?.household_id) {
    setStatus('offline');
    return;
  }
  const hh = (householdId = me.household_id as string);
  const mine = { schema: 'public', filter: `household_id=eq.${hh}` } as const;

  const make = (table: LiveTable) => (p: any) => emit({ table, type: p.eventType, record: p.new, old: p.old });
  // Deletes cannot be filtered by the server, so they arrive from every household. Rows that
  // carry a household_id (logs, babies, sleeps use replica identity FULL) are checked here.
  const makeDelete = (table: LiveTable) => (p: any) => {
    if (p.old?.household_id && p.old.household_id !== hh) return;
    emit({ table, type: 'DELETE', old: p.old });
  };

  channel = supabase
    .channel(`household-${hh}`)
    .on('postgres_changes', { event: '*', table: 'logs', ...mine }, make('logs'))
    .on('postgres_changes', { event: '*', table: 'babies', ...mine }, make('babies'))
    .on('postgres_changes', { event: '*', table: 'profiles', ...mine }, make('profiles'))
    .on('postgres_changes', { event: '*', table: 'active_sleeps', ...mine }, make('active_sleeps'))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'logs' }, makeDelete('logs'))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'babies' }, makeDelete('babies'))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'active_sleeps' }, makeDelete('active_sleeps'))
    .subscribe(s => {
      if (s === 'SUBSCRIBED') {
        setStatus('live');
        // after a reconnect we may have missed changes: tell screens to reload
        if (hasBeenLive) emit({ table: 'resync', type: 'RESYNC' });
        hasBeenLive = true;
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        setStatus('offline');
      }
    });

  // Phones pause connections in the background: reload (and reconnect if needed) when the app comes back
  appStateSub = AppState.addEventListener('change', state => {
    if (state !== 'active') return;
    if (status !== 'live') startLiveSync().catch(() => {});
    else emit({ table: 'resync', type: 'RESYNC' });
  });
}

// Call after joining/leaving a household: the filter must follow the new household
export const restartLiveSync = () => startLiveSync();
