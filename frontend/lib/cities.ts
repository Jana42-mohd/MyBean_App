// Searching the city list (assets/data/cities.json, built by tools/generate-cities.py from GeoNames, CC BY 4.0).
// Pure functions: the data is passed in, so they are easy to test.

export interface CityData {
  r: string[];                // region names (state, province...), '' when unknown
  c: [string, number][];      // [city name, index into r], biggest cities first
}
export interface CityOption {
  name: string;
  region: string;
}

// lower case, accents removed, punctuation and extra spaces ignored (the same idea as the database's fold_text)
export function fold(s: string): string {
  let t = s.toLowerCase().replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/đ/g, 'd').replace(/ı/g, 'i');
  try {
    t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch {}
  return t.replace(/[\s\-.,'’]+/g, ' ').trim();
}

export const cityLabel = (c: CityOption) => (c.region ? `${c.name}, ${c.region}` : c.name);

// Cities whose name starts with what was typed come first, then names with a word that starts with it. Only when there
// is none of those, names that merely contain it are offered. Inside each group the bigger city comes first.
// An empty search lists the biggest cities.
export function searchCities(data: CityData | null | undefined, query: string, limit = 40): CityOption[] {
  if (!data) return [];
  const q = fold(query);
  const to = (entry: [string, number]): CityOption => ({ name: entry[0], region: data.r[entry[1]] ?? '' });
  if (!q) return data.c.slice(0, limit).map(to);
  const starts: CityOption[] = [], words: CityOption[] = [], inside: CityOption[] = [];
  for (const entry of data.c) {
    const f = fold(entry[0]);
    if (f.startsWith(q)) starts.push(to(entry));
    else if (f.includes(' ' + q)) words.push(to(entry));
    else if (f.includes(q)) inside.push(to(entry));
    else continue;
    if (starts.length >= limit) break; // the list is sorted by size: enough good matches found
  }
  const good = [...starts, ...words];
  return (good.length ? good : inside).slice(0, limit);
}
