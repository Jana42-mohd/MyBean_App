import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { Baby } from '@/lib/babies';
import { Palette, useStyles } from '@/lib/theme';

export const ALL_BABIES = 'all';

// Row of chips: "All" (when more than one baby) plus one chip per baby. Renders nothing for a single baby.
export function BabyPicker({
  babies,
  value,
  onChange,
  allLabel = 'All babies',
  showAll = true,
}: {
  babies: Baby[];
  value: string;
  onChange: (id: string) => void;
  allLabel?: string;
  showAll?: boolean; // false: only the individual babies
}) {
  const styles = useStyles(makeStyles);
  if (babies.length < 2) return null;
  const items = showAll ? [{ id: ALL_BABIES, name: allLabel }, ...babies] : babies;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.content}>
      {items.map(b => (
        <Pressable key={b.id} onPress={() => onChange(b.id)} style={[styles.chip, value === b.id && styles.active]}>
          <Text style={[styles.text, value === b.id && styles.activeText]}>{b.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  scroll: { marginBottom: 16, flexGrow: 0 },
  content: { gap: 8, paddingRight: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  active: { backgroundColor: colors.accent, borderColor: colors.accent },
  text: { color: colors.text, fontWeight: '600', fontSize: 13 },
  activeText: { color: colors.onAccent },
});
