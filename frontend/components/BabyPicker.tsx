import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { Baby } from '@/lib/babies';

export const ALL_BABIES = 'all';

// Row of chips: "All" (when more than one baby) plus one chip per baby. Renders nothing for a single baby.
export function BabyPicker({
  babies,
  value,
  onChange,
  allLabel = 'All babies',
}: {
  babies: Baby[];
  value: string;
  onChange: (id: string) => void;
  allLabel?: string;
}) {
  if (babies.length < 2) return null;
  const items = [{ id: ALL_BABIES, name: allLabel }, ...babies];
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

const styles = StyleSheet.create({
  scroll: { marginBottom: 16, flexGrow: 0 },
  content: { gap: 8, paddingRight: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#0f3a41ff', borderWidth: 1, borderColor: '#2F9BA8' },
  active: { backgroundColor: '#FED8FE', borderColor: '#FED8FE' },
  text: { color: '#E8FBFF', fontWeight: '600', fontSize: 13 },
  activeText: { color: '#09282eff' },
});
