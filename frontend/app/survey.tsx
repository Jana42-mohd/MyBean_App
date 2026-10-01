// @ts-nocheck
import React, { useEffect, useState } from 'react';
// @ts-ignore
import { StyleSheet, View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { loadSurvey, saveSurvey } from '@/lib/household';
import { BabyDraft, daysUntil, emptyBaby, fetchBabies, formatDateInput, isValidDate, saveBabies, todayStr, toDraft } from '@/lib/babies';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

interface SurveyData {
  parentName: string;
  pronouns: 'he/him' | 'she/her' | 'they/them' | 'other' | '';
  relationship: 'mother' | 'father' | 'parent' | 'guardian' | 'other family member' | '';
  primaryCaregiver: 'yes' | 'no' | 'shared' | '';
  trackingPreferences: string[];
}

function Choices({ options, value, onPick }: { options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <View style={styles.choices}>
      {options.map(opt => (
        <Pressable key={opt} onPress={() => onPick(opt)} style={[styles.choice, value === opt ? styles.choiceActive : null]}>
          <Text style={[styles.choiceText, value === opt && styles.choiceTextActive]}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SurveyScreen() {
  const router = useRouter();
  const [data, setData] = useState<SurveyData>({
    parentName: '',
    pronouns: '',
    relationship: '',
    primaryCaregiver: '',
    trackingPreferences: [],
  });
  const [babies, setBabies] = useState<BabyDraft[]>([emptyBaby()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Prefill from a previous survey, or from babies a partner already added to the household
  useEffect(() => {
    (async () => {
      try {
        const [existing, existingBabies, { data: u }] = await Promise.all([
          loadSurvey(),
          fetchBabies(),
          supabase.auth.getUser(),
        ]);
        if (existing) {
          setData(prev => ({ ...prev, ...existing }));
        } else if (u.user) {
          const { data: prof } = await supabase.from('profiles').select('name').eq('id', u.user.id).maybeSingle();
          if (prof?.name && prof.name !== 'Parent') setData(prev => ({ ...prev, parentName: prof.name }));
        }
        if (existingBabies.length) setBabies(existingBabies.map(toDraft));
      } catch (e) {
        console.error('Survey preload failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (key: keyof SurveyData, value: string) => setData(prev => ({ ...prev, [key]: value }));

  const toggleTracking = (pref: string) => {
    setData(prev => ({
      ...prev,
      trackingPreferences: prev.trackingPreferences.includes(pref)
        ? prev.trackingPreferences.filter(p => p !== pref)
        : [...prev.trackingPreferences, pref],
    }));
  };

  const updateBaby = (i: number, key: keyof BabyDraft, value: string) =>
    setBabies(prev => prev.map((b, idx) => (idx === i ? { ...b, [key]: value } : b)));

  const addBaby = () => setBabies(prev => [...prev, emptyBaby(prev[prev.length - 1])]);
  const removeBaby = (i: number) => setBabies(prev => prev.filter((_, idx) => idx !== i));

  const requiredFields = (b: BabyDraft) =>
    b.status === 'expected' ? [b.dueDate] : [b.name, b.gender, b.birthDate, b.gestationalAge, b.feedingType];
  const babyDone = (b: BabyDraft) => requiredFields(b).every(Boolean);

  const getProgress = () => {
    const parentFields = [data.parentName, data.pronouns, data.relationship, data.primaryCaregiver];
    const babyFields = babies.flatMap(requiredFields);
    const all = [...parentFields, ...babyFields];
    return Math.round((all.filter(f => f).length / all.length) * 100);
  };

  const submit = async () => {
    if (!data.parentName || !data.pronouns || !data.relationship || !data.primaryCaregiver) {
      Alert.alert('Missing info', 'Please fill out the "About You" section.');
      return;
    }
    const incomplete = babies.findIndex(b => !babyDone(b));
    if (incomplete >= 0) {
      Alert.alert('Missing info', `Please fill out everything for baby ${incomplete + 1}.`);
      return;
    }
    for (let i = 0; i < babies.length; i++) {
      const b = babies[i];
      const label = b.name.trim() || `baby ${i + 1}`;
      if (b.status === 'expected') {
        if (!isValidDate(b.dueDate)) {
          Alert.alert('Due date', `Please enter ${label}'s due date as a real date, e.g. 2026-03-14.`);
          return;
        }
      } else {
        if (!isValidDate(b.birthDate)) {
          Alert.alert('Birth date', `Please enter ${label}'s birth date as a real date, e.g. 2025-03-14.`);
          return;
        }
        if (b.birthDate > todayStr()) {
          Alert.alert('Birth date', `${label}'s birth date is in the future. If baby hasn't arrived yet, choose "still expecting".`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      await saveSurvey({ ...data, numberOfChildren: String(babies.length) });
      await saveBabies(babies);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
      setSaving(false);
      return;
    }
    setSaving(false);
    router.replace('/home');
  };

  if (loading) return null;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.card} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.title}>Welcome! Let's get to know you</ThemedText>
        <Text style={styles.subtitle}>This helps us personalize your experience</Text>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${getProgress()}%` }]} />
        </View>
        <Text style={styles.progressText}>{getProgress()}% complete</Text>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}> About You</Text>

          <Text style={styles.label}>Your name</Text>
          <TextInput
            style={styles.input}
            value={data.parentName}
            onChangeText={(t: string) => update('parentName', t)}
            placeholder="e.g., Alex"
            placeholderTextColor="#A4CDD3"
          />

          <Text style={styles.label}>Your pronouns</Text>
          <Choices options={['he/him', 'she/her', 'they/them', 'other']} value={data.pronouns} onPick={v => update('pronouns', v)} />

          <Text style={styles.label}>Your relationship to baby</Text>
          <Choices
            options={['mother', 'father', 'parent', 'guardian', 'other family member']}
            value={data.relationship}
            onPick={v => update('relationship', v)}
          />

          <Text style={styles.label}>Are you the primary caregiver?</Text>
          <Choices options={['yes', 'no', 'shared']} value={data.primaryCaregiver} onPick={v => update('primaryCaregiver', v)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}> {babies.length > 1 ? 'About Your Babies' : 'About Baby'}</Text>
          <Text style={styles.helperText}>
            Expecting, or already have little ones? Add each baby here. Twins, triplets or more? Tap "Add another baby". Each one gets their own logs.
          </Text>

          {babies.map((b, i) => (
            <View key={b.id ?? `new-${i}`} style={styles.babyCard}>
              <View style={styles.babyHeader}>
                <Text style={styles.babyTitle}>{b.name.trim() || (b.status === 'expected' ? `Baby ${i + 1} (expected)` : `Baby ${i + 1}`)}</Text>
                {!b.id && babies.length > 1 ? (
                  <Pressable onPress={() => removeBaby(i)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.label}>Has baby arrived yet?</Text>
              <Choices
                options={['already born', 'still expecting']}
                value={b.status === 'expected' ? 'still expecting' : 'already born'}
                onPick={v => updateBaby(i, 'status', v === 'still expecting' ? 'expected' : 'born')}
              />

              <Text style={styles.label}>{b.status === 'expected' ? 'Name (optional, you can add it later)' : 'Name'}</Text>
              <TextInput
                style={styles.input}
                value={b.name}
                onChangeText={(t: string) => updateBaby(i, 'name', t)}
                placeholder="e.g., Mia"
                placeholderTextColor="#A4CDD3"
              />

              {b.status === 'expected' ? (
                <>
                  <Text style={styles.label}>Due date</Text>
                  <TextInput
                    style={styles.input}
                    value={b.dueDate}
                    onChangeText={(t: string) => updateBaby(i, 'dueDate', formatDateInput(t))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#A4CDD3"
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                  <Text style={styles.helperText}>
                    {isValidDate(b.dueDate) ? `${Math.max(daysUntil(b.dueDate), 0)} days to go` : 'Just type the numbers, e.g. 20260314'}
                  </Text>
                  <Text style={styles.helperText}>
                    When baby arrives, come back to Settings → Babies → Edit and switch to "already born".
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Gender</Text>
                  <Choices options={['boy', 'girl', 'prefer not to say']} value={b.gender} onPick={v => updateBaby(i, 'gender', v)} />

                  <Text style={styles.label}>Birth date</Text>
                  <TextInput
                    style={styles.input}
                    value={b.birthDate}
                    onChangeText={(t: string) => updateBaby(i, 'birthDate', formatDateInput(t))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#A4CDD3"
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                  <Text style={styles.helperText}>Just type the numbers, e.g. 20250314</Text>

                  <Text style={styles.label}>Gestational age at birth</Text>
                  <Choices
                    options={['full-term', 'premature', 'post-term']}
                    value={b.gestationalAge}
                    onPick={v => updateBaby(i, 'gestationalAge', v)}
                  />

                  <Text style={styles.label}>Feeding type</Text>
                  <Choices options={['breast', 'formula', 'mixed']} value={b.feedingType} onPick={v => updateBaby(i, 'feedingType', v)} />
                </>
              )}
            </View>
          ))}

          <Pressable style={styles.addBaby} onPress={addBaby}>
            <Text style={styles.addBabyText}>+ Add another baby</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}> Care & Tracking</Text>
          <Text style={styles.label}>What would you like to track?</Text>
          <Text style={styles.helperText}>Select all that apply (optional)</Text>
          <View style={styles.choicesWrap}>
            {['sleep', 'feeding', 'diapers', 'milestones', 'growth', 'mood'].map(opt => (
              <Pressable
                key={opt}
                onPress={() => toggleTracking(opt)}
                style={[styles.choice, data.trackingPreferences.includes(opt) ? styles.choiceActive : null]}>
                <Text style={[styles.choiceText, data.trackingPreferences.includes(opt) && styles.choiceTextActive]}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable style={styles.submit} onPress={submit} disabled={saving}>
          <Text style={styles.submitText}>{saving ? 'Saving...' : 'Finish'}</Text>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09282eff',
  },
  card: {
    paddingTop: 80,
    paddingVertical: 32,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    color: '#E8FBFF',
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#A4CDD3',
    marginBottom: 20,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#11464e',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FED8FE',
    borderRadius: 10,
  },
  progressText: {
    fontSize: 12,
    color: '#A4CDD3',
    marginBottom: 24,
    textAlign: 'right',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    fontSize: 18,
    color: '#FED8FE',
    fontWeight: '600',
    marginBottom: 16,
  },
  label: {
    color: '#E8FBFF',
    marginTop: 14,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '500',
  },
  helperText: {
    color: '#A4CDD3',
    fontSize: 13,
    marginTop: -4,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#11464e',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    fontSize: 15,
    color: '#E8FBFF',
    borderWidth: 1,
    borderColor: '#2F9BA8',
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  choicesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  choice: {
    borderWidth: 2,
    borderColor: '#2F9BA8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(47, 155, 168, 0.1)',
  },
  choiceActive: {
    backgroundColor: '#FED8FE',
    borderColor: '#FED8FE',
    shadowColor: '#FED8FE',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  choiceText: {
    color: '#E8FBFF',
    textTransform: 'capitalize',
    fontSize: 14,
    fontWeight: '500',
  },
  choiceTextActive: {
    color: '#12454E',
    fontWeight: '700',
  },
  submit: {
    marginTop: 32,
    backgroundColor: '#FED8FE',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FED8FE',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  submitText: {
    color: '#12454E',
    fontWeight: '700',
    fontSize: 17,
  },
  babyCard: {
    borderWidth: 1,
    borderColor: '#2F9BA8',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#0f3a41ff',
  },
  babyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  babyTitle: { color: '#FED8FE', fontWeight: '700', fontSize: 16 },
  removeText: { color: '#A4CDD3', fontSize: 13, textDecorationLine: 'underline' },
  addBaby: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#FED8FE',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  addBabyText: { color: '#FED8FE', fontWeight: '600' },
});
