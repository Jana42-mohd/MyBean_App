import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export interface SheetItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

// A bottom sheet of choices (used for chat menus and report reasons)
export function ActionSheet({ visible, title, items, onClose }: { visible: boolean; title?: string; items: SheetItem[]; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {items.map(i => (
            <Pressable key={i.label} style={styles.item} onPress={() => { onClose(); i.onPress(); }}>
              <Text style={[styles.itemText, i.destructive && { color: '#ff9db1' }]}>{i.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.item} onPress={onClose}><Text style={[styles.itemText, { color: '#A4CDD3' }]}>Cancel</Text></Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0f3a41ff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 12, paddingBottom: 30, borderWidth: 1, borderColor: '#2F9BA8' },
  title: { color: '#FED8FE', fontSize: 18, fontWeight: '700', padding: 12, lineHeight: 24 },
  item: { padding: 14 },
  itemText: { color: '#E8FBFF', fontSize: 16 },
});
