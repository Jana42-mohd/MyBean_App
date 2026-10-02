import { StyleSheet, Pressable, Text, View, Image, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { hasCompletedSurvey } from '@/lib/household';
import { sendPasswordReset } from '@/lib/auth';
import { friendlyError } from '@/components/LoadError';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const goAfterLogin = async () => {
    // First login (no survey yet) -> survey, otherwise straight to home
    const done = await hasCompletedSurvey().catch(() => false);
    router.replace(done ? '/(tabs)/home' : '/survey');
  };

  const onLogin = async () => {
    if (!email || !password) return;
    setSubmitting(true);
    setError('');
    setInfo('');
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        setError(friendlyError(err));
        return;
      }
      await goAfterLogin();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onForgot = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Type your email above first, then tap "Forgot password?".');
      return;
    }
    try {
      await sendPasswordReset(email);
      setInfo("If an account exists for that email, we've sent a link to reset your password.");
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.backRow}>
          <Pressable onPress={() => router.replace('/')}>
            <Text style={styles.backText}>← </Text>
          </Pressable>
        </View>
        <Image
          source={require('@/assets/images/beandark.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <ThemedText style={styles.title}>Welcome Back</ThemedText>

        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#A4CDD3"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#A4CDD3"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={{ color: '#FDFECC', marginBottom: 8 }}>{error}</Text> : null}
        {info ? <Text style={{ color: '#A4CDD3', marginBottom: 8 }}>{info}</Text> : null}

        <Pressable style={styles.mainButton} onPress={onLogin} disabled={submitting}>
          <Text style={styles.mainButtonText}>Log In</Text>
        </Pressable>

        <Pressable onPress={onForgot}>
          <Text style={[styles.footerText, { marginBottom: 12 }]}>Forgot password?</Text>
        </Pressable>


        <Pressable onPress={() => router.push('/(tabs)/signup')}>
          <Text style={styles.footerText}>Don’t have an account? Sign up</Text>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#09282eff',
  },
  backRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 4,
  },
  backText: {
    color: '#E8FBFF',
    fontSize: 25,
    lineHeight: 32,
  },
  card: {
    width: '90%',
    paddingVertical: 34,
    paddingHorizontal: 24,
    backgroundColor: '#0f3a41ff',
    borderRadius: 20,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#2F9BA8',
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    color: '#E8FBFF',
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    backgroundColor: '#11464e',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    fontSize: 15,
    color: '#E8FBFF',
    borderWidth: 1,
    borderColor: '#2F9BA8',
  },
  mainButton: {
    width: '100%',
    backgroundColor: '#FED8FE',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  mainButtonText: {
    color: '#12454E',
    fontWeight: '700',
    fontSize: 16,
  },
  footerText: {
    marginTop: 8,
    color: '#FED8FE',
    fontSize: 13,
  },
});
