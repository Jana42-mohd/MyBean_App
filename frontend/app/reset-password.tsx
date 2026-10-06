import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { changePassword, passwordProblems } from '@/lib/auth';
import { friendlyError } from '@/components/LoadError';
import { Palette, useStyles, useTheme } from '@/lib/theme';

// Opened from the password-reset email link; the app has already signed the user in by this point.
export default function ResetPasswordScreen() {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const problems = passwordProblems(password);
    if (problems.length) return setError(`Password needs ${problems.join(', ')}.`);
    if (password !== confirm) return setError('Passwords do not match.');
    setSaving(true);
    setError('');
    try {
      await changePassword(password);
      Alert.alert('Password updated', 'You can now use your new password.');
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.card}>
        <ThemedText style={styles.title}>Choose a new password</ThemedText>
        <TextInput style={styles.input} placeholder="New password" placeholderTextColor={colors.muted} secureTextEntry value={password} onChangeText={setPassword} />
        <TextInput style={styles.input} placeholder="Confirm new password" placeholderTextColor={colors.muted} secureTextEntry value={confirm} onChangeText={setConfirm} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.button} onPress={submit} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Update password'}</Text>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 22, color: colors.heading, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, marginBottom: 12 },
  error: { color: colors.link, marginBottom: 10 },
  button: { backgroundColor: colors.accent, borderRadius: 10, padding: 14 },
  buttonText: { color: colors.onAccent, fontWeight: '700', textAlign: 'center' },
});
