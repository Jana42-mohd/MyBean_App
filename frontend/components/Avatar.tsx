import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Palette, useStyles } from '@/lib/theme';

export function Avatar({ name, url, size = 44 }: { name: string; url?: string | null; size?: number }) {
  const styles = useStyles(makeStyles);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (url) return <Image source={{ uri: url }} style={box} contentFit="cover" accessibilityLabel={`${name}'s photo`} />;
  return (
    <View style={[styles.fallback, box]}>
      <Text style={[styles.initial, { fontSize: size * 0.42, lineHeight: size * 0.6 }]}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  fallback: { backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.onAccent, fontWeight: '700' },
});
