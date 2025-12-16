// @ts-nocheck
import React, { useEffect, useState } from 'react';
// @ts-ignore
import { StyleSheet, View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

interface SurveyData {
  parentName: string;
  pronouns: 'he/him' | 'she/her' | 'they/them' | 'other' | '';
  relationship: 'mother' | 'father' | 'parent' | 'guardian' | 'other family member' | '';
  numberOfChildren: string;
  primaryCaregiver: 'yes' | 'no' | 'shared' | '';
  babyName: string;
  babyGender: 'boy' | 'girl' | 'prefer not to say' | '';
  babyBirthDate: string;
  gestationalAge: 'full-term' | 'premature' | 'post-term' | '';
  feedingType: 'breast' | 'formula' | 'mixed' | ''; 
  trackingPreferences: string[]; 
}

export default function SurveyScreen() {
  const router = useRouter();
  const [data, setData] = useState<SurveyData>({
    parentName: '',
    pronouns: '',
    relationship: '',
    numberOfChildren: '',
    primaryCaregiver: '',
    babyName: '',
    babyGender: '',
    babyBirthDate: '',
    gestationalAge: '',
    feedingType: '',
    trackingPreferences: [],
  });
  const [loading, setLoading] = useState(false);

  // Stateless: no persistence or preload for now
  useEffect(() => {
    setLoading(false);
  }, []);

  const update = (key: keyof SurveyData, value: string) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const toggleTracking = (pref: string) => {
    setData(prev => ({
      ...prev,
      trackingPreferences: prev.trackingPreferences.includes(pref)
        ? prev.trackingPreferences.filter(p => p !== pref)
        : [...prev.trackingPreferences, pref]
    }));
  };

  const getProgress = () => {
    const fields = [
      data.parentName, data.pronouns, data.relationship, data.numberOfChildren,
      data.primaryCaregiver, data.babyName, data.babyGender, data.babyBirthDate,
      data.gestationalAge, data.feedingType
    ];
    const filled = fields.filter(f => f).length;
    return Math.round((filled / fields.length) * 100);
  };

  const submit = async () => {
    if (!data.parentName || !data.pronouns || !data.relationship || !data.numberOfChildren ||
        !data.primaryCaregiver || !data.babyName || !data.babyGender || !data.babyBirthDate ||
        !data.gestationalAge || !data.feedingType) {
      Alert.alert('Missing info', 'Please fill out all fields.');
      return;
    }
    // Stateless: do not persist, simply proceed to home
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
        <View style={styles.choices}>
          {['he/him','she/her','they/them','other'].map(opt => (
            <Pressable
              key={opt}
              onPress={() => update('pronouns', opt)}
              style={[styles.choice, data.pronouns === opt ? styles.choiceActive : null]}
            >
              <Text style={[styles.choiceText, data.pronouns === opt && styles.choiceTextActive]}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Your relationship to baby</Text>
        <View style={styles.choices}>
          {['mother','father','parent','guardian','other family member'].map(opt => (
            <Pressable
              key={opt}
              onPress={() => update('relationship', opt)}
              style={[styles.choice, data.relationship === opt ? styles.choiceActive : null]}
            >
              <Text style={[styles.choiceText, data.relationship === opt && styles.choiceTextActive]}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Number of children (including this baby)</Text>
        <TextInput
          style={styles.input}
          value={data.numberOfChildren}
          onChangeText={(t: string) => update('numberOfChildren', t)}
          placeholder="e.g., 1"
          placeholderTextColor="#A4CDD3"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Are you the primary caregiver?</Text>
        <View style={styles.choices}>
          {['yes','no','shared'].map(opt => (
            <Pressable
              key={opt}
              onPress={() => update('primaryCaregiver', opt)}
              style={[styles.choice, data.primaryCaregiver === opt ? styles.choiceActive : null]}
            >
              <Text style={[styles.choiceText, data.primaryCaregiver === opt && styles.choiceTextActive]}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}> About Baby</Text>
          
          <Text style={styles.label}>Baby's name</Text>
          <TextInput
            style={styles.input}
            value={data.babyName}
            onChangeText={(t: string) => update('babyName', t)}
            placeholder="e.g., Mia"
            placeholderTextColor="#A4CDD3"
          />

        <Text style={styles.label}>Baby's gender</Text>
        <View style={styles.choices}>
          {['boy','girl','prefer not to say'].map(opt => (
            <Pressable
              key={opt}
              onPress={() => update('babyGender', opt)}
              style={[styles.choice, data.babyGender === opt ? styles.choiceActive : null]}
            >
              <Text style={[styles.choiceText, data.babyGender === opt && styles.choiceTextActive]}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Baby's birth date</Text>
        <TextInput
          style={styles.input}
          value={data.babyBirthDate}
          onChangeText={(t: string) => update('babyBirthDate', t)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#A4CDD3"
        />

        <Text style={styles.label}>Gestational age at birth</Text>
        <View style={styles.choices}>
          {['full-term','premature','post-term'].map(opt => (
            <Pressable
              key={opt}
              onPress={() => update('gestationalAge', opt)}
              style={[styles.choice, data.gestationalAge === opt ? styles.choiceActive : null]}
            >
              <Text style={[styles.choiceText, data.gestationalAge === opt && styles.choiceTextActive]}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}> Care & Tracking</Text>
          
          <Text style={styles.label}>Feeding type</Text>
          <View style={styles.choices}>
            {['breast','formula','mixed'].map(opt => (
              <Pressable
                key={opt}
                onPress={() => update('feedingType', opt)}
                style={[styles.choice, data.feedingType === opt ? styles.choiceActive : null]}
              >
                <Text style={[styles.choiceText, data.feedingType === opt && styles.choiceTextActive]}>{opt}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>What would you like to track?</Text>
          <Text style={styles.helperText}>Select all that apply (optional)</Text>
        <View style={styles.choicesWrap}>
          {['sleep','feeding','diapers','milestones','growth','mood'].map(opt => (
            <Pressable
              key={opt}
              onPress={() => toggleTracking(opt)}
              style={[styles.choice, data.trackingPreferences.includes(opt) ? styles.choiceActive : null]}
            >
              <Text style={[styles.choiceText, data.trackingPreferences.includes(opt) && styles.choiceTextActive]}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        </View>

        <Pressable style={styles.submit} onPress={submit}>
          <Text style={styles.submitText}>Finish</Text>
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
});
