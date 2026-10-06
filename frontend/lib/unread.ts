import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';

// The number on the Community tab: messages waiting, connection requests and group invitations.
// There is no live channel for chats, so the number is refreshed every 30 seconds while the app is open, when the app
// comes back to the front, when a notification arrives and whenever a chat is read.
let total = 0;
const listeners = new Set<(n: number) => void>();
const set = (n: number) => {
  total = n;
  listeners.forEach(l => l(n));
};

export async function refreshUnread(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('unread_total');
    if (!error) set(Number(data) || 0);
  } catch {}
  return total;
}

export function clearUnread() {
  set(0);
}

// Tells the server how far a chat has been read (the time of the newest message shown), then updates the badge
export async function markChatRead(ref: string, upto: string) {
  try {
    const { error } = await supabase.rpc('mark_chat_read', { ref, upto });
    if (error) throw error;
  } catch {
    return; // not fatal: it will be marked next time
  }
  refreshUnread();
}

export function useUnreadTotal(): number {
  const [n, setN] = useState(total);
  useEffect(() => {
    listeners.add(setN);
    setN(total);
    refreshUnread();
    const timer = setInterval(() => { if (AppState.currentState === 'active') refreshUnread(); }, 30_000);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') refreshUnread(); });
    return () => {
      listeners.delete(setN);
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return n;
}
