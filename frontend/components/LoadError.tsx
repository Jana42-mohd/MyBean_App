import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Palette, useStyles } from '@/lib/theme';

// Friendly message for failed loads. Network failures get a plain-language explanation.
export function friendlyError(e: any): string {
  const msg = String(e?.message ?? e ?? '');
  if (/network|fetch|timed? ?out|offline|failed to connect/i.test(msg)) {
    return "Can't reach the server. Check your internet connection and try again.";
  }
  return msg || 'Something went wrong. Please try again.';
}

export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{message}</Text>
      {onRetry ? (
        <Pressable style={styles.btn} onPress={onRetry}>
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  box: { backgroundColor: colors.errorBg, borderColor: colors.accent, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16 },
  text: { color: colors.text, fontSize: 14, lineHeight: 20 },
  btn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  btnText: { color: colors.onAccent, fontWeight: '700' },
});
