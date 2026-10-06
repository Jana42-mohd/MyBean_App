import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActionSheet } from '@/components/ActionSheet';
import { ChatView } from '@/components/ChatView';
import { friendlyError } from '@/components/LoadError';
import {
  ChatMessage, Connection, REPORT_REASONS, placeLabel, blockParent, deleteMessage, fetchMessages, myConnections, removeConnection, reportParent, sendMessage,
} from '@/lib/neighbors';
import { supabase } from '@/lib/supabase';
import { markChatRead } from '@/lib/unread';

const POLL_MS = 5000;

export default function ChatScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [me, setMe] = useState('');
  const [other, setOther] = useState<Connection | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]); // newest first
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState<{ messageId?: string } | null>(null);
  const alive = useRef(true);
  const marked = useRef('');   // time of the newest message already reported as read

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const list = await fetchMessages(id);
      setMessages(list);
      setError('');
      // everything on screen has been seen: tell the server (and the badge) how far we have read
      const newest = list[0]?.created_at;
      if (newest && newest > marked.current) {
        marked.current = newest;
        markChatRead(id, newest);
      }
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

  // No live channel for chats: refresh while the screen is open, every few seconds
  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, POLL_MS);
      return () => clearInterval(t);
    }, [load]),
  );

  const title = other?.name ?? name ?? 'Chat';

  const send = async (body: string) => {
    try {
      const m = await sendMessage(id!, body);
      setMessages(prev => [m, ...prev]);
      marked.current = m.created_at;
    } catch (e) {
      Alert.alert('Could not send', friendlyError(e));
      throw e;
    }
  };

  const longPress = (m: ChatMessage) => {
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
    Alert.alert(`Block ${title}?`, 'You will not see each other any more, and this chat and its messages are deleted for both of you. You also leave any group you share with them.', [
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
    <>
      <ChatView
        title={title}
        subtitle={other ? placeLabel(other) : undefined}
        me={me}
        messages={messages}
        error={error}
        onRetry={load}
        onBack={() => router.back()}
        onMenu={() => setMenu(true)}
        onSend={send}
        onLongPress={longPress}
        emptyText={`Say hello to ${title}. Be kind, and keep personal details private until you know each other.`}
      />
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        items={[
          { label: `Report ${title}`, onPress: () => setReporting({}) },
          { label: `Block ${title}`, onPress: block, destructive: true },
          { label: 'Disconnect', onPress: disconnect },
        ]}
      />
      <ActionSheet
        visible={!!reporting}
        onClose={() => setReporting(null)}
        title={reporting?.messageId ? 'Report this message' : `Report ${title}`}
        items={REPORT_REASONS.map(r => ({ label: r.label, onPress: () => sendReport(r.key) }))}
      />
    </>
  );
}
