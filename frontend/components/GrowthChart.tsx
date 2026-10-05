import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { GrowthMetric, STANDARD_PERCENTILES, Sex, valueAtZ } from '@/lib/growth';

export interface GrowthPoint {
  key: string;
  months: number; // age at measurement
  value: number; // stored units (kg / cm)
  date: string;
  percentile?: string; // "45th", when known
}

const SURFACE = '#0f3a41';
const MUTED = '#A4CDD3';
const INK = '#E8FBFF';
const H = 230;
const M = { l: 40, r: 30, t: 10, b: 26 };

const X_MAXES = [6, 12, 18, 24, 36, 48, 60];
const pickXMax = (maxMonths: number) => X_MAXES.find(x => x >= maxMonths + 2) ?? 60;

function niceStep(range: number, target = 4) {
  const raw = range / target;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= raw) return m * exp;
  return 10 * exp;
}

export function GrowthChart({
  title,
  metric,
  sex,
  points,
  toDisplay,
  axisUnit,
  fmtValue,
  color,
}: {
  title: string;
  metric: GrowthMetric;
  sex: Sex | null; // null: no percentile lines (gender not given)
  points: GrowthPoint[]; // oldest first
  toDisplay: (v: number) => number; // stored units -> axis units
  axisUnit: string;
  fmtValue: (v: number) => string;
  color: string;
}) {
  const [w, setW] = useState(320);
  const [sel, setSel] = useState<string | null>(null);

  const xMax = pickXMax(Math.max(0, ...points.map(p => p.months)));

  const curves = useMemo(() => {
    if (!sex) return [];
    return STANDARD_PERCENTILES.map(({ p, z }) => ({
      p,
      pts: Array.from({ length: Math.round(xMax * 2) + 1 }, (_, i) => {
        const m = i / 2;
        return { m, v: toDisplay(valueAtZ(metric, sex, m, z)) };
      }),
    }));
  }, [sex, metric, xMax, toDisplay]);

  const all = [...curves.flatMap(c => c.pts.map(q => q.v)), ...points.map(p => toDisplay(p.value))];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo || 1) * 0.04;
  const yMin = lo - pad;
  const yMax = hi + pad;

  const pw = w - M.l - M.r;
  const ph = H - M.t - M.b;
  const x = (m: number) => M.l + (m / xMax) * pw;
  const y = (v: number) => H - M.b - ((v - yMin) / (yMax - yMin)) * ph;

  const step = niceStep(yMax - yMin);
  const yTicks: number[] = [];
  for (let t = Math.ceil(yMin / step) * step; t <= yMax; t += step) yTicks.push(Math.round(t * 1000) / 1000);
  const xStep = xMax <= 6 ? 1 : xMax <= 12 ? 2 : xMax <= 24 ? 3 : 6;
  const xTicks = Array.from({ length: Math.floor(xMax / xStep) + 1 }, (_, i) => i * xStep);

  const line = (pts: { x: number; y: number }[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ');
  const selected = points.find(p => p.key === sel);

  const onPress = (locationX: number) => {
    if (points.length === 0) return;
    let best = points[0];
    let bestD = Infinity;
    for (const p of points) {
      const d = Math.abs(x(p.months) - locationX);
      if (d < bestD) { best = p; bestD = d; }
    }
    setSel(bestD <= 30 ? (sel === best.key ? null : best.key) : null); // generous hit area: dots are small
  };

  const ageText = (m: number) => (m < 24 ? `${Math.round(m * 10) / 10} months` : `${Math.floor(m / 12)} y ${Math.round(m % 12)} mo`);

  return (
    <View style={styles.card} accessible accessibilityLabel={`${title} growth chart`}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.readout}>
        {selected ? (
          <>
            <Text style={styles.readoutValue}>{fmtValue(selected.value)}</Text>
            <Text style={styles.readoutMeta}>{`  ${ageText(selected.months)}${selected.percentile ? ` · ${selected.percentile} percentile` : ''}`}</Text>
          </>
        ) : points.length ? 'Tap a dot for details' : 'No measurements yet'}
      </Text>

      <Pressable onPress={e => onPress(e.nativeEvent.locationX)} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
        <Svg width={w} height={H}>
          {yTicks.map(t => (
            <Line key={`g${t}`} x1={M.l} x2={w - M.r} y1={y(t)} y2={y(t)} stroke={MUTED} strokeOpacity={0.12} strokeWidth={1} />
          ))}
          {yTicks.map(t => (
            <SvgText key={`yl${t}`} x={M.l - 6} y={y(t) + 3} fontSize={10} fill={MUTED} textAnchor="end">
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </SvgText>
          ))}
          {xTicks.map(t => (
            <SvgText key={`xl${t}`} x={x(t)} y={H - 8} fontSize={10} fill={MUTED} textAnchor="middle">
              {t}
            </SvgText>
          ))}

          {/* WHO percentile lines: reference, so quiet */}
          {curves.map(c => (
            <Path
              key={`c${c.p}`}
              d={line(c.pts.map(q => ({ x: x(q.m), y: y(q.v) })))}
              stroke={MUTED}
              strokeOpacity={c.p === 50 ? 0.65 : 0.32}
              strokeWidth={c.p === 50 ? 1.5 : 1}
              fill="none"
            />
          ))}
          {curves.map(c => {
            const last = c.pts[c.pts.length - 1];
            return (
              <SvgText key={`cl${c.p}`} x={x(last.m) + 4} y={y(last.v) + 3} fontSize={9} fill={MUTED}>
                {c.p}
              </SvgText>
            );
          })}

          {/* the baby */}
          {points.length > 1 ? (
            <Path d={line(points.map(p => ({ x: x(p.months), y: y(toDisplay(p.value)) })))} stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" fill="none" />
          ) : null}
          {points.map(p => (
            <Circle
              key={p.key}
              cx={x(p.months)}
              cy={y(toDisplay(p.value))}
              r={p.key === sel ? 6 : 4}
              fill={color}
              stroke={SURFACE}
              strokeWidth={2}
            />
          ))}
        </Svg>
      </Pressable>
      <Text style={styles.axisNote}>age in months · {axisUnit}{sex ? ' · grey lines: WHO 3rd, 15th, 50th, 85th, 97th percentiles' : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: SURFACE, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2F9BA8', marginBottom: 16 },
  title: { color: INK, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  readout: { marginTop: 6, marginBottom: 6, minHeight: 20, color: MUTED, fontSize: 13 },
  readoutValue: { color: INK, fontWeight: '700', fontSize: 15 },
  readoutMeta: { color: MUTED, fontSize: 12 },
  axisNote: { color: MUTED, fontSize: 10, marginTop: 4, lineHeight: 14 },
});
