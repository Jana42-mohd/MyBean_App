import * as Linking from 'expo-linking';
import { supabase } from './supabase';

// Reads the tokens Supabase puts in a returned link (password reset) (#access_token=...&refresh_token=... or ?code=...) and starts a session
export async function sessionFromUrl(url: string): Promise<boolean> {
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const params = new URLSearchParams(hash || query);

  const errorDesc = params.get('error_description');
  if (errorDesc) throw new Error(errorDesc.replace(/\+/g, ' '));

  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }
  // Raw tokens in a link are deliberately ignored: they could belong to someone else's account
  return false;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: Linking.createURL('reset-password'),
  });
  if (error) throw error;
}

export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// Same rules as the signup screen
export function passwordProblems(pwd: string): string[] {
  const errors: string[] = [];
  if (pwd.length < 8) errors.push('at least 8 characters');
  if (!/[A-Z]/.test(pwd)) errors.push('a capital letter');
  if (!/[0-9]/.test(pwd)) errors.push('a number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) errors.push('a special character');
  return errors;
}
