import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { useColorScheme as useSystemScheme } from 'react-native';

// The colours of the app, in one place. Screens never write hex values: they ask for a role (colors.card, colors.accent, ...)
// so light and dark mode - and any future change of the look - are one edit here.
//
// Roles:
//   bg / card / cardAlt / line / border   surfaces and strokes (page, panel, raised panel or input, divider, outline)
//   text / heading / muted                body text, titles, secondary text
//   accent + onAccent                     the brand colour as a FILL (primary buttons, selected pills, badges) and the text on it
//   accentText                            the brand colour as TEXT or an icon
//   link / highlight                      the yellow: text (links, labels, headings) and fill (active chips, with onAccent text on it)
//   tint + onTint                         the teal used for switches and small fills, and the text on it
//   danger / errorBg                      destructive actions and error panels
// The brand pink is used sparingly on purpose: titles are neutral, pink marks the main action and the selected state.
// Pink and yellow are pastel FILLS in both themes (dark text on them in light mode); text and icons use teal in light mode.
export interface Palette {
  scheme: 'light' | 'dark';
  bg: string;
  card: string;
  cardAlt: string;
  line: string;
  border: string;
  text: string;
  heading: string;
  muted: string;
  accent: string;
  onAccent: string;
  accentText: string;
  link: string;       // yellow in dark mode, mustard in light mode: links, labels and headings
  highlight: string;  // yellow FILL (active chips and tabs); text on it is onAccent
  tint: string;
  onTint: string;     // text on a tint fill
  danger: string;
  errorBg: string;
  overlay: string;
  wash: string;       // faint teal fill for chips and choices
  accentWash: string; // faint brand-colour fill
  success: string;
  soft: string;       // a faint wash for pressed rows
  sleep: string;      // chart colours (validated for each surface with the dataviz validator)
  feed: string;
  wet: string;
  dirty: string;
}

export const DARK: Palette = {
  scheme: 'dark',
  bg: '#09282e',
  card: '#0f3a41',
  cardAlt: '#12454e',
  line: '#164a52',
  border: '#2F9BA8',
  text: '#E8FBFF',
  heading: '#E8FBFF',
  muted: '#A4CDD3',
  accent: '#E4B1D6',
  onAccent: '#09282e',
  accentText: '#EBBFE0',
  link: '#FDFECC',
  highlight: '#FDFECC',
  tint: '#2F9BA8',
  onTint: '#F2FDFF',
  danger: '#FF8F8F',
  errorBg: '#3a1f2a',
  overlay: 'rgba(0,0,0,0.6)',
  wash: 'rgba(47,155,168,0.12)',
  accentWash: 'rgba(228,177,214,0.14)',
  success: '#7fe3b4',
  soft: 'rgba(164,205,211,0.08)',
  sleep: '#9085e9',
  feed: '#199e70',
  wet: '#3987e5',
  dirty: '#d95926',
};

// Light mode keeps the brand's own light look: pale aqua page, white cards, the same pastel pink and pastel butter-yellow
// as in dark mode, but only ever as FILLS with dark text on them. Text and icons are teal, never gold or deep pink.
export const LIGHT: Palette = {
  scheme: 'light',
  bg: '#E8FBFF',
  card: '#FFFFFF',
  cardAlt: '#F1FAFC',
  line: '#CBE7EC',
  border: '#9ED3DC',
  text: '#0F3A41',
  heading: '#0B2F35',
  muted: '#41727B',
  accent: '#FED8FE',
  onAccent: '#0F3A41',
  accentText: '#1B5E69',
  link: '#1B6B76',
  highlight: '#FDFECC',
  tint: '#1E8794',
  onTint: '#FFFFFF',
  danger: '#C0332F',
  errorBg: '#FDECEC',
  overlay: 'rgba(8,40,46,0.45)',
  wash: 'rgba(47,155,168,0.10)',
  accentWash: 'rgba(254,216,254,0.65)',
  success: '#1F8A5A',
  soft: 'rgba(15,58,65,0.05)',
  sleep: '#4a3aa7',
  feed: '#1baf7a',
  wet: '#2a78d6',
  dirty: '#eb6834',
};

export type ThemePreference = 'system' | 'light' | 'dark';
const KEY = 'themePreference';

let preference: ThemePreference = 'system';
const listeners = new Set<(p: ThemePreference) => void>();

// Call once at start-up (the splash screen waits for it so the first frame has the right colours)
export async function loadThemePreference() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') preference = v;
  } catch {}
  listeners.forEach(l => l(preference));
}

export async function setThemePreference(p: ThemePreference) {
  preference = p;
  listeners.forEach(l => l(p));
  try {
    await AsyncStorage.setItem(KEY, p);
  } catch {}
}

export function useThemePreference(): [ThemePreference, (p: ThemePreference) => Promise<void>] {
  const [p, setP] = useState(preference);
  useEffect(() => {
    const l = (v: ThemePreference) => setP(v);
    listeners.add(l);
    setP(preference);
    return () => { listeners.delete(l); };
  }, []);
  return [p, setThemePreference];
}

export function resolveScheme(pref: ThemePreference, system: string | null | undefined): 'light' | 'dark' {
  return pref === 'system' ? (system === 'light' ? 'light' : 'dark') : pref; // the app is dark-first: unknown means dark
}

export function useScheme(): 'light' | 'dark' {
  const system = useSystemScheme();
  const [pref] = useThemePreference();
  return resolveScheme(pref, system);
}

export function useTheme(): Palette {
  return useScheme() === 'light' ? LIGHT : DARK;
}

// Styles that depend on the palette: define `const makeStyles = (colors: Palette) => StyleSheet.create({...})` once per file
// and call `const styles = useStyles(makeStyles)` in the component. They are rebuilt only when the theme changes.
export function useStyles<T>(factory: (colors: Palette) => T): T {
  const colors = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
