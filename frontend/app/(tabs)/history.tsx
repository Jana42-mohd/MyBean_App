import { StyleSheet, View, Text, ScrollView, Pressable, Alert, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { deleteLog, fetchLogs, updateLogNotes } from '@/lib/logs';
import { Baby, bornBabies, fetchBabies } from '@/lib/babies';
import { ALL_BABIES, BabyPicker } from '@/components/BabyPicker';
import { LoadError, friendlyError } from '@/components/LoadError';

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
  author?: string;
  baby?: string;
  baby_id?: string | null;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [babyFilter, setBabyFilter] = useState(ALL_BABIES);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<HistoryEntry | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'diaper' | 'feeding' | 'nap' | 'milestone' | 'mood' | 'pumping'>('all');

  const loadHistory = useCallback(async () => {
      try {
        setError('');
        const [rows, babyList] = await Promise.all([fetchLogs(), fetchBabies()]);
        setBabies(babyList);
        const entries: HistoryEntry[] = rows.map(r => ({
          id: r.id,
          type: r.type,
          timestamp: r.type === 'nap' ? r.data.start : r.type === 'milestone' ? r.data.date : r.data.time ?? r.logged_at,
          data: r.data,
          author: r.author,
          baby: r.baby,
          baby_id: r.baby_id,
        }));

        // Sort by timestamp (newest first)
        entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setHistory(entries);
      } catch (e) {
        console.error('Error loading history:', e);
        setError(friendlyError(e));
      }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

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

  const filteredHistory = history.filter(
    entry =>
      (selectedFilter === 'all' || entry.type === selectedFilter) &&
      (babyFilter === ALL_BABIES || entry.baby_id === babyFilter || entry.baby_id === null)
  );

  const confirmDelete = (entry: HistoryEntry) => {
    Alert.alert('Delete this entry?', 'This removes it for everyone in your household and cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLog(entry.id);
            setHistory(prev => prev.filter(h => h.id !== entry.id));
          } catch (e) {
            Alert.alert('Could not delete', friendlyError(e));
          }
        },
      },
    ]);
  };

  const startEdit = (entry: HistoryEntry) => {
    setEditing(entry);
    setEditNotes(entry.data?.notes ?? '');
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await updateLogNotes(editing.id, editing.data, editNotes);
      setEditing(null);
      loadHistory();
    } catch (e) {
      Alert.alert('Could not save', friendlyError(e));
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.title}>Activity History</ThemedText>
        <Text style={styles.subtitle}>Complete log of all tracked activities</Text>

        {/* Filter Buttons */}
        {error ? <LoadError message={error} onRetry={loadHistory} /> : null}
        <BabyPicker babies={bornBabies(babies)} value={babyFilter} onChange={setBabyFilter} />
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
                  <Text style={styles.timestamp}>
                    {entry.baby ? `${entry.baby} · ` : ''}{entry.author ? `${entry.author} · ` : ''}{formatDate(entry.timestamp)}
                  </Text>
                </View>
                {renderEntryDetails(entry)}
                <View style={styles.entryActions}>
                  <Pressable onPress={() => startEdit(entry)}><Text style={styles.actionText}>Edit note</Text></Pressable>
                  <Pressable onPress={() => confirmDelete(entry)}><Text style={[styles.actionText, styles.deleteText]}>Delete</Text></Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit note</Text>
            <TextInput
              style={styles.modalInput}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="Add a note"
              placeholderTextColor="#A4CDD3"
              multiline
            />
            <View style={styles.entryActions}>
              <Pressable onPress={() => setEditing(null)}><Text style={styles.actionText}>Cancel</Text></Pressable>
              <Pressable onPress={saveEdit}><Text style={[styles.actionText, { color: '#FED8FE' }]}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  entryActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 10 },
  actionText: { color: '#A4CDD3', fontSize: 13, fontWeight: '600' },
  deleteText: { color: '#ff9db1' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#0f3a41ff', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#2F9BA8' },
  modalTitle: { color: '#FED8FE', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: '#2F9BA8', borderRadius: 10, padding: 12, color: '#E8FBFF', minHeight: 70 },
  container: {
    flex: 1,
    backgroundColor: '#09282eff',
  },
  scrollContent: {
    paddingTop: 16,
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
