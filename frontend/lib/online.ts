import NetInfo from '@react-native-community/netinfo';

export async function isOnline(): Promise<boolean> {
  try {
    const s = await NetInfo.fetch();
    return s.isConnected !== false && s.isInternetReachable !== false;
  } catch {
    return true; // cannot tell: try for real
  }
}
