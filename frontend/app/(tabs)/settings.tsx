import { StyleSheet, ScrollView, Text, View, Pressable, ActivityIndicator, Alert, TextInput, Share, Modal, Linking } from 'react-native';
import Constants from 'expo-constants';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { ActionSheet } from '@/components/ActionSheet';
import { Avatar } from '@/components/Avatar';
import { Button, Field, Hint, Pad, Row, Section, Segmented, StepperRow, ToggleRow } from '@/components/settings-ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Household, getHousehold, joinHousehold, leaveHousehold } from '@/lib/household';
import { Baby, deleteBaby, fetchBabies } from '@/lib/babies';
import { changePassword, passwordProblems } from '@/lib/auth';
import { deleteAccount, exportMyData, signOutEverywhereOnDevice } from '@/lib/account';
import { SUPPORT_EMAIL } from '@/lib/appInfo';
import { restartLiveSync } from '@/lib/liveSync';
import { getPendingCount } from '@/lib/outbox';
import { useLiveRefresh } from '@/hooks/use-live';
import { PlaceSettings } from '@/components/PlaceSettings';
import { getPartnerNotifications, setPartnerNotifications } from '@/lib/push';
import { DEFAULT_REMINDERS, ReminderSettings, getReminderSettings, saveReminderSettings } from '@/lib/reminders';
import { LoadError, friendlyError } from '@/components/LoadError';
import * as ImagePicker from 'expo-image-picker';
import { Palette, useStyles, useTheme, useThemePreference } from '@/lib/theme';

