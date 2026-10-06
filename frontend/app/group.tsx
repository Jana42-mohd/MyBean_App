import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionSheet } from '@/components/ActionSheet';
import { Avatar } from '@/components/Avatar';
import { ChatView } from '@/components/ChatView';
import { friendlyError } from '@/components/LoadError';
import {
  Group, GroupPerson, MAX_GROUP_SIZE, deleteGroup, deleteGroupMessage, fetchGroupMessages, groupPeople, inviteToGroup, leaveGroup, muteGroup, myGroups,
  removeFromGroup, reportGroupMessage, sendGroupMessage,
} from '@/lib/groups';
import { ChatMessage, Connection, REPORT_REASONS, myConnections } from '@/lib/neighbors';
import { supabase } from '@/lib/supabase';
import { markChatRead } from '@/lib/unread';
import { Palette, useStyles } from '@/lib/theme';

const POLL_MS = 5000;

export default function GroupScreen() {
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [me, setMe] = useState('');
  const [group, setGroup] = useState<Group | null>(null);
  const [people, setPeople] = useState<GroupPerson[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]); // newest first
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  const [members, setMembers] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null); // message id
  const alive = useRef(true);
  const marked = useRef('');   // time of the newest message already reported as read

  const loadMeta = useCallback(async () => {
    if (!id) return;
    try {
      const [gs, ps] = await Promise.all([myGroups(), groupPeople(id)]);
      if (!alive.current) return;
      setGroup(gs.find(g => g.id === id) ?? null);
      setPeople(ps);
    } catch {}
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const list = await fetchGroupMessages(id);
      setMessages(list);
      setError('');
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
    return () => { alive.current = false; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      loadMeta();
      const t = setInterval(() => { load(); }, POLL_MS);
      return () => clearInterval(t);
    }, [load, loadMeta]),
  );

  const nameOf = (m: ChatMessage) => people.find(p => p.user_id === m.sender)?.name ?? 'Former member';
  const title = group?.name ?? name ?? 'Group';
  const joined = people.filter(p => p.status === 'member');
  const invited = people.filter(p => p.status === 'invited');

  const send = async (body: string) => {
    try {
      const m = await sendGroupMessage(id!, body);
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
        { text: 'Delete', style: 'destructive', onPress: () => deleteGroupMessage(m.id).then(load).catch(e => Alert.alert('Could not delete', friendlyError(e))) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert('Message', undefined, [
        { text: 'Report this message', onPress: () => setReporting(m.id) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const run = async (fn: () => Promise<void>, fail: string) => {
    try {
      await fn();
    } catch (e) {
      Alert.alert(fail, friendlyError(e));
    }
    loadMeta();
  };

  const leave = () =>
    Alert.alert(`Leave ${title}?`, group?.is_creator && joined.length > 1 ? 'Someone else will take over the group.' : 'You will stop receiving its messages.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => leaveGroup(id!).then(() => router.back()).catch(e => Alert.alert('Could not leave', friendlyError(e))) },
    ]);

  const remove = () =>
    Alert.alert(`Delete ${title}?`, 'The group and all its messages are deleted for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteGroup(id!).then(() => router.back()).catch(e => Alert.alert('Could not delete', friendlyError(e))) },
    ]);

  const openMembers = () => {
    setMembers(true);
    myConnections().then(rows => setConnections(rows.filter(r => r.status === 'accepted'))).catch(() => {});
    loadMeta();
  };

  const canInvite = connections.filter(c => !people.some(p => p.user_id === c.other_id));

  const sendReport = async (reason: string) => {
    const msg = reporting;
    setReporting(null);
    try {
      await reportGroupMessage(msg!, reason);
      Alert.alert('Thank you', 'A moderator will look at this message. You can also leave the group or block the person.');
    } catch (e) {
      Alert.alert('Could not send the report', friendlyError(e));
    }
  };

  return (
    <>
      <ChatView
        title={title}
        subtitle={`${joined.length || group?.member_count || ''} ${joined.length === 1 ? 'person' : 'people'}${group?.muted ? ' · muted' : ''}`}
        me={me}
        messages={messages}
        error={error}
        onRetry={load}
        onBack={() => router.back()}
        onMenu={() => setMenu(true)}
        onSend={send}
        onLongPress={longPress}
        senderName={nameOf}
        emptyText="No messages yet. Say hello! Be kind, and keep personal details private."
      />

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={title}
        items={[
          { label: 'Members and invitations', onPress: openMembers },
          { label: group?.muted ? 'Unmute notifications' : 'Mute notifications', onPress: () => run(() => muteGroup(id!, !group?.muted), 'Could not change this') },
          { label: 'Leave group', onPress: leave, destructive: true },
          ...(group?.is_creator ? [{ label: 'Delete group for everyone', onPress: remove, destructive: true }] : []),
        ]}
      />
      <ActionSheet
        visible={!!reporting}
        onClose={() => setReporting(null)}
        title="Report this message"
        items={REPORT_REASONS.map(r => ({ label: r.label, onPress: () => sendReport(r.key) }))}
      />

      <Modal visible={members} animationType="slide" onRequestClose={() => setMembers(false)}>
        <View style={[styles.modal, { paddingTop: insets.top + 12 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={() => setMembers(false)} hitSlop={10}><Text style={styles.close}>Done</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
            <Text style={styles.heading}>Members ({joined.length}/{MAX_GROUP_SIZE})</Text>
            {joined.map(p => (
              <View key={p.user_id} style={styles.row}>
                <Avatar name={p.name} url={p.avatar_url} size={38} />
                <Text style={styles.name} numberOfLines={1}>{p.name}{p.user_id === me ? ' (you)' : ''}{p.is_creator ? ' · started this group' : ''}</Text>
                {group?.is_creator && p.user_id !== me ? (
                  <Pressable hitSlop={8} onPress={() => Alert.alert(`Remove ${p.name}?`, 'They will not be able to read this group any more.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => run(() => removeFromGroup(id!, p.user_id), 'Could not remove') },
                  ])}><Text style={styles.remove}>Remove</Text></Pressable>
                ) : null}
              </View>
            ))}
            {invited.length > 0 ? <Text style={styles.heading}>Invited, not joined yet</Text> : null}
            {invited.map(p => (
              <View key={p.user_id} style={styles.row}>
                <Avatar name={p.name} url={p.avatar_url} size={38} />
                <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                {group?.is_creator ? <Pressable hitSlop={8} onPress={() => run(() => removeFromGroup(id!, p.user_id), 'Could not cancel')}><Text style={styles.remove}>Cancel</Text></Pressable> : null}
              </View>
            ))}
            <Text style={styles.heading}>Invite from your connections</Text>
            {people.length >= MAX_GROUP_SIZE ? <Text style={styles.muted}>The group is full.</Text> : null}
            {people.length < MAX_GROUP_SIZE && canInvite.length === 0 ? <Text style={styles.muted}>Everyone you are connected with is already here.</Text> : null}
            {people.length < MAX_GROUP_SIZE ? canInvite.map(c => (
              <View key={c.id} style={styles.row}>
                <Avatar name={c.name} url={c.avatar_url} size={38} />
                <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                <Pressable style={styles.inviteBtn} onPress={() => run(async () => { await inviteToGroup(id!, c.other_id); }, 'Could not invite')}><Text style={styles.inviteText}>Invite</Text></Pressable>
              </View>
            )) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  modal: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { color: colors.heading, fontSize: 20, fontWeight: '700', lineHeight: 26, flex: 1 },
  close: { color: colors.muted, fontSize: 15 },
  heading: { color: colors.muted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  name: { color: colors.text, fontSize: 15, flex: 1, lineHeight: 21 },
  remove: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  inviteBtn: { backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 14 },
  inviteText: { color: colors.onAccent, fontWeight: '700', fontSize: 13 },
});
