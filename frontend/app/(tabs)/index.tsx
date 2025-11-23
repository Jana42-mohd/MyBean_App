import { StyleSheet, Pressable, Text, View, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  const router = useRouter();
  
  return (
    <ThemedView style={styles.container}>
      <View style={styles.card}>
        <Image
          source={require('C:/Users/Janam/Desktop/babyCareApp/frontend/assets/images/beandark.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      
        <ThemedText style={styles.subtitle}>
          You've got a lot on your plate, this app is here to make things easier.
        </ThemedText>
        <ThemedText style={styles.smallText}>
          Track feedings, naps, diapers, formula & more.
        </ThemedText>
        <View style={styles.buttonContainer}>
          <Pressable 
            style={styles.signupButton}
            onPress={() => router.push('/signup')}
          >
            <Text style={styles.signupText}>Create Account</Text>
          </Pressable>
          <Pressable 
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginText}>Already have an Account</Text>
          </Pressable>
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
    backgroundColor: '#09282eff', 
  },
  card: {
    width: '90%',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: '#1A5A65', 
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2F9BA8', 
  },
  logo: {
    width: 250,
    height: 250,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 17,
    marginBottom: 12,
    textAlign: 'center',
    color: '#E8FBFF', 
  },
  smallText: {
    fontSize: 15,
    opacity: 0.45,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 22,
    color: '#E8FBFF', 
  },
  buttonContainer: {
    width: '100%',
    gap: 14,
  },
  loginButton: {
    borderWidth: 2,
    borderColor: '#FDFECC', 
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(253, 254, 204, 0.1)', 
  },
  loginText: {
    color: '#FDFECC',
    fontWeight: '700',
    fontSize: 16,
  },
  signupButton: {
    backgroundColor: '#FED8FE', 
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#FED8FE',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  signupText: {
    color: '#12454E', 
    fontWeight: '700',
    fontSize: 16,
  },
  
});