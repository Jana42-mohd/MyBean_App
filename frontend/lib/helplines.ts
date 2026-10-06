import AsyncStorage from '@react-native-async-storage/async-storage';

// Crisis and perinatal support lines by country (2-letter codes, as in lib/countries.ts).
// Only numbers that were checked against the organisation's own page or a national directory are listed.
// Any other country gets the emergency number we are sure of (EU: 112) or a pointer to findahelpline.com, a directory
// whose entries are confirmed by the helplines themselves. To add or fix a country, edit HELP below and run the tests.
export const HELPLINES_CHECKED = 'October 2026';
export const FIND_A_HELPLINE = 'https://findahelpline.com';

export interface Helpline {
  name: string;
  phone: string;    // digits only (plus a leading + if needed): what the phone dials
  display: string;  // how it is shown
  note?: string;    // hours, or how to text
}
export interface CountryHelp {
  emergency: { phone: string; display: string };
  lines: Helpline[];
}

const PSI: Helpline = { name: 'Postpartum Support International', phone: '18009444773', display: '1-800-944-4773', note: 'Call, or text HELP' };
const SAMARITANS: Helpline = { name: 'Samaritans', phone: '116123', display: '116 123', note: 'Free, any time' };

const HELP: Record<string, CountryHelp> = {
  CA: {
    emergency: { phone: '911', display: '911' },
    lines: [{ name: '9-8-8 Suicide Crisis Helpline', phone: '988', display: '9-8-8', note: 'Call or text, any time, English and French' }, PSI],
  },
  US: {
    emergency: { phone: '911', display: '911' },
    lines: [
      { name: '9-8-8 Suicide & Crisis Lifeline', phone: '988', display: '9-8-8', note: 'Call or text, any time' },
      { name: 'National Maternal Mental Health Hotline', phone: '18338526262', display: '1-833-852-6262', note: 'Free, confidential, any time' },
      PSI,
    ],
  },
  GB: {
    emergency: { phone: '999', display: '999' },
    lines: [
      SAMARITANS,
      { name: 'PANDAS Foundation (pregnancy and postnatal illness)', phone: '08081961776', display: '0808 1961 776', note: 'Free, Mon-Fri 10am-5pm. Text PANDAS to 85258 any time' },
    ],
  },
  IE: {
    emergency: { phone: '112', display: '112 or 999' },
    lines: [SAMARITANS, { name: 'Pieta (suicidal thoughts and self-harm)', phone: '1800247247', display: '1800 247 247', note: 'Free' }],
  },
  AU: {
    emergency: { phone: '000', display: '000' },
    lines: [
      { name: 'PANDA National Perinatal Mental Health Helpline', phone: '1300726306', display: '1300 726 306', note: 'Mon-Sat' },
      { name: 'Lifeline', phone: '131114', display: '13 11 14', note: 'Any time' },
    ],
  },
  NZ: {
    emergency: { phone: '111', display: '111' },
    lines: [{ name: '1737, Need to talk?', phone: '1737', display: '1737', note: 'Free call or text, any time' }],
  },
};

// 112 reaches the emergency services in every member state of the European Union
const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
for (const code of EU) HELP[code] = { emergency: { phone: '112', display: '112' }, lines: [] };

// What to show for a country; null when we have nothing reliable for it (the screen then points to the directory)
export function helpFor(code: string | null | undefined): CountryHelp | null {
  return (code && HELP[code.toUpperCase()]) || null;
}
export const helpCountries = () => Object.keys(HELP);

// ---- the country used for help: the place the parent set under Parents near you, or a choice kept on this phone only ----
const KEY = 'helpCountry';

export async function getHelpCountryChoice(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v && /^[A-Z]{2}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export async function setHelpCountryChoice(code: string | null) {
  try {
    if (code) await AsyncStorage.setItem(KEY, code);
    else await AsyncStorage.removeItem(KEY);
  } catch {}
}

// The phone's choice wins (the parent picked it here on purpose); otherwise the saved place
export const pickHelpCountry = (choice: string | null, place: string | null) => choice || place || null;
