import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Palette, useStyles, useTheme } from '@/lib/theme';

export interface SheetItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

// A bottom sheet of choices (used for chat menus and report reasons)
export function ActionSheet({ visible, title, items, onClose }: { visible: boolean; title?: string; items: SheetItem[]; onClose: () => void }) {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {items.map(i => (
            <Pressable key={i.label} style={styles.item} onPress={() => { onClose(); i.onPress(); }}>
              <Text style={[styles.itemText, i.destructive && { color: colors.danger }]}>{i.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.item} onPress={onClose}><Text style={[styles.itemText, { color: colors.muted }]}>Cancel</Text></Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 12, paddingBottom: 30, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.heading, fontSize: 18, fontWeight: '700', padding: 12, lineHeight: 24 },
  item: { padding: 14 },
  itemText: { color: colors.text, fontSize: 16 },
});
