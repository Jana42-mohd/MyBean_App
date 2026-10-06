import { StyleSheet, Pressable, Text, View, Image, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/components/LoadError';
import { Palette, useStyles, useTheme } from '@/lib/theme';

// Requirement indicator component
const RequirementRow = ({ met, text }: { met: boolean; text: string }) => {
  const colors = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 14, color: met ? colors.success : colors.muted }}>
        {met ? '✓' : '○'}
      </Text>
      <Text style={{ fontSize: 13, color: met ? colors.success : colors.muted }}>
        {text}
      </Text>
    </View>
  );
};

export default function SignupScreen() {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  // Password validation helper functions
  const hasCapitalLetter = (pwd: string) => /[A-Z]/.test(pwd);
  const hasNumber = (pwd: string) => /[0-9]/.test(pwd);
  const hasSpecialChar = (pwd: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);
  const isPasswordValid = (pwd: string) => 
    pwd.length >= 8 && hasCapitalLetter(pwd) && hasNumber(pwd) && hasSpecialChar(pwd);

  const getPasswordErrors = (pwd: string) => {
    const errors = [];
    if (pwd.length < 8) errors.push('At least 8 characters');
    if (!hasCapitalLetter(pwd)) errors.push('At least one capital letter');
    if (!hasNumber(pwd)) errors.push('At least one number');
    if (!hasSpecialChar(pwd)) errors.push('At least one special character');
    return errors;
  };

  const onSignup = async () => {
    if (!username || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (!isPasswordValid(password)) {
      const errors = getPasswordErrors(password);
      setError(`Password must have: ${errors.join(', ')}`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    let data, err;
    try {
      ({ data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: username.trim() } },
      }));
    } catch (e) {
      setError(friendlyError(e));
      return;
    }
    if (err) {
      setError(friendlyError(err));
      return;
    }
    if (!data.session) {
      // Email confirmation is enabled in Supabase: no session until the user confirms.
      setError('Check your email to confirm your account, then log in.');
      return;
    }
    router.replace('/survey');
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

        {/* <ThemedText style={styles.title}>Create Account</ThemedText> */}

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={colors.muted}
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {password ? (
          <View style={styles.passwordRequirements}>
            <RequirementRow 
              met={password.length >= 8} 
              text="At least 8 characters" 
            />
            <RequirementRow 
              met={hasCapitalLetter(password)} 
              text="At least one capital letter (A-Z)" 
            />
            <RequirementRow 
              met={hasNumber(password)} 
              text="At least one number (0-9)" 
            />
            <RequirementRow 
              met={hasSpecialChar(password)} 
              text="At least one special character (!@#$%^&*)" 
            />
          </View>
        ) : null}
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {error ? <Text style={{ color: colors.link }}>{error}</Text> : null}
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 10 }}>
          By signing up you agree to our{' '}
          <Text style={{ color: colors.link, textDecorationLine: 'underline' }} onPress={() => router.push('/legal?doc=terms')}>Terms</Text>
          {' '}and{' '}
          <Text style={{ color: colors.link, textDecorationLine: 'underline' }} onPress={() => router.push('/legal?doc=privacy')}>Privacy Policy</Text>.
          {' '}You must be 18 or over.
        </Text>
        <Pressable style={styles.mainButton} onPress={onSignup}>
          <Text style={styles.mainButtonText}>Sign Up</Text>
        </Pressable>


        <Pressable onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.footerText}>Already have an account? Log in</Text>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: colors.bg,
  },
  backRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 4,
  },
  backText: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 32,
  },
  card: {
    width: '90%',
    paddingVertical: 34,
    paddingHorizontal: 24,
    backgroundColor: colors.card,
    borderRadius: 20,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    color: colors.text,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    backgroundColor: colors.cardAlt,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordRequirements: {
    width: '100%',
    backgroundColor: colors.wash,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mainButton: {
    width: '100%',
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  mainButtonText: {
    color: colors.onAccent,
    fontWeight: '700',
    fontSize: 16,
  },
  footerText: {
    marginTop: 8,
    color: colors.accentText,
    fontSize: 13,
  },
});
