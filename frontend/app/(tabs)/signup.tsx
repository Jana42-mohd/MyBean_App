import { StyleSheet, Pressable, Text, View, Image, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Requirement indicator component
const RequirementRow = ({ met, text }: { met: boolean; text: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Text style={{ fontSize: 14, color: met ? '#90EE90' : '#A4CDD3' }}>
      {met ? '✓' : '○'}
    </Text>
    <Text style={{ fontSize: 13, color: met ? '#90EE90' : '#A4CDD3' }}>
      {text}
    </Text>
  </View>
);

export default function SignupScreen() {
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
    // In real app, call backend to create account
    setError('');
    // New signup users go directly to survey
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
          source={require('C:/Users/Janam/Desktop/projects/MyBean_App/frontend/assets/images/beandark.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* <ThemedText style={styles.title}>Create Account</ThemedText> */}

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#A4CDD3"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#A4CDD3"
          keyboardType="email-address"
          autoCapitalize="none"
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
          placeholderTextColor="#A4CDD3"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {error ? <Text style={{ color: '#FDFECC' }}>{error}</Text> : null}
        <Pressable style={styles.mainButton} onPress={onSignup}>
          <Text style={styles.mainButtonText}>Sign Up</Text>
        </Pressable>

        <Pressable style={styles.googleButton}>
          <Text style={styles.googleText}>Sign up with Google</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/(tabs)/login')}>
          <Text style={styles.footerText}>Already have an account? Log in</Text>
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
  passwordRequirements: {
    width: '100%',
    backgroundColor: 'rgba(47, 155, 168, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
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
