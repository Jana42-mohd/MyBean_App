import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, ScrollView, Modal, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

interface NapLog { start: string; end: string; notes?: string }
interface DiaperLog { time: string; type: 'pee' | 'poop'; color?: 'yellow' | 'green' | 'brown' | 'black'; consistency?: 'runny' | 'normal' | 'firm'; notes?: string }
interface FeedingLog { time: string; method: 'breast' | 'formula' | 'mixed'; amount?: string; nextInHours?: string }
interface PumpLog { time: string; volumeOz: string; side: 'left' | 'right' | 'both'; ampm: 'AM' | 'PM' }
interface MilestoneLog { date: string; milestone: string; notes?: string }
interface MoodLog { time: string; mood: 'happy' | 'fussy' | 'sleeping' | 'crying' | 'calm'; notes?: string }

const STORAGE_KEYS = {
  naps: 'logs_naps',
  diapers: 'logs_diapers',
  feedings: 'logs_feedings',
  pumping: 'logs_pumping',
  milestones: 'logs_milestones',
  mood: 'logs_mood',
};

export default function TrackScreen() {
  const [naps, setNaps] = useState<NapLog[]>([]);
  const [diapers, setDiapers] = useState<DiaperLog[]>([]);
  const [feedings, setFeedings] = useState<FeedingLog[]>([]);
  const [pumps, setPumps] = useState<PumpLog[]>([]);
  const [milestones, setMilestones] = useState<MilestoneLog[]>([]);
  const [moods, setMoods] = useState<MoodLog[]>([]);

  // Form state
  const [napStart, setNapStart] = useState('');
  const [napEnd, setNapEnd] = useState('');
  const [napNotes, setNapNotes] = useState('');

  const [diaperType, setDiaperType] = useState<'pee'|'poop'>('pee');
  const [poopColor, setPoopColor] = useState<'yellow'|'green'|'brown'|'black'|''>('');
  const [poopConsistency, setPoopConsistency] = useState<'runny'|'normal'|'firm'|''>('');
  const [diaperNotes, setDiaperNotes] = useState('');

  const [feedMethod, setFeedMethod] = useState<'breast'|'formula'|'mixed'>('breast');
  const [feedAmount, setFeedAmount] = useState('');
  const [nextInHours, setNextInHours] = useState('');

  const [pumpVolume, setPumpVolume] = useState('');
  const [pumpSide, setPumpSide] = useState<'left'|'right'|'both'>('both');

  const [milestoneText, setMilestoneText] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [milestoneNotes, setMilestoneNotes] = useState('');

  const [moodType, setMoodType] = useState<'happy'|'fussy'|'sleeping'|'crying'|'calm'>('calm');
  const [moodNotes, setMoodNotes] = useState('');

  // Date/Time picker state
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'napStart' | 'napEnd' | 'milestone'>('napStart');
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerHour, setPickerHour] = useState(new Date().getHours());
  const [pickerMinute, setPickerMinute] = useState(new Date().getMinutes());

  const openDateTimePicker = (mode: 'napStart' | 'napEnd' | 'milestone') => {
    setDatePickerMode(mode);
    setPickerDate(new Date());
    setPickerHour(new Date().getHours());
    setPickerMinute(new Date().getMinutes());
    setDatePickerVisible(true);
  };

  const handleDateTimeConfirm = () => {
    const date = new Date(pickerDate);
    date.setHours(pickerHour);
    date.setMinutes(pickerMinute);

    const formatted = date.toISOString().slice(0, 16).replace('T', ' ');
    const dateOnly = date.toISOString().slice(0, 10);

    if (datePickerMode === 'napStart') {
      setNapStart(formatted);
    } else if (datePickerMode === 'napEnd') {
      setNapEnd(formatted);
    } else if (datePickerMode === 'milestone') {
      setMilestoneDate(dateOnly);
    }

    setDatePickerVisible(false);
  };
  useEffect(() => {
    const load = async () => {
      const n = await AsyncStorage.getItem(STORAGE_KEYS.naps);
      const d = await AsyncStorage.getItem(STORAGE_KEYS.diapers);
      const f = await AsyncStorage.getItem(STORAGE_KEYS.feedings);
      const p = await AsyncStorage.getItem(STORAGE_KEYS.pumping);
      const m = await AsyncStorage.getItem(STORAGE_KEYS.milestones);
      const mo = await AsyncStorage.getItem(STORAGE_KEYS.mood);
      if (n) setNaps(JSON.parse(n));
      if (d) setDiapers(JSON.parse(d));
      if (f) setFeedings(JSON.parse(f));
      if (p) setPumps(JSON.parse(p));
      if (m) setMilestones(JSON.parse(m));
      if (mo) setMoods(JSON.parse(mo));
    };
    load();
  }, []);

  const save = async (key: string, value: any) => {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  };

  const logNap = async () => {
    if (!napStart || !napEnd) return;
    const entry: NapLog = { start: napStart, end: napEnd, notes: napNotes || undefined };
    const updated = [entry, ...naps].slice(0, 20);
    setNaps(updated);
    await save(STORAGE_KEYS.naps, updated);
    setNapStart(''); setNapEnd(''); setNapNotes('');
  };

  const logDiaper = async () => {
    const time = new Date().toISOString();
    const entry: DiaperLog = { time, type: diaperType, color: diaperType==='poop'? (poopColor||undefined) : undefined, consistency: diaperType==='poop'? (poopConsistency||undefined) : undefined, notes: diaperNotes || undefined };
    const updated = [entry, ...diapers].slice(0, 30);
    setDiapers(updated);
    await save(STORAGE_KEYS.diapers, updated);
    setDiaperNotes(''); setPoopColor(''); setPoopConsistency('');
  };

  const logFeeding = async () => {
    const time = new Date().toISOString();
    const entry: FeedingLog = { time, method: feedMethod, amount: feedAmount || undefined, nextInHours: nextInHours || undefined };
    const updated = [entry, ...feedings].slice(0, 30);
    setFeedings(updated);
    await save(STORAGE_KEYS.feedings, updated);
    setFeedAmount(''); setNextInHours('');
  };

  const logPump = async () => {
    const now = new Date();
    const ampm: 'AM'|'PM' = now.getHours() < 12 ? 'AM' : 'PM';
    const entry: PumpLog = { time: now.toISOString(), volumeOz: pumpVolume || '0', side: pumpSide, ampm };
    const updated = [entry, ...pumps].slice(0, 30);
    setPumps(updated);
    await save(STORAGE_KEYS.pumping, updated);
    setPumpVolume('');
  };

  const logMilestone = async () => {
    if (!milestoneText || !milestoneDate) return;
    const entry: MilestoneLog = { date: milestoneDate, milestone: milestoneText, notes: milestoneNotes || undefined };
    const updated = [entry, ...milestones].slice(0, 50);
    setMilestones(updated);
    await save(STORAGE_KEYS.milestones, updated);
    setMilestoneText(''); setMilestoneDate(''); setMilestoneNotes('');
  };

  const logMood = async () => {
    const time = new Date().toISOString();
    const entry: MoodLog = { time, mood: moodType, notes: moodNotes || undefined };
    const updated = [entry, ...moods].slice(0, 50);
    setMoods(updated);
    await save(STORAGE_KEYS.mood, updated);
    setMoodNotes('');
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.title}>Track Baby Activity</ThemedText>
        <Text style={styles.subtitle}>Log feeding, sleep, diapers, milestones & mood</Text>

        {/* Naps */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Naps</Text>
          <Text style={styles.label}>Start Time</Text>
          <Pressable style={styles.dateButton} onPress={() => openDateTimePicker('napStart')}>
            <Text style={styles.dateButtonText}>{napStart || 'Tap to select start time'}</Text>
          </Pressable>
          <Text style={styles.label}>End Time</Text>
          <Pressable style={styles.dateButton} onPress={() => openDateTimePicker('napEnd')}>
            <Text style={styles.dateButtonText}>{napEnd || 'Tap to select end time'}</Text>
          </Pressable>
          <Text style={styles.label}>Notes</Text>
          <TextInput style={styles.input} value={napNotes} onChangeText={setNapNotes} placeholder="Optional" placeholderTextColor="#A4CDD3" />
          <Pressable style={styles.primaryButton} onPress={logNap}><Text style={styles.primaryButtonText}>Log Nap</Text></Pressable>
          <View style={styles.list}>{naps.slice(0,5).map((n,i)=>(<Text key={i} style={styles.listItem}>{n.start} → {n.end} {n.notes? `· ${n.notes}`:''}</Text>))}</View>
        </View>

        {/* Diapers */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Diapers</Text>
          <View style={styles.row}>
            {(['pee','poop'] as const).map(opt => (
              <Pressable key={opt} onPress={()=>setDiaperType(opt)} style={[styles.choice, diaperType===opt && styles.choiceActive]}>
                <Text style={[styles.choiceText, diaperType===opt && styles.choiceTextActive]}>{opt}</Text>
              </Pressable>
            ))}
          </View>
          {diaperType==='poop' && (
            <>
            <Text style={styles.label}>Poop color</Text>
            <View style={styles.row}>
              {(['yellow','green','brown','black'] as const).map(opt => (
                <Pressable key={opt} onPress={()=>setPoopColor(opt)} style={[styles.choice, poopColor===opt && styles.choiceActive]}>
                  <Text style={[styles.choiceText, poopColor===opt && styles.choiceTextActive]}>{opt}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.helper}>Black stool can indicate bleeding; contact a doctor. Green is often due to iron or foremilk; yellow is common. Monitor changes.</Text>
            <Text style={styles.label}>Consistency</Text>
            <View style={styles.row}>
              {(['runny','normal','firm'] as const).map(opt => (
                <Pressable key={opt} onPress={()=>setPoopConsistency(opt)} style={[styles.choice, poopConsistency===opt && styles.choiceActive]}>
                  <Text style={[styles.choiceText, poopConsistency===opt && styles.choiceTextActive]}>{opt}</Text>
                </Pressable>
              ))}
            </View>
            </>
          )}
          <Text style={styles.label}>Notes</Text>
          <TextInput style={styles.input} value={diaperNotes} onChangeText={setDiaperNotes} placeholder="Optional" placeholderTextColor="#A4CDD3" />
          <Pressable style={styles.primaryButton} onPress={logDiaper}><Text style={styles.primaryButtonText}>Log Diaper</Text></Pressable>
          <View style={styles.list}>{diapers.slice(0,5).map((d,i)=>(<Text key={i} style={styles.listItem}>{d.time} · {d.type}{d.color? ` · ${d.color}`:''}{d.consistency? ` · ${d.consistency}`:''}</Text>))}</View>
        </View>

        {/* Feeding */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Feeding</Text>
          <View style={styles.row}>
            {(['breast','formula','mixed'] as const).map(opt => (
              <Pressable key={opt} onPress={()=>setFeedMethod(opt)} style={[styles.choice, feedMethod===opt && styles.choiceActive]}>
                <Text style={[styles.choiceText, feedMethod===opt && styles.choiceTextActive]}>{opt}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Amount (oz or minutes)</Text>
          <TextInput style={styles.input} value={feedAmount} onChangeText={setFeedAmount} placeholder="e.g., 4 oz or 15 min" placeholderTextColor="#A4CDD3" />
          <Text style={styles.label}>Next feeding reminder (hours)</Text>
          <TextInput style={styles.input} value={nextInHours} onChangeText={setNextInHours} placeholder="e.g., 3" placeholderTextColor="#A4CDD3" keyboardType="numeric" />
          <Pressable style={styles.primaryButton} onPress={logFeeding}><Text style={styles.primaryButtonText}>Log Feeding</Text></Pressable>
          <View style={styles.list}>{feedings.slice(0,5).map((f,i)=>(<Text key={i} style={styles.listItem}>{f.time} · {f.method}{f.amount? ` · ${f.amount}`:''}{f.nextInHours? ` · next in ${f.nextInHours}h`:''}</Text>))}</View>
        </View>

        {/* Pumping */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pumping</Text>
          <View style={styles.row}>
            {(['left','right','both'] as const).map(opt => (
              <Pressable key={opt} onPress={()=>setPumpSide(opt)} style={[styles.choice, pumpSide===opt && styles.choiceActive]}>
                <Text style={[styles.choiceText, pumpSide===opt && styles.choiceTextActive]}>{opt}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Volume (oz)</Text>
          <TextInput style={styles.input} value={pumpVolume} onChangeText={setPumpVolume} placeholder="e.g., 6" placeholderTextColor="#A4CDD3" keyboardType="numeric" />
          <Pressable style={styles.primaryButton} onPress={logPump}><Text style={styles.primaryButtonText}>Log Pumping</Text></Pressable>
          <View style={styles.list}>{pumps.slice(0,5).map((p,i)=>(<Text key={i} style={styles.listItem}>{p.time} · {p.volumeOz} oz · {p.side} · {p.ampm}</Text>))}</View>
        </View>

        {/* Milestones */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Milestones</Text>
          <Text style={styles.label}>Date</Text>
          <Pressable style={styles.dateButton} onPress={() => openDateTimePicker('milestone')}>
            <Text style={styles.dateButtonText}>{milestoneDate || 'Tap to select date'}</Text>
          </Pressable>
          <Text style={styles.label}>Milestone</Text>
          <TextInput style={styles.input} value={milestoneText} onChangeText={setMilestoneText} placeholder="e.g., First smile, Started rolling" placeholderTextColor="#A4CDD3" />
          <Text style={styles.label}>Notes</Text>
          <TextInput style={styles.input} value={milestoneNotes} onChangeText={setMilestoneNotes} placeholder="Optional details" placeholderTextColor="#A4CDD3" />
          <Pressable style={styles.secondaryButton} onPress={logMilestone}><Text style={styles.secondaryButtonText}>Log Milestone</Text></Pressable>
          <View style={styles.list}>{milestones.slice(0,5).map((m,i)=>(<Text key={i} style={styles.listItem}>{m.date} · {m.milestone} {m.notes? `· ${m.notes}`:''}</Text>))}</View>
        </View>

        {/* Mood & Behavior */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mood & Behavior</Text>
          <View style={styles.row}>
            {(['happy','calm','fussy','crying','sleeping'] as const).map(opt => (
              <Pressable key={opt} onPress={()=>setMoodType(opt)} style={[styles.choice, moodType===opt && styles.choiceActive]}>
                <Text style={[styles.choiceText, moodType===opt && styles.choiceTextActive]}>{opt}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Notes (teething, symptoms, etc.)</Text>
          <TextInput style={styles.input} value={moodNotes} onChangeText={setMoodNotes} placeholder="Optional observations" placeholderTextColor="#A4CDD3" />
          <Pressable style={styles.secondaryButton} onPress={logMood}><Text style={styles.secondaryButtonText}>Log Mood</Text></Pressable>
          <View style={styles.list}>{moods.slice(0,5).map((m,i)=>(<Text key={i} style={styles.listItem}>{m.time} · {m.mood} {m.notes? `· ${m.notes}`:''}</Text>))}</View>
        </View>
      </ScrollView>

      {/* Date/Time Picker Modal */}
      <Modal visible={datePickerVisible} transparent={true} animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Pressable onPress={() => setDatePickerVisible(false)}>
                <Text style={styles.pickerButton}>Cancel</Text>
              </Pressable>
              <Text style={styles.pickerTitle}>
                {datePickerMode === 'napStart' ? 'Nap Start' : datePickerMode === 'napEnd' ? 'Nap End' : 'Milestone Date'}
              </Text>
              <Pressable onPress={handleDateTimeConfirm}>
                <Text style={styles.pickerButtonConfirm}>Done</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.pickerContent} showsVerticalScrollIndicator={false}>
              {/* Date Picker */}
              <View style={styles.pickerSection}>
                <Text style={styles.pickerLabel}>Date</Text>
                <View style={styles.dateInputRow}>
                  <View style={styles.dateInputGroup}>
                    <Text style={styles.dateInputLabel}>Month</Text>
                    <View style={styles.numberInputContainer}>
                      <Pressable onPress={() => setPickerDate(new Date(pickerDate.getTime() - 30 * 24 * 60 * 60 * 1000))}>
                        <Text style={styles.numberButton}>−</Text>
                      </Pressable>
                      <Text style={styles.numberDisplay}>
                        {String(pickerDate.getMonth() + 1).padStart(2, '0')}
                      </Text>
                      <Pressable onPress={() => setPickerDate(new Date(pickerDate.getTime() + 30 * 24 * 60 * 60 * 1000))}>
                        <Text style={styles.numberButton}>+</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.dateInputGroup}>
                    <Text style={styles.dateInputLabel}>Day</Text>
                    <View style={styles.numberInputContainer}>
                      <Pressable onPress={() => setPickerDate(new Date(pickerDate.getTime() - 24 * 60 * 60 * 1000))}>
                        <Text style={styles.numberButton}>−</Text>
                      </Pressable>
                      <Text style={styles.numberDisplay}>
                        {String(pickerDate.getDate()).padStart(2, '0')}
                      </Text>
                      <Pressable onPress={() => setPickerDate(new Date(pickerDate.getTime() + 24 * 60 * 60 * 1000))}>
                        <Text style={styles.numberButton}>+</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.dateInputGroup}>
                    <Text style={styles.dateInputLabel}>Year</Text>
                    <View style={styles.numberInputContainer}>
                      <Pressable onPress={() => setPickerDate(new Date(pickerDate.getFullYear() - 1, pickerDate.getMonth(), pickerDate.getDate()))}>
                        <Text style={styles.numberButton}>−</Text>
                      </Pressable>
                      <Text style={styles.numberDisplay}>
                        {pickerDate.getFullYear()}
                      </Text>
                      <Pressable onPress={() => setPickerDate(new Date(pickerDate.getFullYear() + 1, pickerDate.getMonth(), pickerDate.getDate()))}>
                        <Text style={styles.numberButton}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>

              {/* Time Picker (only for naps, not milestones) */}
              {datePickerMode !== 'milestone' && (
                <View style={styles.pickerSection}>
                  <Text style={styles.pickerLabel}>Time</Text>
                  <View style={styles.timeInputRow}>
                    <View style={styles.timeInputGroup}>
                      <Text style={styles.dateInputLabel}>Hour</Text>
                      <View style={styles.numberInputContainer}>
                        <Pressable onPress={() => setPickerHour((h) => (h - 1 + 24) % 24)}>
                          <Text style={styles.numberButton}>−</Text>
                        </Pressable>
                        <Text style={styles.numberDisplay}>
                          {String(pickerHour).padStart(2, '0')}
                        </Text>
                        <Pressable onPress={() => setPickerHour((h) => (h + 1) % 24)}>
                          <Text style={styles.numberButton}>+</Text>
                        </Pressable>
                      </View>
                    </View>

                    <Text style={styles.timeSeparator}>:</Text>

                    <View style={styles.timeInputGroup}>
                      <Text style={styles.dateInputLabel}>Min</Text>
                      <View style={styles.numberInputContainer}>
                        <Pressable onPress={() => setPickerMinute((m) => (m - 5 + 60) % 60)}>
                          <Text style={styles.numberButton}>−</Text>
                        </Pressable>
                        <Text style={styles.numberDisplay}>
                          {String(pickerMinute).padStart(2, '0')}
                        </Text>
                        <Pressable onPress={() => setPickerMinute((m) => (m + 5) % 60)}>
                          <Text style={styles.numberButton}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09282eff' },
  content: { paddingTop: 80, paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 40, gap: 16 },
  title: { fontSize: 24, color: '#FED8FE', fontWeight: '700' },
  subtitle: { fontSize: 15, color: '#A4CDD3' },
  card: { backgroundColor: '#0f3a41ff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2F9BA8', gap: 10 },
  cardTitle: { fontSize: 16, color: '#FDFECC', fontWeight: '700' },
  label: { color: '#E8FBFF', marginTop: 6 },
  input: { backgroundColor: '#11464e', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, fontSize: 15, color: '#E8FBFF', borderWidth: 1, borderColor: '#2F9BA8' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choice: { borderWidth: 2, borderColor: '#2F9BA8', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(47, 155, 168, 0.1)' },
  choiceActive: { backgroundColor: '#FDFECC', borderColor: '#FDFECC' },
  choiceText: { color: '#E8FBFF', textTransform: 'capitalize' },
  choiceTextActive: { color: '#12454E', fontWeight: '700' },
  helper: { color: '#A4CDD3', fontSize: 12 },
  primaryButton: { marginTop: 6, backgroundColor: '#FED8FE', paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  primaryButtonText: { color: '#12454E', fontWeight: '700', fontSize: 16 },
  secondaryButton: { marginTop: 6, backgroundColor: '#FDFECC', paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#12454E', fontWeight: '700', fontSize: 16 },
  list: { gap: 6 },
  listItem: { color: '#E8FBFF', fontSize: 13 },
  pickerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: '#0f3a41ff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2F9BA8',
  },
  pickerTitle: {
    color: '#FED8FE',
    fontSize: 16,
    fontWeight: '700',
  },
  pickerSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2F9BA8',
  },
  pickerLabel: {
    color: '#FDFECC',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  dateInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  dateInputGroup: {
    flex: 1,
    alignItems: 'center',
  },
  dateInputLabel: {
    color: '#A4CDD3',
    fontSize: 12,
    marginBottom: 8,
  },
  numberInputContainer: {
    alignItems: 'center',
    gap: 8,
  },
  numberButton: {
    color: '#FDFECC',
    fontSize: 20,
    paddingHorizontal: 8,
  },
  numberDisplay: {
    color: '#E8FBFF',
    fontSize: 18,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  timeInputRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  timeInputGroup: {
    alignItems: 'center',
  },
  timeSeparator: {
    color: '#FED8FE',
    fontSize: 20,
    fontWeight: '700',
  },
  pickerButton: {
    color: '#A4CDD3',
    fontSize: 14,
    padding: 8,
  },
  pickerButtonConfirm: {
    color: '#FDFECC',
    fontSize: 14,
    fontWeight: '700',
    padding: 8,
  },
  iosPickerContainer: {
    flex: 1,
    backgroundColor: '#09282eff',
  },
  iosPickerContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  iosPickerColumn: {
    width: 60,
    alignItems: 'center',
  },
  iosPickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    color: '#FDFECC',
  },
  iosPickerScroll: {
    height: 200,
    width: 60,
  },
  iosPickerItem: {
    height: 40,
    fontSize: 18,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingVertical: 8,
  },
  iosPickerItemSelected: {
    color: '#FDFECC',
    fontWeight: '700',
    fontSize: 20,
  },
  androidPickerContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 12,
  },
  androidPickerButton: {
    backgroundColor: '#11464e',
    borderWidth: 1,
    borderColor: '#2F9BA8',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  androidPickerButtonText: {
    color: '#E8FBFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dateButton: {
    backgroundColor: '#11464e',
    borderWidth: 1,
    borderColor: '#2F9BA8',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateButtonText: {
    color: '#FDFECC',
    fontSize: 14,
    fontWeight: '600',
  },
});
