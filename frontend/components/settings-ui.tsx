import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Children, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, TextInputProps, View } from 'react-native';

// The building blocks of the Settings screen, so every row, switch and button looks the same.
export const C = {
  bg: '#09282eff',
  card: '#0f3a41ff',
  line: '#164a52',
  border: '#2F9BA8',
  text: '#E8FBFF',
  muted: '#A4CDD3',
  pink: '#FED8FE',
  yellow: '#FDFECC',
  danger: '#ff9db1',
  ink: '#09282eff',
};

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

// A titled group of rows in one card, with thin dividers between the rows
export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      {rows.length ? (
        <View style={styles.card}>
          {rows.map((r, i) => (
            <View key={i} style={i > 0 ? styles.divider : undefined}>{r}</View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function IconBadge({ icon, danger }: { icon: IconName; danger?: boolean }) {
  return (
    <View style={[styles.badge, danger && { backgroundColor: 'rgba(255,157,177,0.15)' }]}>
      <MaterialCommunityIcons name={icon} size={18} color={danger ? C.danger : C.yellow} />
    </View>
  );
}

// A row: icon, label (and optional second line), then a value, a custom control, or an arrow when it can be tapped
export function Row({ icon, label, sub, value, onPress, right, danger, busy }: {
  icon?: IconName; label: string; sub?: string; value?: string; onPress?: () => void; right?: ReactNode; danger?: boolean; busy?: boolean;
}) {
  const body = (
    <View style={styles.row}>
      {icon ? <IconBadge icon={icon} danger={danger} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, danger && { color: C.danger }]}>{label}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      {busy ? <ActivityIndicator size="small" color={C.pink} /> : null}
      {!busy && value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
      {right}
      {!busy && onPress && !right ? <MaterialCommunityIcons name="chevron-right" size={22} color={danger ? C.danger : C.muted} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" style={({ pressed }) => pressed && { backgroundColor: 'rgba(254,216,254,0.06)' }}>
      {body}
    </Pressable>
  );
}

export function ToggleRow({ icon, label, sub, value, onValueChange, disabled }: {
  icon?: IconName; label: string; sub?: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <Row
      icon={icon}
      label={label}
      sub={sub}
      right={<Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ false: C.line, true: C.border }} thumbColor={value ? C.pink : '#d9e6e8'} accessibilityLabel={label} />}
    />
  );
}

// − 3 h +
export function StepperRow({ label, value, unit, onMinus, onPlus }: { label: string; value: number; unit: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <Row
      label={label}
      right={
        <View style={styles.stepper}>
          <Pressable onPress={onMinus} hitSlop={10} style={styles.stepBtn} accessibilityLabel={`Less ${label}`}><MaterialCommunityIcons name="minus" size={18} color={C.pink} /></Pressable>
          <Text style={styles.stepValue}>{value} {unit}</Text>
          <Pressable onPress={onPlus} hitSlop={10} style={styles.stepBtn} accessibilityLabel={`More ${label}`}><MaterialCommunityIcons name="plus" size={18} color={C.pink} /></Pressable>
        </View>
      }
    />
  );
}

// Padding for content that sits inside a card but is not a row (inputs, explanations, buttons)
export function Pad({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.pad, style]}>{children}</View>;
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput placeholderTextColor={C.muted} accessibilityLabel={label} style={[styles.input, style]} {...rest} />
    </View>
  );
}

export function Hint({ children, danger }: { children: ReactNode; danger?: boolean }) {
  return <Text style={[styles.hint, danger && { color: C.danger }]}>{children}</Text>;
}

export function Button({ title, onPress, kind = 'primary', busy, disabled, style }: {
  title: string; onPress: () => void; kind?: 'primary' | 'outline' | 'danger'; busy?: boolean; disabled?: boolean; style?: object;
}) {
  const primary = kind === 'primary';
  const danger = kind === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      style={[styles.btn, primary && { backgroundColor: C.pink, borderColor: C.pink }, danger && { borderColor: C.danger }, (busy || disabled) && { opacity: 0.55 }, style]}
    >
      {busy ? <ActivityIndicator size="small" color={primary ? C.ink : C.pink} /> : <Text style={[styles.btnText, primary && { color: C.ink }, danger && { color: C.danger }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 26 },
  sectionTitle: { color: C.pink, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  sectionHint: { color: C.muted, fontSize: 12, lineHeight: 18, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  divider: { borderTopWidth: 1, borderTopColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14, minHeight: 52 },
  badge: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(253,254,204,0.1)', alignItems: 'center', justifyContent: 'center' },
  label: { color: C.text, fontSize: 15, lineHeight: 21 },
  sub: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 1 },
  value: { color: C.muted, fontSize: 14, maxWidth: '45%' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: C.text, fontSize: 14, minWidth: 42, textAlign: 'center' },
  pad: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  fieldLabel: { color: C.muted, fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: C.text, fontSize: 15, backgroundColor: C.bg, justifyContent: 'center' },
  hint: { color: C.muted, fontSize: 12, lineHeight: 18 },
  btn: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  btnText: { color: C.text, fontWeight: '700', fontSize: 14 },
});
