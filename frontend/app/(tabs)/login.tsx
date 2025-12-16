import { StyleSheet, Pressable, Text, View, Image, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const checkSurvey = async () => {
      const completed = await AsyncStorage.getItem('surveyCompleted');
      if (completed === 'true') {
        // If already completed, land on home when logging in
        // (in a real app, you'd still validate credentials)
      }
    };
    checkSurvey();
  }, []);

  const onLogin = async () => {
    // TODO: integrate real auth; for now, accept any non-empty
    if (!email || !password) return;
    setSubmitting(true);
    try {
      // Existing users go directly to home
      router.replace('/(tabs)/home');
    } finally {
      setSubmitting(false);
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
          source={require('C:/Users/Janam/Desktop/projects/MyBean_App/frontend/assets/images/beandark.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <ThemedText style={styles.title}>Welcome Back</ThemedText>

        <TextInput
          style={styles.input}
          placeholder="Email or Username"
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

        <Pressable style={styles.mainButton} onPress={onLogin} disabled={submitting}>
          <Text style={styles.mainButtonText}>Log In</Text>
        </Pressable>

        <Pressable style={styles.googleButton}>
          <Text style={styles.googleText}>Sign in with Google</Text>
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
    lineHeight: 15,
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
  googleButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FDFECC',
    backgroundColor: 'rgba(253, 254, 204, 0.1)',
    marginTop: 4,
  },
  googleText: {
    color: '#FDFECC',
    fontSize: 15,
    fontWeight: '600',
  },
  footerText: {
    marginTop: 8,
    color: '#FED8FE',
    fontSize: 13,
  },
});
