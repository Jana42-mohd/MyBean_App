import { CityData } from './cities';

// The city list is large (about 600 KB), so it is read only when someone opens the city picker.
let all: Record<string, CityData> | null = null;

export function citiesOf(country: string | null | undefined): CityData | null {
  if (!country) return null;
  if (!all) all = require('../assets/data/cities.json') as Record<string, CityData>;
  return all[country] ?? null;
}
