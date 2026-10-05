import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadError, friendlyError } from '@/components/LoadError';
import { ThemedView } from '@/components/themed-view';
import {
  ChatMessage, Connection, REPORT_REASONS, blockParent, deleteMessage, fetchMessages, myConnections, removeConnection, reportParent, sendMessage,
} from '@/lib/neighbors';
import { supabase } from '@/lib/supabase';

const POLL_MS = 5000;

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [me, setMe] = useState('');
  const [other, setOther] = useState<Connection | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]); // newest first
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState<{ messageId?: string } | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setMessages(await fetchMessages(id));
      setError('');
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [id]);

  useEffect(() => {
    alive.current = true;
    supabase.auth.getSession().then(({ data }) => setMe(data.session?.user.id ?? ''));
    myConnections().then(rows => alive.current && setOther(rows.find(r => r.id === id) ?? null)).catch(() => {});
    return () => { alive.current = false; };
  }, [id]);

  // No live channel for chats: refresh when the screen is open, every few seconds
  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, POLL_MS);
      return () => clearInterval(t);
    }, [load]),
  );

  const title = other?.name ?? name ?? 'Chat';

  const send = async () => {
    const body = text.trim();
    if (!body || !id) return;
    setSending(true);
    try {
      const m = await sendMessage(id, body);
      setText('');
      setMessages(prev => [m, ...prev]);
    } catch (e) {
      Alert.alert('Could not send', friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  const messageActions = (m: ChatMessage) => {
    if (m.sender === me) {
      Alert.alert('Message', undefined, [
        { text: 'Delete', style: 'destructive', onPress: () => deleteMessage(m.id).then(load).catch(e => Alert.alert('Could not delete', friendlyError(e))) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert('Message', undefined, [
        { text: 'Report this message', onPress: () => setReporting({ messageId: m.id }) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const block = () =>
    Alert.alert(`Block ${title}?`, 'You will not see each other any more, and this chat and its messages are deleted for both of you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            if (!other) throw new Error('Could not find this person');
            await blockParent(other.other_id);
            router.back();
          } catch (e) {
            Alert.alert('Could not block', friendlyError(e));
          }
        },
      },
    ]);

  const disconnect = () =>
    Alert.alert(`Disconnect from ${title}?`, 'The chat and its messages are deleted for both of you. You could connect again later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeConnection(id!);
            router.back();
          } catch (e) {
            Alert.alert('Could not disconnect', friendlyError(e));
          }
        },
      },
    ]);

  const sendReport = async (reason: string) => {
    const target = other?.other_id;
    const messageId = reporting?.messageId;
    setReporting(null);
    try {
      if (!target) throw new Error('Could not find this person');
      await reportParent(target, reason, undefined, messageId);
      Alert.alert('Thank you', 'A moderator will look at this. You can also block them so you do not see each other.');
    } catch (e) {
      Alert.alert('Could not send the report', friendlyError(e));
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}><Text style={styles.back}>← Back</Text></Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <Pressable onPress={() => setMenu(true)} hitSlop={10} accessibilityLabel="More options"><Text style={styles.dots}>⋯</Text></Pressable>
        </View>

        {error ? <View style={{ paddingHorizontal: 16 }}><LoadError message={error} onRetry={load} /></View> : null}

        <FlatList
          inverted
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Say hello to {title}. Be kind, and keep personal details private until you know each other.</Text>}
          renderItem={({ item }) => (
            <Pressable onLongPress={() => messageActions(item)} style={[styles.bubble, item.sender === me ? styles.mine : styles.theirs]}>
              <Text style={[styles.bubbleText, item.sender === me && { color: '#09282eff' }]}>{item.body}</Text>
              <Text style={[styles.time, item.sender === me && { color: '#09282eaa' }]}>{new Date(item.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
            </Pressable>
          )}
        />

        <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Write a message" placeholderTextColor="#A4CDD3" multiline maxLength={1000} />
          <Pressable style={[styles.send, (!text.trim() || sending) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || sending}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenu(false)}>
          <View style={styles.sheet}>
            <Pressable style={styles.item} onPress={() => { setMenu(false); setReporting({}); }}><Text style={styles.itemText}>Report {title}</Text></Pressable>
            <Pressable style={styles.item} onPress={() => { setMenu(false); block(); }}><Text style={[styles.itemText, { color: '#ff9db1' }]}>Block {title}</Text></Pressable>
            <Pressable style={styles.item} onPress={() => { setMenu(false); disconnect(); }}><Text style={styles.itemText}>Disconnect</Text></Pressable>
            <Pressable style={styles.item} onPress={() => setMenu(false)}><Text style={[styles.itemText, { color: '#A4CDD3' }]}>Cancel</Text></Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!reporting} transparent animationType="fade" onRequestClose={() => setReporting(null)}>
        <Pressable style={styles.backdrop} onPress={() => setReporting(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{reporting?.messageId ? 'Report this message' : `Report ${title}`}</Text>
            {REPORT_REASONS.map(r => (
              <Pressable key={r.key} style={styles.item} onPress={() => sendReport(r.key)}><Text style={styles.itemText}>{r.label}</Text></Pressable>
            ))}
            <Pressable style={styles.item} onPress={() => setReporting(null)}><Text style={[styles.itemText, { color: '#A4CDD3' }]}>Cancel</Text></Pressable>
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09282eff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#164a52' },
  back: { color: '#A4CDD3', fontSize: 14 },
  headerTitle: { color: '#FED8FE', fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center', lineHeight: 24 },
  dots: { color: '#E8FBFF', fontSize: 26, lineHeight: 28 },
  list: { padding: 16, gap: 8 },
  empty: { color: '#A4CDD3', textAlign: 'center', lineHeight: 20, padding: 20, transform: [{ scaleY: -1 }] },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#FED8FE' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#0f3a41ff', borderWidth: 1, borderColor: '#2F9BA8' },
  bubbleText: { color: '#E8FBFF', fontSize: 15, lineHeight: 21 },
  time: { color: '#A4CDD3', fontSize: 10, marginTop: 2, alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#164a52' },
  input: { flex: 1, maxHeight: 120, borderWidth: 1, borderColor: '#2F9BA8', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, color: '#E8FBFF' },
  send: { backgroundColor: '#FED8FE', borderRadius: 18, paddingVertical: 11, paddingHorizontal: 16 },
  sendText: { color: '#09282eff', fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#0f3a41ff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 12, paddingBottom: 30, borderWidth: 1, borderColor: '#2F9BA8' },
  sheetTitle: { color: '#FED8FE', fontSize: 18, fontWeight: '700', padding: 12 },
  item: { padding: 14 },
  itemText: { color: '#E8FBFF', fontSize: 16 },
});
