import { StyleSheet, Text, TextInput, Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function SignupScreen() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.card}>
        <ThemedText type="title" style={styles.title}>
          Sign Up
        </ThemedText>

        <TextInput
          style={styles.input}
          placeholder="Your Name"
          autoCapitalize="words"
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          secureTextEntry
        />

        <Pressable style={styles.signupButton}>
          <Text style={styles.signupButtonText}>Sign Up</Text>
        </Pressable>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <Link href="/login" asChild>
            <Pressable>
              <Text style={[styles.loginText, styles.loginLink]}>Login</Text>
            </Pressable>
          </Link>
        </View>
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
    backgroundColor: '#F8E1F4',
  },
  card: {
    width: '90%',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 24,
    color: '#1E2A38',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#FFB6C1',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  signupButton: {
    backgroundColor: '#FFB6C1',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  signupButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  loginContainer: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#555',
  },
  loginLink: {
    color: '#FFB6C1',
    fontWeight: '600',
  },
});
