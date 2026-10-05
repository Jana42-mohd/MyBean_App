import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.');
}

// Every request gets a deadline. Without one a dead connection can leave a screen spinning for minutes,
// and the offline queue could never tell "no signal" from "slow".
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const isUpload = String(input).includes('/storage/v1/');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), isUpload ? 60000 : 12000);
  const outer = init?.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient(url, key, {
  global: { fetch: fetchWithTimeout },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE: a returned link only works on the phone that asked for it, so a forged link cannot sign the user into someone else's account
    flowType: 'pkce',
  },
});
