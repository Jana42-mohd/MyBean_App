import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Thin banner shown on every screen while the phone has no internet connection.
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return () => unsub();
  }, []);

  if (!offline) return null;
  return (
    <View style={styles.bar} pointerEvents="none">
      <Text style={styles.text}>You're offline. Changes can't be saved until you reconnect.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#FED8FE', paddingTop: 40, paddingBottom: 8, paddingHorizontal: 16, zIndex: 100 },
  text: { color: '#09282eff', fontWeight: '700', textAlign: 'center', fontSize: 13 },
});