export default function SettingsScreen() {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [isModerator, setIsModerator] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [rem, setRem] = useState<ReminderSettings>(DEFAULT_REMINDERS);
  const [notifyPartner, setNotifyPartner] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [themePref, setThemePref] = useThemePreference();
  const [blocked, setBlocked] = useState<{ id: string; name: string }[]>([]);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: prof } = await supabase.from('profiles').select('name,avatar_url,is_moderator,notify_messages').eq('id', u.user.id).maybeSingle();
      setIsModerator(!!prof?.is_moderator);
      setNotifyMessages(prof?.notify_messages !== false);
      setBabies(await fetchBabies());
      const { data: blocks } = await supabase.from('user_blocks').select('blocked_id');
      const ids = (blocks ?? []).map((b: any) => b.blocked_id);
      if (ids.length) {
        const { data: names } = await supabase.from('profiles').select('id,name').in('id', ids);
        setBlocked((names ?? []) as any);
      } else setBlocked([]);
      setUser({ id: u.user.id, email: u.user.email, name: prof?.name });
      if (prof?.avatar_url) setProfilePhoto(prof.avatar_url);
      setHousehold(await getHousehold());
    } catch (error) {
      console.error('Error loading user data:', error);
      setLoadError(friendlyError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever Settings is opened (babies/household may have changed elsewhere)
  useFocusEffect(
    useCallback(() => {
      loadUserData();
      getReminderSettings().then(setRem);
      getPartnerNotifications().then(setNotifyPartner).catch(() => {});
    }, [loadUserData])
  );
  useLiveRefresh(loadUserData);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        uploadProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
      console.error(error);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need camera access');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        uploadProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
      console.error(error);
    }
  };

  const uploadProfilePhoto = async (imageUri: string) => {
    try {
      setUploading(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Not signed in');

      const ext = (imageUri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      const path = `${u.user.id}/avatar-${Date.now()}.${ext}`;
      const body = await (await fetch(imageUri)).arrayBuffer();

      const { error: upErr } = await supabase.storage.from('avatars').upload(path, body, { contentType });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', u.user.id);
      if (dbErr) throw dbErr;

      setProfilePhoto(pub.publicUrl);
      Alert.alert('Success', 'Profile photo updated');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Upload failed');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const shareInvite = async () => {
    if (!household) return;
    await Share.share({
      message: `Join me on My Little Bean! After you sign up, go to Settings > Household and enter this code: ${household.invite_code}`,
    });
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      await joinHousehold(joinCode);
      restartLiveSync().catch(() => {});
      setJoinCode('');
      setHousehold(await getHousehold());
      Alert.alert('Linked!', "You're now sharing your baby's logs with this household.", [
        // offer partner notifications now that there is a partner (asks the phone for permission)
        { text: 'OK', onPress: () => { setPartnerNotifications(true).then(ok => setNotifyPartner(ok)).catch(() => {}); } },
      ]);
    } catch (e: any) {
      Alert.alert('Could not join', e?.message || 'Please check the code and try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = () => {
    Alert.alert('Leave household?', "You'll stop seeing the shared logs. You can rejoin later with the invite code.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveHousehold();
            restartLiveSync().catch(() => {});
            setHousehold(await getHousehold());
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not leave.');
          }
        },
      },
    ]);
  };

  const confirmDeleteBaby = (b: Baby) =>
    Alert.alert(
      `Remove ${b.name}?`,
      `This permanently deletes ${b.name} and ALL of their logs for everyone in your household. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBaby(b.id);
              setBabies(await fetchBabies());
            } catch (e) {
              Alert.alert('Could not delete', friendlyError(e));
            }
          },
        },
      ]
    );

  const submitPassword = async () => {
    const problems = passwordProblems(newPw);
    if (problems.length) return setPwMsg(`Password needs ${problems.join(', ')}.`);
    try {
      await changePassword(newPw);
      setNewPw('');
      setShowPw(false);
      setPwMsg('');
      Alert.alert('Password updated');
    } catch (e) {
      setPwMsg(friendlyError(e));
    }
  };

  const updateReminders = async (patch: Partial<ReminderSettings>) => {
    const next = { ...rem, ...patch };
    const ok = await saveReminderSettings(next, rem);
    if (!ok) {
      Alert.alert('Notifications are off', 'Turn on notifications for My Little Bean in your phone settings, then try again.');
      return;
    }
    setRem(next);
  };

  const togglePartnerNotifications = async (on: boolean) => {
    setNotifyPartner(on);
    try {
      if (!(await setPartnerNotifications(on))) {
        setNotifyPartner(false);
        Alert.alert('Notifications are off', 'Turn on notifications for My Little Bean in your phone settings, then try again.');
      }
    } catch (e) {
      setNotifyPartner(!on);
      Alert.alert('Could not change this', friendlyError(e));
    }
  };

  const toggleMessages = async (on: boolean) => {
    setNotifyMessages(on);
    const { error } = await supabase.from('profiles').update({ notify_messages: on }).eq('id', user?.id);
    if (error) {
      setNotifyMessages(!on);
      Alert.alert('Could not change this', friendlyError(error));
    }
  };

  const step = (key: 'feedingHours' | 'napHours', delta: number) =>
    updateReminders({ [key]: Math.min(6, Math.max(1, Math.round((rem[key] + delta) * 2) / 2)) } as Partial<ReminderSettings>);

  const doLogout = async () => {
    await signOutEverywhereOnDevice();
    router.replace('/');
  };

  const handleLogout = () => {
    const waiting = getPendingCount();
    if (waiting === 0) return doLogout();
    Alert.alert(
      'Entries not synced yet',
      `${waiting} ${waiting === 1 ? 'entry is' : 'entries are'} saved on this phone but not sent yet. They stay here and are sent the next time you log in with this account while online. Log out anyway?`,
      [
        { text: 'Stay logged in', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: doLogout },
      ]
    );
  };

  const unblock = async (id: string) => {
    const { error } = await supabase.from('user_blocks').delete().eq('blocked_id', id);
    if (error) Alert.alert('Could not unblock', friendlyError(error));
    else setBlocked(prev => prev.filter(b => b.id !== id));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportMyData();
    } catch (e) {
      Alert.alert('Could not export', friendlyError(e));
    } finally {
      setExporting(false);
    }
  };

  const confirmDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      setDeleteOpen(false);
      router.replace('/');
    } catch (e) {
      Alert.alert('Could not delete your account', friendlyError(e));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </ThemedView>
    );
  }

  const babyLine = (b: Baby) => (b.status === 'expected' ? `Due ${b.due_date ?? '?'}` : b.birth_date ? `Born ${b.birth_date}` : 'Born');

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.title}>Settings</ThemedText>

        {/* Profile */}
        <View style={styles.profile}>
          <Pressable onPress={() => setPhotoSheet(true)} disabled={uploading} accessibilityRole="button" accessibilityLabel="Change profile photo">
            <Avatar name={user?.name || 'You'} url={profilePhoto} size={96} />
            <View style={styles.cameraBadge}>
              {uploading ? <ActivityIndicator size="small" color={colors.onAccent} /> : <MaterialCommunityIcons name="camera" size={16} color={colors.onAccent} />}
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.userName} numberOfLines={1}>{user?.name || 'Your name'}</ThemedText>
            <Text style={styles.userEmail} numberOfLines={1}>{user?.email || ''}</Text>
            <Pressable onPress={() => router.push('/survey')} hitSlop={8}><Text style={styles.editLink}>Edit my info</Text></Pressable>
          </View>
        </View>
        {loadError ? <LoadError message={loadError} onRetry={loadUserData} /> : null}

        {/* Family */}
        <Section title="Babies">
          {babies.map(b => (
            <Row
              key={b.id}
              icon="baby-face-outline"
              label={b.name}
              sub={babyLine(b)}
              onPress={() => router.push('/survey')}
              right={
                <Pressable onPress={() => confirmDeleteBaby(b)} hitSlop={10} accessibilityLabel={`Remove ${b.name}`}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              }
            />
          ))}
          <Row icon="plus-circle-outline" label="Add or edit babies" sub="Expecting, twins, triplets and more" onPress={() => router.push('/survey')} />
        </Section>

        <Section title="Household" hint="Link with your partner so you both see and add the same logs.">
          {household?.members.map(m => (
            <Row key={m.id} icon="account-outline" label={m.name} value={m.id === user?.id ? 'You' : ''} />
          ))}
          {household ? <Row icon="share-variant-outline" label="Invite your partner" sub={`Code ${household.invite_code}`} onPress={shareInvite} /> : null}
          <Pad>
            <Field label="Have a code from your partner?" value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" autoCorrect={false} placeholder="Enter the invite code" />
            <Button title="Join household" kind="outline" onPress={handleJoin} busy={joining} disabled={!joinCode.trim()} />
          </Pad>
          {household && household.members.length > 1 ? <Row icon="exit-run" label="Leave household" danger onPress={handleLeave} /> : null}
        </Section>

        {/* Community */}
        <PlaceSettings />

        {isModerator ? (
          <Section title="Moderation">
            <Row icon="shield-check-outline" label="Review reported posts and parents" onPress={() => router.push('/moderation')} />
          </Section>
        ) : null}

        {blocked.length > 0 ? (
          <Section title="Blocked members">
            {blocked.map(b => (
              <Row key={b.id} icon="account-cancel-outline" label={b.name} right={<Pressable onPress={() => unblock(b.id)} hitSlop={10}><Text style={styles.linkText}>Unblock</Text></Pressable>} />
            ))}
          </Section>
        ) : null}

        {/* Notifications */}
        <Section title="Notifications" hint="Sent from our servers, so they reach you even when the app is closed.">
          <ToggleRow icon="bell-outline" label="When my partner logs something" sub='For example "Blake logged a feeding for Mia"' value={notifyPartner} onValueChange={togglePartnerNotifications} />
          <ToggleRow icon="message-outline" label="Requests and messages from parents" sub="Says who wrote, never what" value={notifyMessages} onValueChange={toggleMessages} />
        </Section>

        <Section title="Reminders" hint="Saved on this phone. They arrive even when the app is closed.">
          <ToggleRow icon="baby-bottle-outline" label="Next feeding" value={rem.feeding} onValueChange={v => updateReminders({ feeding: v })} />
          {rem.feeding ? <StepperRow label="Remind me after" value={rem.feedingHours} unit="h" onMinus={() => step('feedingHours', -0.5)} onPlus={() => step('feedingHours', 0.5)} /> : null}
          <ToggleRow icon="sleep" label="Awake too long" value={rem.nap} onValueChange={v => updateReminders({ nap: v })} />
          {rem.nap ? <StepperRow label="Remind me after a nap ends" value={rem.napHours} unit="h" onMinus={() => step('napHours', -0.5)} onPlus={() => step('napHours', 0.5)} /> : null}
          <ToggleRow icon="heart-outline" label="Weekly wellbeing check-in" sub="Sundays at 7pm" value={rem.wellbeing} onValueChange={v => updateReminders({ wellbeing: v })} />
        </Section>

        <Section title="Appearance">
          <Pad>
            <Segmented
              value={themePref}
              onChange={setThemePref}
              options={[
                { key: 'system', label: 'Auto', icon: 'theme-light-dark' },
                { key: 'light', label: 'Light', icon: 'white-balance-sunny' },
                { key: 'dark', label: 'Dark', icon: 'weather-night' },
              ]}
            />
            <Hint>Auto follows your phone. Dark is easier on the eyes for night feeds.</Hint>
          </Pad>
        </Section>

        {/* Account */}
        <Section title="Account">
          <Row icon="email-outline" label="Email" value={user?.email || ''} />
          <Row icon="lock-outline" label="Change password" onPress={() => setShowPw(v => !v)} right={<MaterialCommunityIcons name={showPw ? 'chevron-up' : 'chevron-down'} size={22} color={colors.muted} />} />
          {showPw ? (
            <Pad>
              <Field label="New password" value={newPw} onChangeText={setNewPw} secureTextEntry placeholder="At least 8 characters" />
              {pwMsg ? <Hint danger>{pwMsg}</Hint> : null}
              <Button title="Update password" onPress={submitPassword} />
            </Pad>
          ) : null}
          <Row icon="download-outline" label="Download my data" sub="A file with everything we hold about you" onPress={handleExport} busy={exporting} />
        </Section>

        <Section title="About and privacy">
          <Row icon="shield-lock-outline" label="Privacy policy" onPress={() => router.push('/legal?doc=privacy')} />
          <Row icon="file-document-outline" label="Terms of service" onPress={() => router.push('/legal?doc=terms')} />
          <Row icon="map-outline" label="City list" sub="Data from GeoNames (CC BY 4.0)" onPress={() => Linking.openURL('https://www.geonames.org')} />
          <Row icon="lifebuoy" label="Contact support" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
          <Row icon="information-outline" label="Version" value={Constants.expoConfig?.version ?? ''} />
        </Section>

        <Button title="Log out" kind="outline" onPress={handleLogout} style={{ marginTop: 4 }} />
        <Pressable style={styles.deleteLink} onPress={() => { setDeleteText(''); setDeleteOpen(true); }} accessibilityRole="button">
          <Text style={styles.deleteText}>Delete my account</Text>
        </Pressable>
      </ScrollView>

      <ActionSheet
        visible={photoSheet}
        onClose={() => setPhotoSheet(false)}
        title="Profile photo"
        items={[
          { label: 'Choose from library', onPress: pickImage },
          { label: 'Take a photo', onPress: takePhoto },
        ]}
      />

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete your account?</Text>
            <Text style={styles.modalText}>
              This permanently deletes your profile, survey answers, wellbeing check-ins, pumping logs, community posts, connections, messages and photo. It cannot be undone.
            </Text>
            <Text style={[styles.modalText, { marginTop: 10 }]}>
              {household && household.members.length > 1
                ? 'Your partner stays in the household and keeps the baby records, including the logs you entered.'
                : 'You are the only member, so your babies and all their logs are deleted too.'}
            </Text>
            <Text style={styles.modalLabel}>Type DELETE to confirm</Text>
            <TextInput
              style={styles.modalInput}
              value={deleteText}
              onChangeText={setDeleteText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="DELETE"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setDeleteOpen(false)} disabled={deleting}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Button title="Delete forever" kind="danger" onPress={confirmDeleteAccount} busy={deleting} disabled={deleteText.trim() !== 'DELETE'} />
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  title: { fontSize: 30, fontWeight: '700', lineHeight: 38, color: colors.heading, marginBottom: 18 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.line, marginBottom: 26 },
  cameraBadge: { position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.card },
  userName: { fontSize: 20, fontWeight: '700', lineHeight: 27, color: colors.text },
  userEmail: { fontSize: 13, color: colors.muted, marginTop: 2 },
  editLink: { color: colors.link, fontSize: 14, fontWeight: '600', marginTop: 10 },
  removeText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  linkText: { color: colors.link, fontSize: 14, fontWeight: '600' },
  deleteLink: { alignSelf: 'center', padding: 16, marginTop: 8 },
  deleteText: { color: colors.danger, fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: colors.danger },
  modalTitle: { color: colors.danger, fontSize: 20, fontWeight: '700', lineHeight: 26, marginBottom: 10 },
  modalText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  modalLabel: { color: colors.muted, fontSize: 13, marginTop: 14, marginBottom: 6 },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, backgroundColor: colors.bg },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  cancelText: { color: colors.muted, fontSize: 15 },
});
