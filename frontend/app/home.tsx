import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useCallback, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LogRow, fetchLogs } from '@/lib/logs';
import { Baby, babyNames, bornBabies, daysUntil, expectedBabies, fetchBabies } from '@/lib/babies';
import { ALL_BABIES, BabyPicker } from '@/components/BabyPicker';
import { LoadError, friendlyError } from '@/components/LoadError';
import { getHousehold, loadSurvey } from '@/lib/household';
import { useFocusEffect, useRouter } from 'expo-router';

interface SurveyData {
  parentName: string;
  pronouns: string;
  relationship: string;
  numberOfChildren: string;
  primaryCaregiver: string;
  babyName: string;
  babyGender: string;
  babyBirthDate: string;
  gestationalAge: string;
  feedingType: string;
  trackingPreferences: string[];
}

interface LogEntry {
  type: 'feeding' | 'diaper' | 'sleep' | 'milestone' | 'mood' | 'medication' | 'photo';
  time: string;
  data: any;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<SurveyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [partners, setPartners] = useState<string[]>([]);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [selected, setSelected] = useState(ALL_BABIES);
  const [todayRows, setTodayRows] = useState<LogRow[]>([]);

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [survey, hh, babyList] = await Promise.all([loadSurvey(), getHousehold(), fetchBabies()]);
      setBabies(babyList);
      setPartners((hh?.members ?? []).map(m => m.name));
      if (survey) {
        setData(survey as SurveyData);
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { data: prof } = u.user
          ? await supabase.from('profiles').select('name').eq('id', u.user.id).maybeSingle()
          : { data: null };
        setData({ parentName: prof?.name || 'Parent' } as SurveyData);
      }

