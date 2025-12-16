import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, useColorScheme as useRNColorScheme } from 'react-native';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'themePreference';

let preferred: Theme | null = null;
const subscribers = new Set<(theme: Theme) => void>();

export async function setPreferredColorScheme(theme: Theme) {
  preferred = theme;
  await AsyncStorage.setItem(STORAGE_KEY, theme);
  subscribers.forEach((fn) => fn(theme));
}

export function useColorScheme(): Theme {
  const system = (Appearance?.getColorScheme?.() as Theme) ?? (useRNColorScheme() as Theme) ?? 'light';
  const [theme, setTheme] = useState<Theme>(preferred ?? system);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value === 'light' || value === 'dark') {
        preferred = value;
        setTheme(value);
      }
    });
  }, []);

  useEffect(() => {
    const sub = Appearance?.addChangeListener?.(({ colorScheme }) => {
      if (!preferred) {
        setTheme((colorScheme as Theme) ?? 'light');
      }
    });
    return () => sub?.remove?.();
  }, []);

  useEffect(() => {
    const fn = (value: Theme) => setTheme(value);
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }, []);

  return theme;
}
