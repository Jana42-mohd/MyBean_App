import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Palette, useStyles, useTheme } from '@/lib/theme';

export interface SheetItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  selected?: boolean; // shows a check mark (for choosing one option from a list)
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
          <ScrollView style={{ maxHeight: 420 }} bounces={false}>
            {items.map(i => (
              <Pressable key={i.label} style={[styles.item, styles.itemRow]} onPress={() => { onClose(); i.onPress(); }} accessibilityRole="button" accessibilityState={{ selected: !!i.selected }}>
                <Text style={[styles.itemText, i.destructive && { color: colors.danger }, i.selected && styles.itemSelected]}>{i.label}</Text>
                {i.selected ? <MaterialCommunityIcons name="check" size={20} color={colors.accentText} /> : null}
              </Pressable>
            ))}
          </ScrollView>
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
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemText: { color: colors.text, fontSize: 16 },
  itemSelected: { fontWeight: '700' },
});
