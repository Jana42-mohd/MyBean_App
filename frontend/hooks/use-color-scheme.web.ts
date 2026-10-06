import { useScheme } from '@/lib/theme';

// 'light' | 'dark' after the person's choice (Settings -> Appearance) or the phone's setting
export function useColorScheme(): 'light' | 'dark' {
  return useScheme();
}
