import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Children, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, TextInputProps, View } from 'react-native';
import { Palette, useStyles, useTheme } from '@/lib/theme';

// The building blocks of the Settings screen, so every row, switch and button looks the same.
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

// A titled group of rows in one card, with thin dividers between the rows
export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const styles = useStyles(makeStyles);
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
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.badge, danger && { backgroundColor: colors.errorBg }]}>
      <MaterialCommunityIcons name={icon} size={18} color={danger ? colors.danger : colors.link} />
    </View>
  );
}

// A row: icon, label (and optional second line), then a value, a custom control, or an arrow when it can be tapped
export function Row({ icon, label, sub, value, onPress, right, danger, busy }: {
  icon?: IconName; label: string; sub?: string; value?: string; onPress?: () => void; right?: ReactNode; danger?: boolean; busy?: boolean;
}) {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const body = (
    <View style={styles.row}>
      {icon ? <IconBadge icon={icon} danger={danger} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, danger && { color: colors.danger }]}>{label}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      {busy ? <ActivityIndicator size="small" color={colors.accent} /> : null}
      {!busy && value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
      {right}
      {!busy && onPress && !right ? <MaterialCommunityIcons name="chevron-right" size={22} color={danger ? colors.danger : colors.muted} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" style={({ pressed }) => pressed && { backgroundColor: colors.soft }}>
      {body}
    </Pressable>
  );
}

export function ToggleRow({ icon, label, sub, value, onValueChange, disabled }: {
  icon?: IconName; label: string; sub?: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean;
}) {
  const colors = useTheme();
  return (
    <Row
      icon={icon}
      label={label}
      sub={sub}
      right={<Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ false: colors.line, true: colors.border }} thumbColor={value ? colors.accent : '#d9e6e8'} accessibilityLabel={label} />}
    />
  );
}

// − 3 h +
export function StepperRow({ label, value, unit, onMinus, onPlus }: { label: string; value: number; unit: string; onMinus: () => void; onPlus: () => void }) {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Row
      label={label}
      right={
        <View style={styles.stepper}>
          <Pressable onPress={onMinus} hitSlop={10} style={styles.stepBtn} accessibilityLabel={`Less ${label}`}><MaterialCommunityIcons name="minus" size={18} color={colors.accent} /></Pressable>
          <Text style={styles.stepValue}>{value} {unit}</Text>
          <Pressable onPress={onPlus} hitSlop={10} style={styles.stepBtn} accessibilityLabel={`More ${label}`}><MaterialCommunityIcons name="plus" size={18} color={colors.accent} /></Pressable>
        </View>
      }
    />
  );
}

// Padding for content that sits inside a card but is not a row (inputs, explanations, buttons)
export function Pad({ children, style }: { children: ReactNode; style?: object }) {
  const styles = useStyles(makeStyles);
  return <View style={[styles.pad, style]}>{children}</View>;
}

export function Field(props: TextInputProps & { label?: string }) {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const { label, style, ...rest } = props;
  return (
    <View>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.muted} accessibilityLabel={label} style={[styles.input, style]} {...rest} />
    </View>
  );
}

// A row of choices where exactly one is selected (e.g. System / Light / Dark)
export function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void }) {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup">
      {options.map(o => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} style={[styles.segment, on && styles.segmentOn]} onPress={() => onChange(o.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
            {o.icon ? <MaterialCommunityIcons name={o.icon} size={16} color={on ? colors.onAccent : colors.muted} /> : null}
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Hint({ children, danger }: { children: ReactNode; danger?: boolean }) {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  return <Text style={[styles.hint, danger && { color: colors.danger }]}>{children}</Text>;
}

export function Button({ title, onPress, kind = 'primary', busy, disabled, style }: {
  title: string; onPress: () => void; kind?: 'primary' | 'outline' | 'danger'; busy?: boolean; disabled?: boolean; style?: object;
}) {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const primary = kind === 'primary';
  const danger = kind === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      style={[styles.btn, primary && { backgroundColor: colors.accent, borderColor: colors.accent }, danger && { borderColor: colors.danger }, (busy || disabled) && { opacity: 0.55 }, style]}
    >
      {busy ? <ActivityIndicator size="small" color={primary ? colors.onAccent : colors.accent} /> : <Text style={[styles.btnText, primary && { color: colors.onAccent }, danger && { color: colors.danger }]}>{title}</Text>}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  section: { marginBottom: 26 },
  sectionTitle: { color: colors.link, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  sectionHint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14, minHeight: 52 },
  badge: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.text, fontSize: 15, lineHeight: 21 },
  sub: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 1 },
  value: { color: colors.muted, fontSize: 14, maxWidth: '45%' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: colors.text, fontSize: 14, minWidth: 42, textAlign: 'center' },
  pad: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  fieldLabel: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: colors.text, fontSize: 15, backgroundColor: colors.bg, justifyContent: 'center' },
  segmented: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colors.line },
  segment: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 9 },
  segmentOn: { backgroundColor: colors.accent },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  segmentTextOn: { color: colors.onAccent },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  btn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  btnText: { color: colors.text, fontWeight: '700', fontSize: 14 },
});
