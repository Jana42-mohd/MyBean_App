import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { Palette, useStyles } from '@/lib/theme';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const styles = useStyles(makeStyles);
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  // The base styles fix lineHeight at 24-32. A screen that sets a bigger fontSize without its own lineHeight
  // would then have the tops of its letters clipped (iOS cuts text taller than its line box), so scale it.
  const flat = StyleSheet.flatten(style) ?? {};
  const scaledLineHeight =
    flat.fontSize && flat.lineHeight === undefined ? { lineHeight: Math.round(flat.fontSize * 1.3) } : undefined;

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
        scaledLineHeight,
      ]}
      {...rest}
    />
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#0a7ea4',
  },
});
