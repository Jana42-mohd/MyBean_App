import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ALL_BABIES, BabyPicker } from '@/components/BabyPicker';
import { friendlyError } from '@/components/LoadError';
import { useLiveRefresh, useOutboxCount } from '@/hooks/use-live';
import { Baby, babyNames } from '@/lib/babies';
import { getMyId } from '@/lib/liveSync';
import { logEntryEx, undoEntry } from '@/lib/logActions';
import { LogRow, LogType } from '@/lib/logs';
import { computeStatus } from '@/lib/rightNow';
import { ActiveSleep, discardSleep, formatElapsed, getActiveSleeps, startSleeps, withPendingSleeps } from '@/lib/timer';
import { wakeUp } from '@/lib/sleepActions';
import { Palette, useStyles, useTheme } from '@/lib/theme';

type Sheet = null | 'feeding' | 'diaper' | 'sleep';
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const AGO_CHOICES = [
  { minutes: 0, label: 'Now' },
  { minutes: 10, label: '10 min ago' },
  { minutes: 20, label: '20 min ago' },
  { minutes: 30, label: '30 min ago' },
  { minutes: 60, label: '1 h ago' },
  { minutes: 120, label: '2 h ago' },
];

function Card({ icon, label, onPress, highlight }: { icon: IconName; label: string; onPress: () => void; highlight?: boolean }) {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable style={[styles.card, highlight && styles.cardActive]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <MaterialCommunityIcons name={icon} size={26} color={highlight ? colors.onAccent : colors.link} />
      <Text style={[styles.label, highlight && { color: colors.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

export function QuickLog({
  babies,
  selected,
  onChanged,
  onToast,
  rows = [],
}: {
  babies: Baby[]; // born babies only
  selected: string; // baby picker value on Home
  onChanged: () => void; // reload Home after something was logged
  onToast: (message: string, undo?: () => Promise<void>) => void;
  rows?: LogRow[]; // the last week of entries: used to offer "same as last time"
}) {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [target, setTarget] = useState(ALL_BABIES);
  const [amount, setAmount] = useState('');
  const [ago, setAgo] = useState(0); // minutes ago, for something that happened a little while back
  const [serverSleeps, setServerSleeps] = useState<ActiveSleep[]>([]);
  const pending = useOutboxCount(); // re-derive the list when entries are queued or sent
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sleeps = useMemo(() => withPendingSleeps(serverSleeps, getMyId()), [serverSleeps, pending]);
  const [now, setNow] = useState(() => Date.now());
  const disabled = babies.length === 0;
  const asleepIds = new Set(sleeps.map(x => x.baby_id));
  const awake = babies.filter(b => !asleepIds.has(b.id));

  // Sleep timers are shared with the household: load on focus, and again whenever a partner changes one
  const loadSleeps = useCallback(async () => {
    try {
      setServerSleeps(await getActiveSleeps());
    } catch {
      /* offline: keep what we have */
    }
  }, []);
  useFocusEffect(useCallback(() => { loadSleeps(); }, [loadSleeps]));
  useLiveRefresh(loadSleeps, 150);

  // tick once a second while anyone is asleep
  useEffect(() => {
    if (sleeps.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sleeps.length]);

  const targets = useCallback(
    (pool: Baby[]) => (target === ALL_BABIES ? pool : pool.filter(b => b.id === target)),
    [target]
  );

  const open = (s: Exclude<Sheet, null>) => {
    Haptics.selectionAsync();
    const pool = s === 'sleep' ? awake : babies;
    setTarget(pool.length === 1 ? pool[0].id : selected !== ALL_BABIES && pool.some(b => b.id === selected) ? selected : ALL_BABIES);
    setAmount('');
    setAgo(0);
    setSheet(s);
  };

  const save = async (type: LogType, data: any, label: string) => {
    const who = targets(babies);
    if (who.length === 0) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const iso = new Date(Date.now() - ago * 60_000).toISOString();
      const { ids, queued } = await logEntryEx(type, { ...data, time: iso }, who, iso);
      setSheet(null);
      onToast(`${label} for ${babyNames(who)}${queued ? ' (saved offline, will sync)' : ''}`, () => undoEntry(type, ids, who));
      onChanged();
    } catch (e) {
      onToast(`Could not save: ${friendlyError(e)}`);
    }
  };

  const beginSleep = async (who: Baby[]) => {
    if (who.length === 0) return;
    try {
      Haptics.selectionAsync();
      const { queued } = await startSleeps(who.map(b => ({ id: b.id, name: b.name })));
      setSheet(null);
      await loadSleeps();
      onToast(`Sleep timer started for ${babyNames(who)}${queued ? ' (saved offline, will sync)' : ''}`);
    } catch (e) {
      onToast(`Could not start the timer: ${friendlyError(e)}`);
    }
  };

  const onSleepCard = () => {
    if (awake.length === 0) {
      onToast('Everyone is already asleep. Use "Woke up" on the timer above.');
      return;
    }
    if (awake.length === 1) beginSleep(awake);
    else open('sleep');
  };

  const wake = (sl: ActiveSleep) => wakeUp(sl, { toast: onToast, changed: onChanged, reloadSleeps: loadSleeps });

  const discard = async (sl: ActiveSleep) => {
    try {
      await discardSleep(sl.baby_id);
      await loadSleeps();
    } catch (e) {
      onToast(`Could not discard: ${friendlyError(e)}`);
    }
  };

  const me = getMyId();
  // what this baby had last time (only when a single baby is chosen)
  const single = targets(babies).length === 1 ? targets(babies)[0] : null;
  const lastFeed = single ? computeStatus(single, rows, [], new Date()).lastFeeding : null;

  return (
    <View>
      {sleeps.map(sl => (
        <View key={sl.baby_id} style={styles.banner}>
          <MaterialCommunityIcons name="weather-night" size={24} color={colors.onAccent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>
              {sl.baby_name} is sleeping{sl.started_by !== me ? ` (started by ${sl.started_by_name})` : ''}
            </Text>
            <Text style={styles.bannerTime}>{formatElapsed(sl.started_at, now)}</Text>
          </View>
          <Pressable style={styles.bannerBtn} onPress={() => wake(sl)}>
            <Text style={styles.bannerBtnText}>Woke up</Text>
          </Pressable>
          <Pressable onPress={() => discard(sl)} hitSlop={10}>
            <Text style={styles.bannerCancel}>Discard</Text>
          </Pressable>
        </View>
      ))}

      <View style={[styles.grid, disabled && { opacity: 0.45 }]} pointerEvents={disabled ? 'none' : 'auto'}>
        <Card icon="baby-bottle-outline" label="Feeding" onPress={() => open('feeding')} />
        <Card icon="baby-face-outline" label="Diaper" onPress={() => open('diaper')} />
        <Card icon="weather-night" label={sleeps.length ? 'Sleeping…' : 'Sleep'} onPress={onSleepCard} highlight={sleeps.length > 0} />
        <Card icon="water-outline" label="Pumping" onPress={() => router.push('/(tabs)/track')} />
        <Card icon="star-outline" label="Milestones" onPress={() => router.push('/(tabs)/track')} />
        <Card icon="emoticon-happy-outline" label="Mood & Behaviour" onPress={() => router.push('/(tabs)/track')} />
      </View>
      {disabled ? <Text style={styles.hint}>Quick logging unlocks once your baby is born.</Text> : null}

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {sheet === 'feeding' ? 'Log a feeding' : sheet === 'diaper' ? 'Log a diaper' : 'Who is going to sleep?'}
            </Text>
            <BabyPicker babies={sheet === 'sleep' ? awake : babies} value={target} onChange={setTarget} allLabel="All babies" />

            {sheet === 'feeding' || sheet === 'diaper' ? (
              <>
                <Text style={styles.sheetHint}>When was it?</Text>
                <View style={styles.whenRow}>
                  {AGO_CHOICES.map(c => (
                    <Pressable key={c.minutes} style={[styles.when, ago === c.minutes && styles.whenOn]} onPress={() => setAgo(c.minutes)} accessibilityRole="button" accessibilityState={{ selected: ago === c.minutes }}>
                      <Text style={[styles.whenText, ago === c.minutes && styles.whenTextOn]}>{c.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {sheet === 'feeding' && lastFeed && targets(babies).length === 1 ? (
              <Pressable style={styles.same} onPress={() => save('feeding', { method: lastFeed.method, amount: lastFeed.amount }, 'Logged feeding')}>
                <MaterialCommunityIcons name="repeat" size={18} color={colors.onAccent} />
                <Text style={styles.sameText} numberOfLines={1}>Same as last time: {[lastFeed.method, lastFeed.amount].filter(Boolean).join(' · ')}</Text>
              </Pressable>
            ) : null}

            {sheet === 'feeding' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder={lastFeed?.amount ? `Amount (optional), last time ${lastFeed.amount}` : 'Amount (optional), e.g. 4 oz'}
                  placeholderTextColor={colors.muted}
                  value={amount}
                  onChangeText={setAmount}
                />
                <Text style={styles.sheetHint}>Tap how baby was fed. It saves right away.</Text>
                <View style={styles.optRow}>
                  {(['breast', 'formula', 'mixed'] as const).map(m => (
                    <Pressable key={m} style={styles.opt} onPress={() => save('feeding', { method: m, amount: amount.trim() || undefined }, 'Logged feeding')}>
                      <Text style={[styles.optText, lastFeed?.method === m && styles.optTextLast]}>{m}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {sheet === 'diaper' ? (
              <>
                <Text style={styles.sheetHint}>Tap what you found. It saves right away.</Text>
                <View style={styles.optRow}>
                  {(['pee', 'poop'] as const).map(t => (
                    <Pressable key={t} style={styles.opt} onPress={() => save('diaper', { type: t }, `Logged ${t} diaper`)}>
                      <Text style={styles.optText}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {sheet === 'sleep' ? (
              <Pressable style={[styles.opt, { marginTop: 12 }]} onPress={() => beginSleep(targets(awake))}>
                <Text style={styles.optText}>Start sleep timer</Text>
              </Pressable>
            ) : null}

            <Pressable onPress={() => setSheet(null)} style={{ paddingTop: 14 }}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 92,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: colors.link,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardActive: { backgroundColor: colors.highlight },
  label: { fontSize: 11, color: colors.text, fontWeight: '600', textAlign: 'center' },
  hint: { color: colors.muted, fontSize: 12, marginTop: 8 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.highlight, borderRadius: 14, padding: 12, marginBottom: 12 },
  bannerTitle: { color: colors.onAccent, fontWeight: '700', fontSize: 14 },
  bannerTime: { color: colors.onAccent, fontSize: 20, fontWeight: '700', lineHeight: 26 },
  bannerBtn: { backgroundColor: colors.bg, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  bannerBtnText: { color: colors.link, fontWeight: '700' },
  bannerCancel: { color: colors.onAccent, fontSize: 12, textDecorationLine: 'underline' },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34, borderWidth: 1, borderColor: colors.border },
  sheetTitle: { color: colors.heading, fontSize: 20, fontWeight: '700', lineHeight: 26, marginBottom: 14 },
  sheetHint: { color: colors.muted, fontSize: 13, marginTop: 12, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, marginTop: 12 },
  optRow: { flexDirection: 'row', gap: 10 },
  opt: { flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  optText: { color: colors.onAccent, fontWeight: '700', fontSize: 15, textTransform: 'capitalize' },
  optTextLast: { textDecorationLine: 'underline' },
  whenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  when: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  whenOn: { backgroundColor: colors.highlight, borderColor: colors.highlight },
  whenText: { color: colors.text, fontSize: 13 },
  whenTextOn: { color: colors.onAccent, fontWeight: '700' },
  same: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.highlight, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, marginTop: 14 },
  sameText: { color: colors.onAccent, fontWeight: '700', fontSize: 14, flexShrink: 1, textTransform: 'capitalize' },
  cancel: { color: colors.muted, textAlign: 'center' },
});
