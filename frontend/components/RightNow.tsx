import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ALL_BABIES } from '@/components/BabyPicker';
import { friendlyError } from '@/components/LoadError';
import { useLiveRefresh, useOutboxCount } from '@/hooks/use-live';
import { Baby } from '@/lib/babies';
import { getMyId } from '@/lib/liveSync';
import { logEntryEx, undoEntry } from '@/lib/logActions';
import { LogRow } from '@/lib/logs';
import { BabyStatus, computeStatuses, gapText, nextFeedText } from '@/lib/rightNow';
import { wakeUp } from '@/lib/sleepActions';
import { ActiveSleep, discardSleep, getActiveSleeps, startSleeps, withPendingSleeps } from '@/lib/timer';
import { formatDuration, timeAgo } from '@/lib/time';
import { Palette, useStyles, useTheme } from '@/lib/theme';

// The top of Home: for each baby, what is happening right now, and one-tap buttons for what a parent does most.
// Everything shown comes from the household's own entries (see lib/rightNow.ts).
export function RightNow({
  babies, selected, rows, onChanged, onToast, onShown,
}: {
  babies: Baby[];                 // born babies
  selected: string;               // baby picker value on Home
  rows: LogRow[];                 // the last week of entries
  onChanged: () => void;
  onToast: (message: string, undo?: () => Promise<void>) => void;
  onShown?: (babyIds: string[]) => void;   // which babies this card is showing (their sleep banner is hidden further down)
}) {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const [serverSleeps, setServerSleeps] = useState<ActiveSleep[]>([]);
  const pending = useOutboxCount();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sleeps = useMemo(() => withPendingSleeps(serverSleeps, getMyId()), [serverSleeps, pending]);
  const [now, setNow] = useState(() => new Date());

  const shown = useMemo(() => (selected === ALL_BABIES ? babies : babies.filter(b => b.id === selected)).slice(0, 4), [babies, selected]);
  useEffect(() => { onShown?.(shown.map(b => b.id)); }, [shown, onShown]);

  const loadSleeps = useCallback(async () => {
    try {
      setServerSleeps(await getActiveSleeps());
    } catch {
      /* offline: keep what we have */
    }
  }, []);
  useFocusEffect(useCallback(() => { loadSleeps(); }, [loadSleeps]));
  useLiveRefresh(loadSleeps, 150);

  // the "x ago" wording stays fresh without anyone touching the screen
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const statuses = useMemo(() => computeStatuses(shown, rows, sleeps, now), [shown, rows, sleeps, now]);
  if (shown.length === 0) return null;

  const logNow = async (baby: Baby, type: 'feeding' | 'diaper', data: any, label: string) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const iso = new Date().toISOString();
      const { ids, queued } = await logEntryEx(type, { ...data, time: iso }, [{ id: baby.id, name: baby.name }], iso);
      onToast(`${label} for ${baby.name}${queued ? ' (saved offline, will sync)' : ''}`, () => undoEntry(type, ids, [{ id: baby.id, name: baby.name }]));
      onChanged();
    } catch (e) {
      onToast(`Could not save: ${friendlyError(e)}`);
    }
  };

  const startSleep = async (baby: Baby) => {
    try {
      Haptics.selectionAsync();
      const { queued } = await startSleeps([{ id: baby.id, name: baby.name }]);
      await loadSleeps();
      onToast(`Sleep timer started for ${baby.name}${queued ? ' (saved offline, will sync)' : ''}`);
    } catch (e) {
      onToast(`Could not start the timer: ${friendlyError(e)}`);
    }
  };

  const wake = (baby: Baby) => {
    const sl = sleeps.find(s => s.baby_id === baby.id);
    if (sl) wakeUp(sl, { toast: onToast, changed: onChanged, reloadSleeps: loadSleeps });
  };

  const discard = async (baby: Baby) => {
    try {
      await discardSleep(baby.id);
      await loadSleeps();
    } catch (e) {
      onToast(`Could not discard: ${friendlyError(e)}`);
    }
  };

  const minutesSince = (d: Date) => Math.max(0, (now.getTime() - d.getTime()) / 60000);

  const Card = ({ s, baby }: { s: BabyStatus; baby: Baby }) => {
    const asleep = !!s.asleepSince;
    return (
      <View style={[styles.card, asleep && styles.cardAsleep]}>
        <View style={styles.top}>
          <Text style={[styles.name, asleep && { color: colors.onAccent }]}>{shown.length > 1 ? baby.name : 'Right now'}</Text>
          <View style={[styles.state, asleep ? styles.stateAsleep : styles.stateAwake]}>
            <MaterialCommunityIcons name={asleep ? 'weather-night' : 'white-balance-sunny'} size={14} color={asleep ? colors.link : colors.onAccent} />
            <Text style={[styles.stateText, asleep ? { color: colors.link } : { color: colors.onAccent }]}>
              {asleep ? `Asleep ${formatDuration(minutesSince(s.asleepSince!))}` : s.awakeSince ? `Awake ${formatDuration(minutesSince(s.awakeSince))}` : 'Awake'}
            </Text>
          </View>
        </View>

        <View style={styles.line}>
          <MaterialCommunityIcons name="baby-bottle-outline" size={18} color={asleep ? colors.onAccent : colors.link} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.lineMain, asleep && { color: colors.onAccent }]}>
              {s.lastFeeding ? `Fed ${timeAgo(s.lastFeeding.at, now)}${s.lastFeeding.method ? ` · ${s.lastFeeding.method}` : ''}${s.lastFeeding.amount ? ` · ${s.lastFeeding.amount}` : ''}` : 'No feedings logged yet'}
            </Text>
            {s.lastFeeding && (s.feedGapMinutes || s.nextFeedAt) ? (
              <Text style={[styles.lineSub, asleep && { color: colors.onAccent }]}>
                {s.feedGapMinutes ? `Usually every ${gapText(s.feedGapMinutes)}` : 'Next feeding planned'}{s.nextFeedAt ? ` · next ${nextFeedText(s.nextFeedAt, now)}` : ''}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.line}>
          <MaterialCommunityIcons name="baby-face-outline" size={18} color={asleep ? colors.onAccent : colors.link} />
          <Text style={[styles.lineMain, asleep && { color: colors.onAccent }]}>
            {s.lastDiaper ? `Diaper ${timeAgo(s.lastDiaper.at, now)}${s.lastDiaper.type ? ` · ${s.lastDiaper.type}` : ''}` : 'No diapers logged yet'}
          </Text>
        </View>

        <View style={styles.actions}>
          {asleep ? (
            <>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => wake(baby)} accessibilityRole="button"><MaterialCommunityIcons name="white-balance-sunny" size={16} color={colors.onAccent} /><Text style={[styles.btnText, { color: colors.onAccent }]}>Woke up</Text></Pressable>
              <Pressable style={styles.btnGhost} onPress={() => discard(baby)} hitSlop={8}><Text style={styles.ghostText}>Discard</Text></Pressable>
            </>
          ) : (
            <>
              {s.lastFeeding?.method ? (
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => logNow(baby, 'feeding', { method: s.lastFeeding!.method, amount: s.lastFeeding!.amount }, 'Logged feeding')} accessibilityRole="button" accessibilityLabel={`Feed again, ${s.lastFeeding.method}`}>
                  <Text style={[styles.btnText, { color: colors.onAccent }]} numberOfLines={1}>Fed again</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.btn} onPress={() => logNow(baby, 'diaper', { type: 'pee' }, 'Logged pee diaper')} accessibilityRole="button"><Text style={styles.btnText}>Pee</Text></Pressable>
              <Pressable style={styles.btn} onPress={() => logNow(baby, 'diaper', { type: 'poop' }, 'Logged poop diaper')} accessibilityRole="button"><Text style={styles.btnText}>Poop</Text></Pressable>
              <Pressable style={styles.btn} onPress={() => startSleep(baby)} accessibilityRole="button"><MaterialCommunityIcons name="weather-night" size={15} color={colors.link} /><Text style={styles.btnText}>Sleep</Text></Pressable>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      {statuses.map(s => <Card key={s.babyId} s={s} baby={shown.find(b => b.id === s.babyId)!} />)}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { gap: 12, marginBottom: 20 },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  cardAsleep: { backgroundColor: colors.highlight, borderColor: colors.highlight },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { color: colors.heading, fontSize: 17, fontWeight: '700', flexShrink: 1 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10 },
  stateAwake: { backgroundColor: colors.accent },
  stateAsleep: { backgroundColor: colors.bg },
  stateText: { fontSize: 12, fontWeight: '700' },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  lineMain: { color: colors.text, fontSize: 14, lineHeight: 20 },
  lineSub: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6, minHeight: 42 },
  btnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent, flexGrow: 1.4 },
  btnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  btnGhost: { paddingVertical: 8, paddingHorizontal: 6 },
  ghostText: { color: colors.onAccent, fontSize: 12, textDecorationLine: 'underline' },
});
