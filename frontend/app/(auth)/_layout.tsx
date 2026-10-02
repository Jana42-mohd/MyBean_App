import { Stack } from 'expo-router';

// Welcome, login and signup: a plain stack with no tab bar
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: '#09282eff' } }} />;
}
