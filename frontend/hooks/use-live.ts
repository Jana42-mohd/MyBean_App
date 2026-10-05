import { useCallback, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { LiveEvent, LiveStatus, getLiveStatus, onLiveChange, onLiveStatus } from '@/lib/liveSync';
import { getPendingCount, subscribeOutbox } from '@/lib/outbox';

// Re-run `reload` (debounced) whenever the household's data changes, while this screen is focused.
export function useLiveRefresh(reload: () => void, delayMs = 400) {
  useFocusEffect(
    useCallback(() => {
      let t: ReturnType<typeof setTimeout> | undefined;
      const off = onLiveChange(() => {
        if (t) clearTimeout(t);
        t = setTimeout(reload, delayMs);
      });
      return () => {
        if (t) clearTimeout(t);
        off();
      };
    }, [reload, delayMs])
  );
}

// Raw events (for "Blake logged a feeding" style notices), while this screen is focused.
export function useLiveEvents(handler: (e: LiveEvent) => void) {
  useFocusEffect(useCallback(() => onLiveChange(handler), [handler]));
}

export function useLiveStatus(): LiveStatus {
  return useSyncExternalStore(onLiveStatus, getLiveStatus, getLiveStatus);
}

// How many entries are saved on this phone and still waiting to be sent
export function useOutboxCount(): number {
  return useSyncExternalStore(subscribeOutbox, getPendingCount, getPendingCount);
}
