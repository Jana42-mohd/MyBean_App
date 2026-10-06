#!/usr/bin/env python3
"""Builds frontend/assets/data/cities.json, the city list behind "Parents near you" > choose your city.

Source data (both are GeoNames extracts, licence CC BY 4.0, attribution is shown in the app under Settings > About):
  * geonamescache  -> cities with 5,000+ people: name, country, population, coordinates
  * reverse_geocoder (rg_cities1000.csv) -> the same places with the NAME of their state/province

Run:  pip install geonamescache && pip download --no-deps reverse_geocoder && (unpack the .tar.gz)
      python3 tools/generate-cities.py path/to/rg_cities1000.csv
Output: {"CA": {"r": ["Ontario", ...], "c": [["Toronto", 0], ...]}, ...}  (cities by population, biggest first)
"""
import csv, json, sys, collections
import geonamescache

csv_path = sys.argv[1]
grid = collections.defaultdict(list)   # (country, lat cell, lon cell) -> [(lat, lon, name, region)]
with open(csv_path, newline='', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        lat, lon = float(row['lat']), float(row['lon'])
        grid[(row['cc'], round(lat, 1), round(lon, 1))].append((lat, lon, row['name'].lower(), row['admin1'].strip()))


def region_of(cc, lat, lon, name):
    # the two data sets give the same place slightly different coordinates: look in the neighbouring cells,
    # prefer the same name, otherwise the closest place within about 15 km
    best, best_d = '', 0.02
    la, lo = round(lat, 1), round(lon, 1)
    for dy in (-0.1, 0, 0.1):
        for dx in (-0.1, 0, 0.1):
            for (y, x, n, r) in grid.get((cc, round(la + dy, 1), round(lo + dx, 1)), ()):
                d = (y - lat) ** 2 + (x - lon) ** 2
                if n == name.lower() and d < 0.05:
                    return r
                if d < best_d:
                    best, best_d = r, d
    return best


out = {}
missing = 0
rows = sorted(geonamescache.GeonamesCache().get_cities().values(), key=lambda c: -c['population'])
for c in rows:
    cc = c['countrycode']
    region = region_of(cc, c['latitude'], c['longitude'], c['name'])
    if not region:
        missing += 1
    entry = out.setdefault(cc, {'r': [], 'c': []})
    if region not in entry['r']:
        entry['r'].append(region)
    entry['c'].append([c['name'], entry['r'].index(region)])

# a city that appears twice with the same name and region is one place
for cc, entry in out.items():
    seen, kept = set(), []
    for name, r in entry['c']:
        k = (name.lower(), r)
        if k not in seen:
            seen.add(k)
            kept.append([name, r])
    entry['c'] = kept

path = 'frontend/assets/data/cities.json'
with open(path, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
print(f'{sum(len(e["c"]) for e in out.values())} cities in {len(out)} countries, {missing} without a region name -> {path}')
