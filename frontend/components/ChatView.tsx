import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadError } from '@/components/LoadError';
import { ThemedView } from '@/components/themed-view';
import { ChatMessage } from '@/lib/neighbors';

// The look of every chat: header, bubbles (newest at the bottom), composer. Screens decide what the menu does.
export function ChatView({
  title, subtitle, me, messages, error, onRetry, onBack, onMenu, onSend, onLongPress, senderName, emptyText,
}: {
  title: string;
  subtitle?: string;
  me: string;
  messages: ChatMessage[]; // newest first
  error?: string;
  onRetry?: () => void;
  onBack: () => void;
  onMenu: () => void;
  onSend: (body: string) => Promise<void>;
  onLongPress: (m: ChatMessage) => void;
  senderName?: (m: ChatMessage) => string; // groups show who wrote each message
  emptyText: string;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      await onSend(body);
      setText('');
    } catch {
      // the screen shows its own error; the text stays so nothing is lost
    } finally {
      setSending(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={10}><Text style={styles.back}>← Back</Text></Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          <Pressable onPress={onMenu} hitSlop={10} accessibilityLabel="More options"><Text style={styles.dots}>⋯</Text></Pressable>
        </View>

        {error ? <View style={{ paddingHorizontal: 16 }}><LoadError message={error} onRetry={onRetry} /></View> : null}

        <FlatList
          inverted
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
          renderItem={({ item }) => {
            const mine = item.sender === me;
            return (
              <Pressable onLongPress={() => onLongPress(item)} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                {!mine && senderName ? <Text style={styles.sender}>{senderName(item)}</Text> : null}
                <Text style={[styles.bubbleText, mine && { color: '#09282eff' }]}>{item.body}</Text>
                <Text style={[styles.time, mine && { color: '#09282eaa' }]}>{new Date(item.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
              </Pressable>
            );
          }}
        />

        <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Write a message" placeholderTextColor="#A4CDD3" multiline maxLength={1000} />
          <Pressable style={[styles.send, (!text.trim() || sending) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || sending}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09282eff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#164a52' },
  back: { color: '#A4CDD3', fontSize: 14 },
  headerTitle: { color: '#FED8FE', fontSize: 18, fontWeight: '700', lineHeight: 24 },
  headerSub: { color: '#A4CDD3', fontSize: 11 },
  dots: { color: '#E8FBFF', fontSize: 26, lineHeight: 28 },
  list: { padding: 16, gap: 8 },
  empty: { color: '#A4CDD3', textAlign: 'center', lineHeight: 20, padding: 20, transform: [{ scaleY: -1 }] },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#FED8FE' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#0f3a41ff', borderWidth: 1, borderColor: '#2F9BA8' },
  sender: { color: '#FDFECC', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  bubbleText: { color: '#E8FBFF', fontSize: 15, lineHeight: 21 },
  time: { color: '#A4CDD3', fontSize: 10, marginTop: 2, alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#164a52' },
  input: { flex: 1, maxHeight: 120, borderWidth: 1, borderColor: '#2F9BA8', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, color: '#E8FBFF' },
  send: { backgroundColor: '#FED8FE', borderRadius: 18, paddingVertical: 11, paddingHorizontal: 16 },
  sendText: { color: '#09282eff', fontWeight: '700' },
});
