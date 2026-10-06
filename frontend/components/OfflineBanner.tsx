import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useOutboxCount } from '@/hooks/use-live';
import { Palette, useStyles } from '@/lib/theme';

// Thin banner on every screen: offline, and/or entries saved on this phone waiting to be sent.
export function OfflineBanner() {
  const styles = useStyles(makeStyles);
  const [offline, setOffline] = useState(false);
  const waiting = useOutboxCount();

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return () => unsub();
  }, []);

  if (!offline && waiting === 0) return null;
  const entries = `${waiting} ${waiting === 1 ? 'entry' : 'entries'}`;
  const text = offline
    ? waiting > 0
      ? `You're offline. ${entries} saved on this phone will sync when you reconnect.`
      : "You're offline. New entries are saved on this phone and sync when you reconnect."
    : `Syncing ${entries}…`;
  return (
    <View style={[styles.bar, !offline && styles.syncing]} pointerEvents="none">
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.accent, paddingTop: 40, paddingBottom: 8, paddingHorizontal: 16, zIndex: 100 },
  syncing: { backgroundColor: colors.link },
  text: { color: colors.onAccent, fontWeight: '700', textAlign: 'center', fontSize: 13 },
});
