import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { friendlyError } from '@/components/LoadError';
import { LogType, updateLog } from '@/lib/logs';
import { formatDateTimeInput, localInputToIso, toLocalInput } from '@/lib/time';
import { formatDateInput, isValidDate } from '@/lib/babies';
import { GrowthForm } from '@/components/GrowthForm';
import { GrowthData } from '@/lib/growth';
import { useUnits } from '@/lib/units';

export interface EditableEntry {
  id: string;
  type: LogType;
  data: any;
  baby?: string;
}

function Choices({ options, value, onPick }: { options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <View style={styles.choices}>
      {options.map(o => (
        <Pressable key={o} onPress={() => onPick(value === o ? '' : o)} style={[styles.choice, value === o && styles.choiceActive]}>
          <Text style={[styles.choiceText, value === o && styles.choiceTextActive]}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={{ marginTop: 14 }}>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
);

// Edit everything about a logged entry: times, amounts, choices and notes.
export function EditEntry({ entry, onClose, onSaved }: { entry: EditableEntry | null; onClose: () => void; onSaved: () => void }) {
  if (!entry) return null;
  if (entry.type === 'growth') return <GrowthEdit key={entry.id} entry={entry} onClose={onClose} onSaved={onSaved} />;
  return <Form key={entry.id} entry={entry} onClose={onClose} onSaved={onSaved} />;
}

function GrowthEdit({ entry, onClose, onSaved }: { entry: EditableEntry; onClose: () => void; onSaved: () => void }) {
  const [units] = useUnits();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={[styles.title, { marginBottom: 12 }]}>Edit measurement{entry.baby ? ` for ${entry.baby}` : ''}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <GrowthForm
              units={units}
              initial={entry.data as GrowthData}
              submitLabel="Save changes"
              onCancel={onClose}
              onSubmit={async data => {
                await updateLog(entry.id, data, new Date(`${data.date}T12:00:00`).toISOString());
                onSaved();
              }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Form({ entry, onClose, onSaved }: { entry: EditableEntry; onClose: () => void; onSaved: () => void }) {
  const d = entry.data ?? {};
  const [f, setF] = useState({
    time: d.time ? toLocalInput(d.time) : '',
    start: d.start ? toLocalInput(d.start) : '',
    end: d.end ? toLocalInput(d.end) : '',
    date: d.date ?? '',
    type: d.type ?? '',
    color: d.color ?? '',
    consistency: d.consistency ?? '',
    method: d.method ?? '',
    amount: d.amount ?? '',
    nextInHours: d.nextInHours ?? '',
    volumeOz: d.volumeOz ?? '',
    side: d.side ?? '',
    mood: d.mood ?? '',
    milestone: d.milestone ?? '',
    notes: d.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(prev => ({ ...prev, [k]: v }));

  const timeInput = (key: 'time' | 'start' | 'end') => (
    <TextInput
      style={styles.input}
      value={f[key]}
      onChangeText={t => set(key)(formatDateTimeInput(t))}
      placeholder="YYYY-MM-DD HH:MM"
      placeholderTextColor="#A4CDD3"
      keyboardType="number-pad"
      maxLength={16}
    />
  );

  const save = async () => {
    try {
      let data: any = { ...d };
      let loggedAt: string | undefined;
      const needTime = (key: 'time' | 'start' | 'end', name: string) => {
        const iso = localInputToIso(f[key]);
        if (!iso) throw new Error(`${name} must be a real date and time, like 2025-03-14 08:30 (24-hour clock).`);
        return iso;
      };
      const notes = f.notes.trim() || undefined;

      switch (entry.type) {
        case 'diaper':
          if (!f.type) throw new Error('Choose pee or poop.');
          data = { time: needTime('time', 'Time'), type: f.type, color: f.type === 'poop' ? f.color || undefined : undefined, consistency: f.type === 'poop' ? f.consistency || undefined : undefined, notes };
          loggedAt = data.time;
          break;
        case 'feeding':
          if (!f.method) throw new Error('Choose how baby was fed.');
          data = { time: needTime('time', 'Time'), method: f.method, amount: f.amount.trim() || undefined, nextInHours: f.nextInHours.trim() || undefined, notes };
          loggedAt = data.time;
          break;
        case 'pumping': {
          const time = needTime('time', 'Time');
          data = { time, volumeOz: f.volumeOz.trim() || '0', side: f.side || 'both', ampm: new Date(time).getHours() < 12 ? 'AM' : 'PM', notes };
          loggedAt = time;
          break;
        }
        case 'mood':
          if (!f.mood) throw new Error('Choose a mood.');
          data = { time: needTime('time', 'Time'), mood: f.mood, notes };
          loggedAt = data.time;
          break;
        case 'nap': {
          const start = needTime('start', 'Start');
          const end = needTime('end', 'End');
          if (new Date(end) <= new Date(start)) throw new Error('The nap must end after it starts.');
          data = { start, end, notes };
          loggedAt = start;
          break;
        }
        case 'milestone':
          if (!f.milestone.trim()) throw new Error('Describe the milestone.');
          if (!isValidDate(f.date)) throw new Error('Date must be a real date, like 2025-03-14.');
          data = { milestone: f.milestone.trim(), date: f.date, notes };
          loggedAt = new Date(f.date).toISOString();
          break;
      }
      setSaving(true);
      await updateLog(entry.id, data, loggedAt);
      onSaved();
    } catch (e: any) {
      Alert.alert('Check this entry', friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const title = { diaper: 'Diaper', feeding: 'Feeding', nap: 'Nap', pumping: 'Pumping', mood: 'Mood', milestone: 'Milestone', growth: 'Growth' }[entry.type];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Edit {title.toLowerCase()}{entry.baby ? ` for ${entry.baby}` : ''}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {entry.type !== 'nap' && entry.type !== 'milestone' ? <Field label="When (your local time)">{timeInput('time')}</Field> : null}

            {entry.type === 'diaper' ? (
              <>
                <Field label="Type"><Choices options={['pee', 'poop']} value={f.type} onPick={set('type')} /></Field>
                {f.type === 'poop' ? (
                  <>
                    <Field label="Color"><Choices options={['yellow', 'green', 'brown', 'black']} value={f.color} onPick={set('color')} /></Field>
                    <Field label="Consistency"><Choices options={['runny', 'normal', 'firm']} value={f.consistency} onPick={set('consistency')} /></Field>
                  </>
                ) : null}
              </>
            ) : null}

            {entry.type === 'feeding' ? (
              <>
                <Field label="How"><Choices options={['breast', 'formula', 'mixed']} value={f.method} onPick={set('method')} /></Field>
                <Field label="Amount"><TextInput style={styles.input} value={f.amount} onChangeText={set('amount')} placeholder="e.g. 4 oz" placeholderTextColor="#A4CDD3" /></Field>
                <Field label="Next feeding in (hours)"><TextInput style={styles.input} value={f.nextInHours} onChangeText={set('nextInHours')} keyboardType="decimal-pad" placeholder="optional" placeholderTextColor="#A4CDD3" /></Field>
              </>
            ) : null}

            {entry.type === 'pumping' ? (
              <>
                <Field label="Volume (oz)"><TextInput style={styles.input} value={f.volumeOz} onChangeText={set('volumeOz')} keyboardType="decimal-pad" /></Field>
                <Field label="Side"><Choices options={['left', 'right', 'both']} value={f.side} onPick={set('side')} /></Field>
              </>
            ) : null}

            {entry.type === 'mood' ? (
              <Field label="Mood"><Choices options={['happy', 'fussy', 'sleeping', 'crying', 'calm']} value={f.mood} onPick={set('mood')} /></Field>
            ) : null}

            {entry.type === 'nap' ? (
              <>
                <Field label="Started (your local time)">{timeInput('start')}</Field>
                <Field label="Ended (your local time)">{timeInput('end')}</Field>
              </>
            ) : null}

            {entry.type === 'milestone' ? (
              <>
                <Field label="Milestone"><TextInput style={styles.input} value={f.milestone} onChangeText={set('milestone')} /></Field>
                <Field label="Date">
                  <TextInput
                    style={styles.input}
                    value={f.date}
                    onChangeText={t => set('date')(formatDateInput(t))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#A4CDD3"
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </Field>
              </>
            ) : null}

            <Field label="Notes">
              <TextInput style={[styles.input, { minHeight: 70 }]} value={f.notes} onChangeText={set('notes')} multiline placeholder="Optional" placeholderTextColor="#A4CDD3" />
            </Field>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onClose}><Text style={styles.cancel}>Cancel</Text></Pressable>
            <Pressable style={styles.saveBtn} onPress={save} disabled={saving}>
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save changes'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', backgroundColor: '#0f3a41ff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30, borderWidth: 1, borderColor: '#2F9BA8' },
  title: { color: '#FED8FE', fontSize: 20, fontWeight: '700', lineHeight: 26 },
  label: { color: '#A4CDD3', fontSize: 13, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#2F9BA8', borderRadius: 10, padding: 12, color: '#E8FBFF' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#2F9BA8' },
  choiceActive: { backgroundColor: '#FED8FE', borderColor: '#FED8FE' },
  choiceText: { color: '#E8FBFF', fontSize: 13, textTransform: 'capitalize' },
  choiceTextActive: { color: '#09282eff', fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  cancel: { color: '#A4CDD3', fontSize: 15 },
  saveBtn: { backgroundColor: '#FED8FE', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  saveText: { color: '#09282eff', fontWeight: '700' },
});
