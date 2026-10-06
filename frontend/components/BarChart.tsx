import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Palette, useStyles, useTheme } from '@/lib/theme';

export interface BarSegment {
  value: number;
  color: string;
  name: string;
}
export interface BarDatum {
  key: string;
  label: string; // axis label ('' to skip)
  segments: BarSegment[]; // stacked bottom -> top
}


// 1, 2, 2.5, 5, 10 ... x power of ten, at or above v
export function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}

export function BarChart({
  title,
  data,
  height = 140,
  format,
  legend = false,
  unit = '',
}: {
  title: string;
  data: BarDatum[];
  height?: number;
  format: (v: number) => string; // how a value reads: "7h 30m", "6"
  legend?: boolean; // show for 2+ series
  unit?: string; // axis unit, e.g. "hours"
}) {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const [selected, setSelected] = useState<string | null>(null);
  const [asTable, setAsTable] = useState(false);

  const totals = data.map(d => d.segments.reduce((a, s) => a + s.value, 0));
  const max = niceCeil(Math.max(...totals, 0));
  const ticks = [max, max / 2, 0];
  const seriesNames = Array.from(new Map(data.flatMap(d => d.segments).map(s => [s.name, s.color])).entries());
  const sel = data.find(d => d.key === selected);
  const selTotals = sel ? sel.segments.map(s => `${s.name === title ? '' : s.name + ' '}${format(s.value)}`).join(' · ') : '';

  return (
    <View style={styles.card} accessible accessibilityLabel={`${title} chart`}>
      <View style={styles.headRow}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={() => setAsTable(v => !v)} hitSlop={10}>
          <Text style={styles.toggle}>{asTable ? 'Chart' : 'Table'}</Text>
        </Pressable>
      </View>

      {legend && seriesNames.length > 1 ? (
        <View style={styles.legend}>
          {seriesNames.map(([name, color]) => (
            <View key={name} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{name}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {asTable ? (
        <View>
          {[...data].reverse().map(d => (
            <View key={d.key} style={styles.tableRow}>
              <Text style={styles.tableDay}>{d.key.slice(5)}</Text>
              <Text style={styles.tableVal}>
                {d.segments.map(s => `${seriesNames.length > 1 ? s.name + ' ' : ''}${format(s.value)}`).join(' · ')}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <>
          {/* value readout: the value leads, the day follows */}
          <Text style={styles.readout}>
            {sel ? (
              <>
                <Text style={styles.readoutValue}>{selTotals}</Text>
                <Text style={styles.readoutDay}>{'  ' + sel.key.slice(5)}</Text>
              </>
            ) : (
              'Tap a bar for details'
            )}
          </Text>

          <View style={{ flexDirection: 'row' }}>
            <View style={[styles.yAxis, { height }]}>
              {ticks.map((t, i) => (
                <Text key={i} style={styles.tick}>
                  {Number.isInteger(t) ? t : t.toFixed(1)}
                </Text>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ height }}>
                {ticks.map((_, i) => (
                  <View key={i} style={[styles.grid, { top: (i * (height - 1)) / 2 }]} />
                ))}
                <View style={styles.bars}>
                  {data.map((d, idx) => {
                    const total = totals[idx];
                    const topIdx = d.segments.map(s => s.value > 0).lastIndexOf(true);
                    return (
                      <Pressable
                        key={d.key}
                        style={styles.col}
                        onPress={() => setSelected(selected === d.key ? null : d.key)}
                        accessibilityLabel={`${d.key}: ${d.segments.map(s => `${s.name} ${format(s.value)}`).join(', ')}`}>
                        <View style={{ width: '70%', maxWidth: 24, opacity: selected && selected !== d.key ? 0.45 : 1 }}>
                          {total > 0
                            ? [...d.segments].reverse().map((s, ri) => {
                                const i = d.segments.length - 1 - ri;
                                if (s.value <= 0) return null;
                                const h = Math.max((s.value / max) * (height - 4), 2);
                                return (
                                  <View
                                    key={i}
                                    style={{
                                      height: h,
                                      backgroundColor: s.color,
                                      borderTopLeftRadius: i === topIdx ? 4 : 0,
                                      borderTopRightRadius: i === topIdx ? 4 : 0,
                                      borderTopWidth: 0,
                                      marginTop: i === topIdx ? 0 : 0,
                                      borderBottomWidth: i > 0 && d.segments.slice(0, i).some(x => x.value > 0) ? 2 : 0,
                                      borderBottomColor: colors.card,
                                    }}
                                  />
                                );
                              })
                            : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={styles.xRow}>
                {data.map(d => (
                  <Text key={d.key} style={styles.xLabel} numberOfLines={1}>
                    {d.label}
                  </Text>
                ))}
              </View>
            </View>
          </View>
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        </>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  toggle: { color: colors.muted, fontSize: 13, textDecorationLine: 'underline' },
  legend: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { color: colors.muted, fontSize: 12 },
  readout: { marginTop: 10, marginBottom: 8, minHeight: 20, color: colors.muted, fontSize: 13 },
  readoutValue: { color: colors.text, fontWeight: '700', fontSize: 15 },
  readoutDay: { color: colors.muted, fontSize: 12 },
  yAxis: { width: 30, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6 },
  tick: { color: colors.muted, fontSize: 10, lineHeight: 12 },
  grid: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.line },
  bars: { flexDirection: 'row', flex: 1, alignItems: 'flex-end' },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  xRow: { flexDirection: 'row', marginTop: 6 },
  xLabel: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 10 },
  unit: { color: colors.muted, fontSize: 10, marginTop: 4 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  tableDay: { color: colors.muted, fontSize: 13 },
  tableVal: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