      // One query for today's logs (local midnight onward)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      setTodayRows(await fetchLogs(['diaper', 'feeding', 'nap'], 500, startOfDay.toISOString()));
    } catch (e) {
      console.error('Error loading data:', e);
      setError(friendlyError(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh whenever the screen comes into focus (e.g. after logging on the Track screen)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const todayStats = useMemo(() => {
    const rows = selected === ALL_BABIES ? todayRows : todayRows.filter(r => r.baby_id === selected);
    let sleepMinutes = 0;
    for (const r of rows) {
      if (r.type === 'nap') {
        const mins = Math.floor((new Date(r.data.end).getTime() - new Date(r.data.start).getTime()) / 60000);
        if (mins > 0) sleepMinutes += mins;
      }
    }
    return {
      feedings: rows.filter(r => r.type === 'feeding').length,
      diapers: rows.filter(r => r.type === 'diaper').length,
      sleepMinutes,
    };
  }, [todayRows, selected]);

  const formatSleepTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (isLoading || !data) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.greeting}>Hi {data.parentName}!</ThemedText>
          {bornBabies(babies).length > 0 ? (
            <Text style={styles.sectionTitle}>
              Today with {babyNames(bornBabies(babies))}
              {partners.length > 1 ? ` · with ${partners.filter(n => n !== data.parentName).join(' & ')}` : ''}
            </Text>
          ) : null}
        </View>

        {error ? <LoadError message={error} onRetry={loadData} /> : null}
        {expectedBabies(babies).map(b => {
          const days = b.due_date ? daysUntil(b.due_date) : null;
          const week = days !== null ? Math.min(Math.max(40 - Math.ceil(days / 7), 1), 42) : null;
          return (
            <View key={b.id} style={styles.statCard}>
              <Text style={styles.statLabel}>{b.name === 'Baby' ? 'Baby' : b.name} is on the way</Text>
              <Text style={styles.statValue}>
                {days === null ? '' : days > 0 ? `${days} days to go` : days === 0 ? 'Due today!' : `${-days} days past due date`}
              </Text>
              {week !== null && days! > 0 ? <Text style={styles.statLabel}>About week {week} of 40 · due {b.due_date}</Text> : null}
            </View>
          );
        })}
        <BabyPicker babies={bornBabies(babies)} value={selected} onChange={setSelected} />

        {/* Core Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Feedings</Text>
              <Text style={styles.statValue}>{todayStats.feedings}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Diapers</Text>
              <Text style={styles.statValue}>{todayStats.diapers}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Sleep</Text>
              <Text style={styles.statValue}>{formatSleepTime(todayStats.sleepMinutes)}</Text>
            </View>
          </View>
        </View>

        {/* Quick Log Section */}
        <View style={[styles.section, styles.quickLogSection]}>
          <Text style={styles.sectionTitle}>Quick Log</Text>
          <View style={styles.quickLogsGrid}>
            <Pressable style={styles.quickLogCard} onPress={() => router.push('/(tabs)/track')}>
              <MaterialCommunityIcons name="baby-bottle-outline" size={26} color="#FDFECC" />
              <Text style={styles.quickLogLabel}>Feeding</Text>
            </Pressable>
            <Pressable style={styles.quickLogCard} onPress={() => router.push('/(tabs)/track')}>
              <MaterialCommunityIcons name="baby-face-outline" size={26} color="#FDFECC" />
              <Text style={styles.quickLogLabel}>Diaper</Text>
            </Pressable>
            <Pressable style={styles.quickLogCard} onPress={() => router.push('/(tabs)/track')}>
              <MaterialCommunityIcons name="weather-night" size={26} color="#FDFECC" />
              <Text style={styles.quickLogLabel}>Sleep</Text>
            </Pressable>
            <Pressable style={styles.quickLogCard} onPress={() => router.push('/(tabs)/track')}>
              <MaterialCommunityIcons name="water-outline" size={26} color="#FDFECC" />
              <Text style={styles.quickLogLabel}>Pumping</Text>
            </Pressable>
            <Pressable style={styles.quickLogCard} onPress={() => router.push('/(tabs)/track')}>
              <MaterialCommunityIcons name="star-outline" size={26} color="#FDFECC" />
              <Text style={styles.quickLogLabel}>Milestones</Text>
            </Pressable>
            <Pressable style={styles.quickLogCard} onPress={() => router.push('/(tabs)/track')}>
              <MaterialCommunityIcons name="emoticon-happy-outline" size={26} color="#FDFECC" />
              <Text style={styles.quickLogLabel}>Mood & Behaviour</Text>
            </Pressable>
          </View>
        </View>

        {/* Growth & Development */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Growth & Development</Text>
          <Pressable style={styles.featureCard} onPress={() => router.push('/(tabs)/info')}>
            <View style={styles.featureContent}>
              <View style={styles.featureTextGroup}>
                <Text style={styles.featureTitle}>Growth Tracking</Text>
                <Text style={styles.featureSubtitle}>Weight, height, head circumference</Text>
              </View>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
          <Pressable style={styles.featureCard} onPress={() => router.push('/(tabs)/info')}>
            <View style={styles.featureContent}>
              <View style={styles.featureTextGroup}>
                <Text style={styles.featureTitle}>Milestones</Text>
                <Text style={styles.featureSubtitle}>Rolling, smiling, first words</Text>
              </View>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>

        {/* Health & Safety */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health & Safety</Text>
          <Pressable style={styles.featureCard} onPress={() => router.push('/(tabs)/info')}>
            <View style={styles.featureContent}>
              <View style={styles.featureTextGroup}>
                <Text style={styles.featureTitle}>Safe Sleep Guide</Text>
                <Text style={styles.featureSubtitle}>SIDS prevention checklist</Text>
              </View>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
          <Pressable style={styles.featureCard} onPress={() => router.push('/(tabs)/info')}>
            <View style={styles.featureContent}>
              <View style={styles.featureTextGroup}>
                <Text style={styles.featureTitle}>Red Flags</Text>
                <Text style={styles.featureSubtitle}>When to call the doctor</Text>
              </View>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>

        {/* Community & Support */}
        <View style={styles.section}>
          <Pressable style={[styles.featureCard, styles.communityCard]} onPress={() => router.push('/(tabs)/community')}>
            <View style={styles.featureContent}>
              <View style={styles.featureTextGroup}>
                <Text style={styles.featureTitle}>Community</Text>
                <Text style={styles.featureSubtitle}>Connect with other parents</Text>
              </View>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09282eff',
  },
  scrollContent: {
    paddingTop: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loadingText: {
    color: '#E8FBFF',
    fontSize: 16,
  },
  header: {
    marginBottom: 28,
  },
  greeting: {
    fontSize: 28,
    color: '#FED8FE',
    fontWeight: '700',
    marginBottom: 6,
  },
  subgreeting: {
    fontSize: 14,
    color: '#A4CDD3',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#FDFECC',
    fontWeight: '600',
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#0f3a41ff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2F9BA8',
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    color: '#A4CDD3',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    color: '#E8FBFF',
    fontWeight: '700',
  },
  quickLogsGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  quickLogSection: {
    marginBottom: 16,
  },
  quickLogCard: {
    // 3 per row: 30% basis + grow fills the row. (flex: 1 inside a wrapping row mis-measures height in RN.)
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
  quickLogLabel: {
    fontSize: 11,
    color: '#E8FBFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f3a41ff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2F9BA8',
    marginBottom: 10,
  },
  communityCard: {
    borderColor: '#FED8FE',
    borderWidth: 1.5,
  },
  featureContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  featureTextGroup: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 15,
    color: '#E8FBFF',
    fontWeight: '700',
  },
  featureSubtitle: {
    fontSize: 12,
    color: '#A4CDD3',
  },
  arrow: {
    fontSize: 20,
    color: '#FDFECC',
    fontWeight: '300',
  },
  primaryButton: {
    backgroundColor: '#FED8FE',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#09282eff',
    fontWeight: '700',
    fontSize: 16,
  },
});
