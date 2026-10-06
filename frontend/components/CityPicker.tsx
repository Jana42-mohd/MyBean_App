import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CityOption, searchCities } from '@/lib/cities';
import { citiesOf } from '@/lib/citiesData';
import { countryName } from '@/lib/countries';
import { Palette, useStyles } from '@/lib/theme';

// Choose your city from a list, so that everyone writes it the same way. A town that is not in the list can be typed.
export function CityPicker({ visible, country, onPick, onClose }: { visible: boolean; country: string | null; onPick: (c: CityOption) => void; onClose: () => void }) {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const data = visible ? citiesOf(country) : null;
  const results = useMemo(() => searchCities(data, q), [data, q]);
  const typed = q.trim();
  const exact = typed && results.some(r => r.name.toLowerCase() === typed.toLowerCase());

  const done = (c: CityOption) => { setQ(''); onPick(c); };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Your city in {countryName(country) || 'your country'}</Text>
          <Pressable onPress={onClose} hitSlop={10}><Text style={styles.close}>Close</Text></Pressable>
        </View>
        <TextInput style={styles.input} value={q} onChangeText={setQ} placeholder="Start typing your city or town" placeholderTextColor={styles.placeholder.color} autoCorrect={false} autoFocus />
        <FlatList
          data={results}
          keyExtractor={(c, i) => `${c.name}|${c.region}|${i}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => done(item)}>
              <Text style={styles.rowText}>{item.name}</Text>
              {item.region ? <Text style={styles.region}>{item.region}</Text> : null}
            </Pressable>
          )}
          ListFooterComponent={
            typed && !exact ? (
              <Pressable style={styles.row} onPress={() => done({ name: typed, region: '' })}>
                <Text style={styles.rowText}>Use "{typed}"</Text>
                <Text style={styles.region}>Not in the list? Type it yourself. You will match other parents who wrote it the same way.</Text>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={typed ? null : <Text style={styles.region}>The biggest cities are listed first.</Text>}
        />
        <Text style={styles.credit}>City list: GeoNames (CC BY 4.0)</Text>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 },
  title: { color: colors.heading, fontSize: 20, fontWeight: '700', lineHeight: 26, flex: 1 },
  close: { color: colors.muted, fontSize: 15 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, marginBottom: 8, backgroundColor: colors.card },
  placeholder: { color: colors.muted },
  row: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowText: { color: colors.text, fontSize: 16 },
  region: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  credit: { color: colors.muted, fontSize: 10, textAlign: 'center', paddingVertical: 6 },
});
