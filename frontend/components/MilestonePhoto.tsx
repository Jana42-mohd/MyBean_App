import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Palette, useStyles } from '@/lib/theme';

// A milestone photo. Shown through a short-lived private link; `path` doubles as the cache key so it is kept on the phone.
export function MilestonePhoto({ path, url, height = 180 }: { path: string; url?: string; height?: number }) {
  const styles = useStyles(makeStyles);
  if (!url) {
    return (
      <View style={[styles.box, { height }]}>
        <Text style={styles.hint}>Photo unavailable{'\n'}(needs a connection)</Text>
      </View>
    );
  }
  return <Image source={{ uri: url, cacheKey: path }} style={[styles.box, { height }]} contentFit="cover" accessibilityLabel="Milestone photo" />;
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  box: { width: '100%', borderRadius: 12, backgroundColor: colors.bg, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
