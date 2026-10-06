import { StyleSheet, View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { deleteLog, fetchLogs } from '@/lib/logs';
import { EditEntry } from '@/components/EditEntry';
import { useLiveRefresh } from '@/hooks/use-live';
import { toDate } from '@/lib/time';
import { formatLength, formatWeight } from '@/lib/growth';
import { useUnits } from '@/lib/units';
import { Baby, bornBabies, fetchBabies } from '@/lib/babies';
import { ALL_BABIES, BabyPicker } from '@/components/BabyPicker';
import { LoadError, friendlyError } from '@/components/LoadError';
import { Palette, useStyles, useTheme } from '@/lib/theme';


interface HistoryEntry {
  id: string;
  type: 'diaper' | 'feeding' | 'nap' | 'milestone' | 'mood' | 'pumping' | 'growth';
  timestamp: string;
  data: any;
  author?: string;
  baby?: string;
  baby_id?: string | null;
  pending?: boolean;
}

export default function HistoryScreen() {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [units] = useUnits();
  const [babies, setBabies] = useState<Baby[]>([]);
  const [babyFilter, setBabyFilter] = useState(ALL_BABIES);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<HistoryEntry | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'diaper' | 'feeding' | 'nap' | 'milestone' | 'mood' | 'pumping' | 'growth'>('all');

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
          pending: r.pending,
        }));

        // Sort by timestamp (newest first)
        entries.sort((a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime());
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
  useLiveRefresh(loadHistory);

  const formatDate = (dateStr: string) => {
    try {
      const date = toDate(dateStr);
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
      case 'growth':
        return (
          <View style={styles.entryDetails}>
            {entry.data.weightKg !== undefined && <Text style={styles.detailText}>Weight: <Text style={styles.detailValue}>{formatWeight(entry.data.weightKg, units)}</Text></Text>}
            {entry.data.lengthCm !== undefined && <Text style={styles.detailText}>Length: <Text style={styles.detailValue}>{formatLength(entry.data.lengthCm, units)}</Text></Text>}
            {entry.data.headCm !== undefined && <Text style={styles.detailText}>Head: <Text style={styles.detailValue}>{formatLength(entry.data.headCm, units)}</Text></Text>}
            {entry.data.notes && <Text style={styles.detailText}>Notes: <Text style={styles.detailValue}>{entry.data.notes}</Text></Text>}
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
      growth: 'Growth',
    };
    return labels[type] || type;
  };

  // One colour per kind of entry: soft on the dark cards, deeper on the light ones
  const getTypeColor = (type: string) => {
    const byType: Record<string, string> =
      colors.scheme === 'dark'
        ? { diaper: '#FFB6C1', feeding: '#E4B1D6', nap: '#87CEEB', milestone: '#E8E2A0', mood: '#C9A3E0', pumping: '#98E8A8', growth: '#9fd0ff' }
        : { diaper: '#C25E8E', feeding: '#9A57A6', nap: '#2F7FB0', milestone: '#9A7400', mood: '#8450B0', pumping: '#2F8F68', growth: '#2A78D6' };
    return byType[type] || colors.muted;
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
            await deleteLog(entry.id, entry.data?.photo);
            setHistory(prev => prev.filter(h => h.id !== entry.id));
          } catch (e) {
            Alert.alert('Could not delete', friendlyError(e));
          }
        },
      },
    ]);
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
          {['diaper', 'feeding', 'nap', 'milestone', 'mood', 'pumping', 'growth'].map(type => (
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
                {entry.pending ? (
                  <View style={styles.entryActions}>
                    <Text style={styles.actionText}>⏳ Saved on this phone, waiting to sync</Text>
                  </View>
                ) : (
                  <View style={styles.entryActions}>
                    <Pressable onPress={() => setEditing(entry)}><Text style={styles.actionText}>Edit</Text></Pressable>
                    <Pressable onPress={() => confirmDelete(entry)}><Text style={[styles.actionText, styles.deleteText]}>Delete</Text></Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <EditEntry entry={editing as any} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); loadHistory(); }} />
    </ThemedView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  entryActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 10 },
  actionText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  deleteText: { color: colors.danger },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.card, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border },
  modalTitle: { color: colors.heading, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, minHeight: 70 },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    color: colors.heading,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: colors.onAccent,
  },
  historyList: {
    gap: 12,
  },
  entryCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.onAccent,
    fontWeight: '700',
    fontSize: 12,
  },
  timestamp: {
    color: colors.muted,
    fontSize: 12,
  },
  entryDetails: {
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: colors.text,
  },
  detailValue: {
    color: colors.link,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
  },
});
