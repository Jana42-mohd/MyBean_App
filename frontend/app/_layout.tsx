import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { sessionFromUrl } from '@/lib/auth';
import { OfflineBanner } from '@/components/OfflineBanner';

export const unstable_settings = {
  anchor: '(tabs)',
};

const PUBLIC_SCREENS = ['index', 'login', 'signup'];

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Password-reset emails open the app with a recovery link: sign in from it, then show the new-password screen
  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url || !url.includes('reset-password')) return;
      try {
        if (await sessionFromUrl(url)) router.replace('/reset-password');
      } catch (e) {
        console.error('Reset link failed:', e);
      }
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  // Signed-out users can only see the welcome, login and signup screens.
  useEffect(() => {
    if (!ready) return;
    const segs = segments as string[];
    const leaf = segs[segs.length - 1] ?? 'index';
    const isPublic = segs.length === 0 || segs[0] === 'reset-password' || (segs[0] === '(tabs)' && PUBLIC_SCREENS.includes(leaf));
    if (!session && !isPublic) router.replace('/');
  }, [ready, session, segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="survey" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="moderation" options={{ headerShown: false }} />
      </Stack>
      <OfflineBanner />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
