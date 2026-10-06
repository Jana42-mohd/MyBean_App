import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { flush, getPendingCount } from './outbox';

// When to try sending what is waiting: right now, whenever the phone regains a connection,
// when the app comes back to the front, and every 30 seconds while something is stuck
// (some connections say "online" before they actually work).
export function startOutboxTriggers(): () => void {
  const tryFlush = () => {
    flush().catch(() => {});
  };
  tryFlush();
  const unsubNet = NetInfo.addEventListener(s => {
    if (s.isConnected && s.isInternetReachable !== false) tryFlush();
  });
  const appSub = AppState.addEventListener('change', st => {
    if (st === 'active') tryFlush();
  });
  const timer = setInterval(() => {
    if (getPendingCount() > 0) tryFlush();
  }, 30000);
  return () => {
    unsubNet();
    appSub.remove();
    clearInterval(timer);
  };
}
