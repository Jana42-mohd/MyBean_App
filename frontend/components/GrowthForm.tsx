import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GrowthData, LIMITS, Units, cmToIn, inToCm, kgToLbOz, lbOzToKg } from '@/lib/growth';
import { formatDateInput, isValidDate, todayStr } from '@/lib/babies';
import { Palette, useStyles, useTheme } from '@/lib/theme';

const num = (s: string): number | undefined => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

// Form for one measurement (any of weight, length, head). Values are shown in the person's units
// and handed back in kg / cm.
export function GrowthForm({
  units,
  initial,
  birthDate,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  units: Units;
  initial?: GrowthData;
  birthDate?: string | null;
  submitLabel: string;
  onSubmit: (data: GrowthData) => Promise<void> | void;
  onCancel: () => void;
}) {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const imp = units === 'imperial';
  const w = initial?.weightKg !== undefined ? kgToLbOz(initial.weightKg) : undefined;
  const [f, setF] = useState({
    date: initial?.date ?? todayStr(),
    kg: initial?.weightKg !== undefined && !imp ? String(round(initial.weightKg, 3)) : '',
    lb: w && imp ? String(w.lb) : '',
    oz: w && imp ? String(w.oz) : '',
    length: initial?.lengthCm !== undefined ? String(round(imp ? cmToIn(initial.lengthCm) : initial.lengthCm, 1)) : '',
    head: initial?.headCm !== undefined ? String(round(imp ? cmToIn(initial.headCm) : initial.headCm, 1)) : '',
    notes: initial?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(p => ({ ...p, [k]: v }));

  const submit = async () => {
    try {
      if (!isValidDate(f.date)) throw new Error('Enter the date as a real date, like 2025-03-14.');
      if (f.date > todayStr()) throw new Error('That date is in the future.');
      if (birthDate && f.date < birthDate) throw new Error('That date is before the birth date.');

      const data: GrowthData = { date: f.date };
      const weightKg = imp ? (f.lb || f.oz ? lbOzToKg(num(f.lb) ?? 0, num(f.oz) ?? 0) : undefined) : num(f.kg);
      const length = num(f.length);
      const head = num(f.head);
      if (weightKg !== undefined) data.weightKg = round(weightKg, 3);
      if (length !== undefined) data.lengthCm = round(imp ? inToCm(length) : length, 1);
      if (head !== undefined) data.headCm = round(imp ? inToCm(head) : head, 1);
      if (data.weightKg === undefined && data.lengthCm === undefined && data.headCm === undefined) {
        throw new Error('Enter at least one measurement.');
      }
      const check = (v: number | undefined, [lo, hi]: readonly [number, number], name: string, unit: string) => {
        if (v !== undefined && (v < lo || v > hi)) throw new Error(`${name} looks wrong (expected ${lo} to ${hi} ${unit}). Check the number and units.`);
      };
      check(data.weightKg, LIMITS.weightKg, 'Weight', 'kg');
      check(data.lengthCm, LIMITS.lengthCm, 'Length', 'cm');
      check(data.headCm, LIMITS.headCm, 'Head size', 'cm');
      if (f.notes.trim()) data.notes = f.notes.trim();

      setSaving(true);
      await onSubmit(data);
    } catch (e: any) {
      Alert.alert('Check this measurement', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: string, onChange: (t: string) => void, placeholder: string, unit: string) => (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder={placeholder} placeholderTextColor={colors.muted} />
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );

  return (
    <View>
      <Text style={styles.label}>Date measured</Text>
      <TextInput
        style={[styles.input, styles.inputSolo]}
        value={f.date}
        onChangeText={t => set('date')(formatDateInput(t))}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.muted}
        keyboardType="number-pad"
        maxLength={10}
      />

      <Text style={[styles.label, { marginTop: 14 }]}>Weight</Text>
      {imp ? (
        <View style={styles.row}>
          {field('', f.lb, set('lb'), '0', 'lb')}
          {field('', f.oz, set('oz'), '0', 'oz')}
        </View>
      ) : (
        <View style={styles.row}>{field('', f.kg, set('kg'), 'e.g. 5.2', 'kg')}</View>
      )}

      <View style={[styles.row, { marginTop: 4 }]}>
        {field('Length / height', f.length, set('length'), imp ? 'e.g. 22' : 'e.g. 57', imp ? 'in' : 'cm')}
        {field('Head size', f.head, set('head'), imp ? 'e.g. 15' : 'e.g. 39', imp ? 'in' : 'cm')}
      </View>
      <Text style={styles.hint}>Fill in any of them. Lying-down length until age 2, standing height after.</Text>

      <Text style={[styles.label, { marginTop: 12 }]}>Notes (optional)</Text>
      <TextInput style={[styles.input, styles.inputSolo, { minHeight: 56 }]} value={f.notes} onChangeText={set('notes')} multiline placeholder="e.g. at the 4-month check-up" placeholderTextColor={colors.muted} />

      <View style={styles.actions}>
        <Pressable onPress={onCancel}><Text style={styles.cancel}>Cancel</Text></Pressable>
        <Pressable style={styles.saveBtn} onPress={submit} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving...' : submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  label: { color: colors.muted, fontSize: 13, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text },
  inputSolo: { flex: 0 },
  unit: { color: colors.muted, fontSize: 13, width: 24 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  cancel: { color: colors.muted, fontSize: 15 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  saveText: { color: colors.onAccent, fontWeight: '700' },
});
