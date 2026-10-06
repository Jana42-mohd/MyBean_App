import { Stack } from 'expo-router';
import { useTheme } from '@/lib/theme';

// Welcome, login and signup: a plain stack with no tab bar
export default function AuthLayout() {
  const colors = useTheme();
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.bg } }} />;
}
