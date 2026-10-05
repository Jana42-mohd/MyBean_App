import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COUNTRIES } from '@/lib/countries';

export function CountryPicker({ visible, onPick, onClose }: { visible: boolean; onPick: (code: string) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? COUNTRIES.filter(c => c.name.toLowerCase().includes(needle)) : COUNTRIES;
  }, [q]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose your country</Text>
          <Pressable onPress={onClose} hitSlop={10}><Text style={styles.close}>Close</Text></Pressable>
        </View>
        <TextInput style={styles.input} value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor="#A4CDD3" autoCorrect={false} />
        <FlatList
          data={list}
          keyExtractor={c => c.code}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => { setQ(''); onPick(item.code); }}>
              <Text style={styles.rowText}>{item.name}</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09282eff', paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: '#FED8FE', fontSize: 20, fontWeight: '700', lineHeight: 26 },
  close: { color: '#A4CDD3', fontSize: 15 },
  input: { borderWidth: 1, borderColor: '#2F9BA8', borderRadius: 10, padding: 12, color: '#E8FBFF', marginBottom: 8 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#164a52' },
  rowText: { color: '#E8FBFF', fontSize: 16 },
});
