import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

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
  const router = useRouter();
  const [data, setData] = useState<SurveyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [todayStats, setTodayStats] = useState({
    feedings: 0,
    diapers: 0,
    sleepMinutes: 0,
    lastUpdate: new Date(),
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const saved = await AsyncStorage.getItem('surveyData');
        if (saved) {
          setData(JSON.parse(saved));
        } else {
          // Set default data so the screen still works
          setData({
            parentName: 'Parent',
            pronouns: '',
            relationship: '',
            numberOfChildren: '',
            primaryCaregiver: '',
            babyName: 'Baby',
            babyGender: '',
            babyBirthDate: new Date().toISOString(),
            gestationalAge: '',
            feedingType: '',
            trackingPreferences: [],
          });
        }
        
        // Load today's logs from individual tracking keys
        const now = new Date();
        const today = now.toLocaleDateString('en-US');
        
        // Load all activity types
        const diaperLogs = await AsyncStorage.getItem('logs_diapers');
        const feedingLogs = await AsyncStorage.getItem('logs_feedings');
        const napLogs = await AsyncStorage.getItem('logs_naps');
        
        let feedings = 0;
        let diapers = 0;
        let sleepMinutes = 0;
        
        // Count diapers from today
        if (diaperLogs) {
          const parsed = JSON.parse(diaperLogs);
          diapers = parsed.filter((log: any) => {
            const logDate = new Date(log.time).toLocaleDateString('en-US');
            return logDate === today;
          }).length;
        }
        
        // Count feedings from today
        if (feedingLogs) {
          const parsed = JSON.parse(feedingLogs);
          feedings = parsed.filter((log: any) => {
            const logDate = new Date(log.time).toLocaleDateString('en-US');
            return logDate === today;
          }).length;
        }
        
        // Count sleep from today
        if (napLogs) {
          const parsed = JSON.parse(napLogs);
          parsed.forEach((log: any) => {
            const logDate = new Date(log.start).toLocaleDateString('en-US');
            if (logDate === today) {
              try {
                const start = new Date(log.start);
                const end = new Date(log.end);
                const minutes = Math.floor((end.getTime() - start.getTime()) / 60000);
                sleepMinutes += minutes;
              } catch (e) {
                // Invalid date format, skip
              }
            }
          });
        }
        
        setTodayStats({ feedings, diapers, sleepMinutes, lastUpdate: new Date() });
        setIsLoading(false);
      } catch (e) {
        console.error('Error loading data:', e);
        setIsLoading(false);
      }
    };
    loadData();
    
    // Set up interval to refresh data every 5 seconds so it updates when track screen logs
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatSleepTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (isLoading || !data) {
    return (
      <ThemedView style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.greeting}>Hi {data.parentName}!</ThemedText>
        </View>

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
              <Text style={styles.quickLogLabel}>Feeding</Text>
            </Pressable>
            <Pressable style={styles.quickLogCard} onPress={() => router.push('/(tabs)/track')}>
              <Text style={styles.quickLogLabel}>Diaper</Text>
            </Pressable>
            <Pressable style={styles.quickLogCard} onPress={() => router.push('/(tabs)/track')}>
              <Text style={styles.quickLogLabel}>Sleep</Text>
            </Pressable>
            <Pressable style={styles.quickLogCard} onPress={() => router.push('/(tabs)/track')}>
              <Text style={styles.quickLogLabel}>Pumping</Text>
            </Pressable>
            <Pressable style={styles.quickLogCard} onPress={() => router.push('/(tabs)/track')}>
              <Text style={styles.quickLogLabel}>Milestones</Text>
            </Pressable>
            <Pressable style={styles.quickLogCard} onPress={() => router.push('/(tabs)/track')}>
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
    paddingTop: 80,
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
    marginBottom: 75,
  },
  quickLogCard: {
    flex: 1,
    minWidth: 70,
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
