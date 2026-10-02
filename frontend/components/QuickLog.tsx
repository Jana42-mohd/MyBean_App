import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ALL_BABIES, BabyPicker } from '@/components/BabyPicker';
import { friendlyError } from '@/components/LoadError';
import { Baby, babyNames } from '@/lib/babies';
import { logEntry, undoEntry } from '@/lib/logActions';
import { LogType } from '@/lib/logs';
import { ActiveSleep, clearSleep, formatElapsed, getActiveSleep, startSleep } from '@/lib/timer';
import { formatDuration } from '@/lib/time';

type Sheet = null | 'feeding' | 'diaper' | 'sleep';
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function QuickLog({
  babies,
  selected,
  onChanged,
  onToast,
}: {
  babies: Baby[]; // born babies only
  selected: string; // baby picker value on Home
  onChanged: () => void; // reload Home after something was logged
  onToast: (message: string, undo?: () => Promise<void>) => void;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [target, setTarget] = useState(ALL_BABIES);
  const [amount, setAmount] = useState('');
  const [active, setActive] = useState<ActiveSleep | null>(null);
  const [now, setNow] = useState(Date.now());
  const disabled = babies.length === 0;

  useEffect(() => {
    getActiveSleep().then(setActive);
  }, []);

  // tick once a second while a sleep timer is running
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const targets = useCallback(
    () => (target === ALL_BABIES ? babies : babies.filter(b => b.id === target)),
    [target, babies]
  );

  const open = (s: Exclude<Sheet, null>) => {
    Haptics.selectionAsync();
    setTarget(babies.length === 1 ? babies[0].id : selected);
    setAmount('');
    setSheet(s);
  };

  const save = async (type: LogType, data: any, label: string) => {
    const who = targets();
    if (who.length === 0) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const ids = await logEntry(type, data, who);
      setSheet(null);
      onToast(`${label} for ${babyNames(who)}`, () => undoEntry(type, ids, who));
      onChanged();
    } catch (e) {
      onToast(`Could not save: ${friendlyError(e)}`);
    }
  };

  const beginSleep = async () => {
    const who = targets();
    if (who.length === 0) return;
    setActive(await startSleep(who.map(b => ({ id: b.id, name: b.name }))));
    setSheet(null);
  };

  const onSleepCard = () => {
    if (active) return;
    if (babies.length > 1) open('sleep');
    else {
      setTarget(babies[0].id);
      Haptics.selectionAsync();
      startSleep([{ id: babies[0].id, name: babies[0].name }]).then(setActive);
    }
  };

  const wakeUp = async () => {
    if (!active) return;
    const start = new Date(active.startedAt);
    const end = new Date();
    const minutes = (end.getTime() - start.getTime()) / 60000;
    await clearSleep();
    setActive(null);
    if (minutes < 1) {
      onToast('Sleep was under a minute, so it was not saved');
      return;
    }
    try {
      const ids = await logEntry('nap', { start: start.toISOString(), end: end.toISOString() }, active.babies, start.toISOString());
      onToast(`Logged ${formatDuration(minutes)} of sleep for ${babyNames(active.babies)}`, () => undoEntry('nap', ids, active.babies));
      onChanged();
    } catch (e) {
      onToast(`Could not save the nap: ${friendlyError(e)}`);
    }
  };

  const cancelSleep = async () => {
    await clearSleep();
    setActive(null);
  };

  const Card = ({ icon, label, onPress, highlight }: { icon: IconName; label: string; onPress: () => void; highlight?: boolean }) => (
    <Pressable style={[styles.card, highlight && styles.cardActive]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <MaterialCommunityIcons name={icon} size={26} color={highlight ? '#09282eff' : '#FDFECC'} />
      <Text style={[styles.label, highlight && { color: '#09282eff' }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View>
      {active ? (
        <View style={styles.banner}>
          <MaterialCommunityIcons name="weather-night" size={24} color="#09282eff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>{babyNames(active.babies)} {active.babies.length > 1 ? 'are' : 'is'} sleeping</Text>
            <Text style={styles.bannerTime}>{formatElapsed(active.startedAt, now)}</Text>
          </View>
          <Pressable style={styles.bannerBtn} onPress={wakeUp}>
            <Text style={styles.bannerBtnText}>Woke up</Text>
          </Pressable>
          <Pressable onPress={cancelSleep} hitSlop={10}>
            <Text style={styles.bannerCancel}>Discard</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.grid, disabled && { opacity: 0.45 }]} pointerEvents={disabled ? 'none' : 'auto'}>
        <Card icon="baby-bottle-outline" label="Feeding" onPress={() => open('feeding')} />
        <Card icon="baby-face-outline" label="Diaper" onPress={() => open('diaper')} />
        <Card icon="weather-night" label={active ? 'Sleeping…' : 'Sleep'} onPress={onSleepCard} highlight={!!active} />
        <Card icon="water-outline" label="Pumping" onPress={() => router.push('/(tabs)/track')} />
        <Card icon="star-outline" label="Milestones" onPress={() => router.push('/(tabs)/track')} />
        <Card icon="emoticon-happy-outline" label="Mood & Behaviour" onPress={() => router.push('/(tabs)/track')} />
      </View>
      {disabled ? <Text style={styles.hint}>Quick logging unlocks once your baby is born.</Text> : null}

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {sheet === 'feeding' ? 'Log a feeding' : sheet === 'diaper' ? 'Log a diaper' : 'Who is sleeping?'}
            </Text>
            <BabyPicker babies={babies} value={target} onChange={setTarget} allLabel="All babies" />

            {sheet === 'feeding' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Amount (optional), e.g. 4 oz"
                  placeholderTextColor="#A4CDD3"
                  value={amount}
                  onChangeText={setAmount}
                />
                <Text style={styles.sheetHint}>Tap how baby was fed. It saves right away.</Text>
                <View style={styles.optRow}>
                  {(['breast', 'formula', 'mixed'] as const).map(m => (
                    <Pressable key={m} style={styles.opt} onPress={() => save('feeding', { time: new Date().toISOString(), method: m, amount: amount.trim() || undefined }, 'Logged feeding')}>
                      <Text style={styles.optText}>{m}</Text>
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
                    <Pressable key={t} style={styles.opt} onPress={() => save('diaper', { time: new Date().toISOString(), type: t }, `Logged ${t} diaper`)}>
                      <Text style={styles.optText}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {sheet === 'sleep' ? (
              <Pressable style={[styles.opt, { marginTop: 12 }]} onPress={beginSleep}>
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

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 92,
    backgroundColor: '#0f3a41ff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#FDFECC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardActive: { backgroundColor: '#FDFECC' },
  label: { fontSize: 11, color: '#E8FBFF', fontWeight: '600', textAlign: 'center' },
  hint: { color: '#A4CDD3', fontSize: 12, marginTop: 8 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FDFECC', borderRadius: 14, padding: 12, marginBottom: 12 },
  bannerTitle: { color: '#09282eff', fontWeight: '700', fontSize: 14 },
  bannerTime: { color: '#09282eff', fontSize: 20, fontWeight: '700', lineHeight: 26 },
  bannerBtn: { backgroundColor: '#09282eff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  bannerBtnText: { color: '#FDFECC', fontWeight: '700' },
  bannerCancel: { color: '#09282eff', fontSize: 12, textDecorationLine: 'underline' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0f3a41ff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34, borderWidth: 1, borderColor: '#2F9BA8' },
  sheetTitle: { color: '#FED8FE', fontSize: 20, fontWeight: '700', lineHeight: 26, marginBottom: 14 },
  sheetHint: { color: '#A4CDD3', fontSize: 13, marginTop: 12, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#2F9BA8', borderRadius: 10, padding: 12, color: '#E8FBFF' },
  optRow: { flexDirection: 'row', gap: 10 },
  opt: { flex: 1, backgroundColor: '#FED8FE', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  optText: { color: '#09282eff', fontWeight: '700', fontSize: 15, textTransform: 'capitalize' },
  cancel: { color: '#A4CDD3', textAlign: 'center' },
});
