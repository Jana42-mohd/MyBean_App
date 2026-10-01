import { Pressable, StyleSheet, Text, View } from 'react-native';

// Friendly message for failed loads. Network failures get a plain-language explanation.
export function friendlyError(e: any): string {
  const msg = String(e?.message ?? e ?? '');
  if (/network|fetch|timed? ?out|offline|failed to connect/i.test(msg)) {
    return "Can't reach the server. Check your internet connection and try again.";
  }
  return msg || 'Something went wrong. Please try again.';
}

export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
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

const styles = StyleSheet.create({
  box: { backgroundColor: '#3a1f2a', borderColor: '#FED8FE', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16 },
  text: { color: '#E8FBFF', fontSize: 14, lineHeight: 20 },
  btn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#FED8FE', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  btnText: { color: '#09282eff', fontWeight: '700' },
});
