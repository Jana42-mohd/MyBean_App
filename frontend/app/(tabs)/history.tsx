import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DiaperLog { time: string; type: 'pee' | 'poop'; color?: string; consistency?: string; notes?: string }
interface FeedingLog { time: string; method: 'breast' | 'formula' | 'mixed'; amount?: string; nextInHours?: string }
interface NapLog { start: string; end: string; notes?: string }
interface MilestoneLog { date: string; milestone: string; notes?: string }
interface MoodLog { time: string; mood: 'happy' | 'fussy' | 'sleeping' | 'crying' | 'calm'; notes?: string }
interface PumpLog { time: string; volumeOz: string; side: 'left' | 'right' | 'both'; ampm: 'AM' | 'PM' }

interface HistoryEntry {
  id: string;
  type: 'diaper' | 'feeding' | 'nap' | 'milestone' | 'mood' | 'pumping';
  timestamp: string;
  data: any;
}

const STORAGE_KEYS = {
  naps: 'logs_naps',
  diapers: 'logs_diapers',
  feedings: 'logs_feedings',
  pumping: 'logs_pumping',
  milestones: 'logs_milestones',
  mood: 'logs_mood',
};

export default function HistoryScreen() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'diaper' | 'feeding' | 'nap' | 'milestone' | 'mood' | 'pumping'>('all');

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const entries: HistoryEntry[] = [];

        // Load diapers
        const diaperLogs = await AsyncStorage.getItem(STORAGE_KEYS.diapers);
        if (diaperLogs) {
          const parsed = JSON.parse(diaperLogs);
          parsed.forEach((log: DiaperLog, idx: number) => {
            entries.push({
              id: `diaper_${idx}`,
              type: 'diaper',
              timestamp: log.time,
              data: log,
            });
          });
        }

        // Load feedings
        const feedingLogs = await AsyncStorage.getItem(STORAGE_KEYS.feedings);
        if (feedingLogs) {
          const parsed = JSON.parse(feedingLogs);
          parsed.forEach((log: FeedingLog, idx: number) => {
            entries.push({
              id: `feeding_${idx}`,
              type: 'feeding',
              timestamp: log.time,
              data: log,
            });
          });
        }

        // Load naps
        const napLogs = await AsyncStorage.getItem(STORAGE_KEYS.naps);
        if (napLogs) {
          const parsed = JSON.parse(napLogs);
          parsed.forEach((log: NapLog, idx: number) => {
            entries.push({
              id: `nap_${idx}`,
              type: 'nap',
              timestamp: log.start,
              data: log,
            });
          });
        }

        // Load milestones
        const milestoneLogs = await AsyncStorage.getItem(STORAGE_KEYS.milestones);
        if (milestoneLogs) {
          const parsed = JSON.parse(milestoneLogs);
          parsed.forEach((log: MilestoneLog, idx: number) => {
            entries.push({
              id: `milestone_${idx}`,
              type: 'milestone',
              timestamp: log.date,
              data: log,
            });
          });
        }

        // Load moods
        const moodLogs = await AsyncStorage.getItem(STORAGE_KEYS.mood);
        if (moodLogs) {
          const parsed = JSON.parse(moodLogs);
          parsed.forEach((log: MoodLog, idx: number) => {
            entries.push({
              id: `mood_${idx}`,
              type: 'mood',
              timestamp: log.time,
              data: log,
            });
          });
        }

        // Load pumping
        const pumpLogs = await AsyncStorage.getItem(STORAGE_KEYS.pumping);
        if (pumpLogs) {
          const parsed = JSON.parse(pumpLogs);
          parsed.forEach((log: PumpLog, idx: number) => {
            entries.push({
              id: `pump_${idx}`,
              type: 'pumping',
              timestamp: log.time,
              data: log,
            });
          });
        }

        // Sort by timestamp (newest first)
        entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setHistory(entries);
      } catch (e) {
        console.error('Error loading history:', e);
      }
    };

    loadHistory();
    // Refresh every 5 seconds
    const interval = setInterval(loadHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  const renderEntryDetails = (entry: HistoryEntry) => {
    switch (entry.type) {
      case 'diaper':
        return (
          <View style={styles.entryDetails}>
            <Text style={styles.detailText}>Type: <Text style={styles.detailValue}>{entry.data.type}</Text></Text>
            {entry.data.color && <Text style={styles.detailText}>Color: <Text style={styles.detailValue}>{entry.data.color}</Text></Text>}
            {entry.data.consistency && <Text style={styles.detailText}>Consistency: <Text style={styles.detailValue}>{entry.data.consistency}</Text></Text>}
            {entry.data.notes && <Text style={styles.detailText}>Notes: <Text style={styles.detailValue}>{entry.data.notes}</Text></Text>}
          </View>
        );
      case 'feeding':
        return (
          <View style={styles.entryDetails}>
            <Text style={styles.detailText}>Method: <Text style={styles.detailValue}>{entry.data.method}</Text></Text>
            {entry.data.amount && <Text style={styles.detailText}>Amount: <Text style={styles.detailValue}>{entry.data.amount}</Text></Text>}
            {entry.data.nextInHours && <Text style={styles.detailText}>Next in: <Text style={styles.detailValue}>{entry.data.nextInHours}h</Text></Text>}
          </View>
        );
      case 'nap':
        return (
          <View style={styles.entryDetails}>
            <Text style={styles.detailText}>Start: <Text style={styles.detailValue}>{formatDate(entry.data.start)}</Text></Text>
            <Text style={styles.detailText}>End: <Text style={styles.detailValue}>{formatDate(entry.data.end)}</Text></Text>
            {entry.data.notes && <Text style={styles.detailText}>Notes: <Text style={styles.detailValue}>{entry.data.notes}</Text></Text>}
          </View>
        );
      case 'milestone':
        return (
          <View style={styles.entryDetails}>
            <Text style={styles.detailText}>Milestone: <Text style={styles.detailValue}>{entry.data.milestone}</Text></Text>
            {entry.data.notes && <Text style={styles.detailText}>Notes: <Text style={styles.detailValue}>{entry.data.notes}</Text></Text>}
          </View>
        );
      case 'mood':
        return (
          <View style={styles.entryDetails}>
            <Text style={styles.detailText}>Mood: <Text style={styles.detailValue}>{entry.data.mood}</Text></Text>
            {entry.data.notes && <Text style={styles.detailText}>Notes: <Text style={styles.detailValue}>{entry.data.notes}</Text></Text>}
          </View>
        );
      case 'pumping':
        return (
          <View style={styles.entryDetails}>
            <Text style={styles.detailText}>Volume: <Text style={styles.detailValue}>{entry.data.volumeOz} oz</Text></Text>
            <Text style={styles.detailText}>Side: <Text style={styles.detailValue}>{entry.data.side}</Text></Text>
            <Text style={styles.detailText}>Time: <Text style={styles.detailValue}>{entry.data.ampm}</Text></Text>
          </View>
        );
      default:
        return null;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      diaper: 'Diaper',
      feeding: 'Feeding',
      nap: 'Nap',
      milestone: 'Milestone',
      mood: 'Mood',
      pumping: 'Pumping',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      diaper: '#FFB6C1',
      feeding: '#FED8FE',
      nap: '#87CEEB',
      milestone: '#FDFECC',
      mood: '#DDA0DD',
      pumping: '#98FB98',
    };
    return colors[type] || '#A4CDD3';
  };

  const filteredHistory = selectedFilter === 'all' 
    ? history 
    : history.filter(entry => entry.type === selectedFilter);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.title}>Activity History</ThemedText>
        <Text style={styles.subtitle}>Complete log of all tracked activities</Text>

        {/* Filter Buttons */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <Pressable 
            style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterButtonText, selectedFilter === 'all' && styles.filterButtonTextActive]}>All</Text>
          </Pressable>
          {['diaper', 'feeding', 'nap', 'milestone', 'mood', 'pumping'].map(type => (
            <Pressable
              key={type}
              style={[styles.filterButton, selectedFilter === type && styles.filterButtonActive]}
              onPress={() => setSelectedFilter(type as any)}
            >
              <Text style={[styles.filterButtonText, selectedFilter === type && styles.filterButtonTextActive]}>
                {getTypeLabel(type)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* History List */}
        {filteredHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No activities recorded yet</Text>
          </View>
        ) : (
          <View style={styles.historyList}>
            {filteredHistory.map((entry, idx) => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <View style={[styles.typeTag, { backgroundColor: getTypeColor(entry.type) }]}>
                    <Text style={styles.typeTagText}>{getTypeLabel(entry.type)}</Text>
                  </View>
                  <Text style={styles.timestamp}>{formatDate(entry.timestamp)}</Text>
                </View>
                {renderEntryDetails(entry)}
              </View>
            ))}
          </View>
        )}
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
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    color: '#FED8FE',
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#A4CDD3',
    marginBottom: 20,
  },
  filterScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#0f3a41ff',
    borderWidth: 1,
    borderColor: '#2F9BA8',
  },
  filterButtonActive: {
    backgroundColor: '#FED8FE',
    borderColor: '#FED8FE',
  },
  filterButtonText: {
    color: '#E8FBFF',
    fontSize: 12,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#09282eff',
  },
  historyList: {
    gap: 12,
  },
  entryCard: {
    backgroundColor: '#0f3a41ff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2F9BA8',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  typeTag: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  typeTagText: {
    color: '#09282eff',
    fontWeight: '700',
    fontSize: 12,
  },
  timestamp: {
    color: '#A4CDD3',
    fontSize: 12,
  },
  entryDetails: {
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#E8FBFF',
  },
  detailValue: {
    color: '#FDFECC',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#A4CDD3',
    fontSize: 14,
  },
});
