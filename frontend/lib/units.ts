import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Units } from './growth';

const KEY = 'units';
let current: Units | null = null;
const listeners = new Set<(u: Units) => void>();

// Metric / imperial preference, kept on this phone. Measurements are always stored in kg and cm.
export async function loadUnits(): Promise<Units> {
  if (current) return current;
  try {
    const v = await AsyncStorage.getItem(KEY);
    current = v === 'imperial' ? 'imperial' : 'metric';
  } catch {
    current = 'metric';
  }
  return current;
}

export async function saveUnits(u: Units) {
  current = u;
  listeners.forEach(l => l(u));
  await AsyncStorage.setItem(KEY, u).catch(() => {});
}

export function useUnits(): [Units, (u: Units) => void] {
  const [units, setUnits] = useState<Units>(current ?? 'metric');
  useEffect(() => {
    let alive = true;
    loadUnits().then(u => alive && setUnits(u));
    listeners.add(setUnits);
    return () => {
      alive = false;
      listeners.delete(setUnits);
    };
  }, []);
  const change = useCallback((u: Units) => { saveUnits(u); }, []);
  return [units, change];
}
