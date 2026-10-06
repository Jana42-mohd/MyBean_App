import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import type { Session } from '@supabase/supabase-js';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { sessionFromUrl } from '@/lib/auth';
import { OfflineBanner } from '@/components/OfflineBanner';
import { setupNotifications } from '@/lib/reminders';
import { syncPushToken } from '@/lib/push';
import { hasCompletedSurvey } from '@/lib/household';
import { startLiveSync, stopLiveSync } from '@/lib/liveSync';
import { initOutbox, onOutboxFailure } from '@/lib/outbox';
import { startOutboxTriggers } from '@/lib/outboxTriggers';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Keep the splash screen up until we know whether someone is signed in (no flash of the login screen)
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  const redirecting = useRef(false);
  // while a password-reset link is being handled, the guard must not send the (now signed-in) person to Home
  const holdRedirectUntil = useRef(0);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => {})
      .finally(() => {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Live sync runs while someone is signed in (and follows them into the background and back)
  useEffect(() => {
    if (!ready) return;
    if (session) startLiveSync().catch(() => {});
    else stopLiveSync().catch(() => {});
  }, [ready, session?.user.id]);

  // Offline queue: belongs to the signed-in person; sends when there is a connection
  useEffect(() => {
    if (!ready) return;
    const uid = session?.user.id ?? null;
    let stop: (() => void) | undefined;
    let cancelled = false;
    initOutbox(uid).then(() => {
      if (!cancelled && uid) stop = startOutboxTriggers();
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [ready, session?.user.id]);

  // This phone's address for partner notifications (only if already allowed; Settings asks)
  useEffect(() => {
    if (ready && session) syncPushToken();
  }, [ready, session?.user.id]);

  useEffect(() => onOutboxFailure(message => Alert.alert('Could not send an entry', message)), []);

  // Reminders: configure how they look, and open the right screen when one is tapped
  useEffect(() => {
    setupNotifications().catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(resp => {
      const data = resp.notification.request.content.data as Record<string, any> | undefined;
      if (data?.type === 'message' || data?.type === 'connection_accepted') {
        router.push(data.connection ? { pathname: '/chat', params: { id: String(data.connection) } } : '/connections');
      } else if (data?.type === 'group_message' && data.group) {
        router.push({ pathname: '/group', params: { id: String(data.group) } });
      } else if (data?.type === 'group_invite' || data?.type === 'connection_request') {
        router.push('/connections');
      } else {
        router.push(data?.screen === 'wellbeing' ? '/(tabs)/wellbeing' : '/(tabs)/home');
      }
    });
    return () => sub.remove();
  }, []);

  // Password-reset emails open the app with a recovery link: sign in from it, then show the new-password screen
  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url || !url.includes('reset-password')) return;
      holdRedirectUntil.current = Date.now() + 10000;
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

  // Route guard.
  //  - Signed out: only the welcome/login/signup group, password reset and legal pages.
  //  - Signed in: never the welcome/login/signup group again (also skips it when the app is reopened).
  useEffect(() => {
    if (!ready) return;
    const first = (segments as string[])[0];
    const inAuth = first === '(auth)' || (segments as string[]).length === 0;
    const isPublic = inAuth || first === 'reset-password' || first === 'legal';

    if (!session && !isPublic) {
      router.replace('/');
    } else if (session && inAuth && !redirecting.current && Date.now() >= holdRedirectUntil.current) {
      redirecting.current = true;
      hasCompletedSurvey()
        .catch(() => true)
        .then(done => {
          if (Date.now() < holdRedirectUntil.current) return;
          router.replace(done ? '/(tabs)/home' : '/survey');
        })
        .finally(() => {
          redirecting.current = false;
        });
    }
  }, [ready, session, segments]);

  if (!ready) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="survey" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="moderation" options={{ headerShown: false }} />
        <Stack.Screen name="insights" options={{ headerShown: false }} />
        <Stack.Screen name="legal" options={{ headerShown: false }} />
        <Stack.Screen name="growth" options={{ headerShown: false }} />
        <Stack.Screen name="neighbors" options={{ headerShown: false }} />
        <Stack.Screen name="connections" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="group" options={{ headerShown: false }} />
        <Stack.Screen name="group-new" options={{ headerShown: false }} />
        <Stack.Screen name="milestones" options={{ headerShown: false }} />
      </Stack>
      <OfflineBanner />
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
