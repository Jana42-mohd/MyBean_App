import { StyleSheet, ScrollView, Text, View, Pressable, Image, ActivityIndicator, Alert, TextInput, Share, Switch, Modal, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Household, getHousehold, joinHousehold, leaveHousehold } from '@/lib/household';
import { Baby, deleteBaby, fetchBabies } from '@/lib/babies';
import { changePassword, passwordProblems } from '@/lib/auth';
import { deleteAccount, exportMyData, signOutEverywhereOnDevice } from '@/lib/account';
import { SUPPORT_EMAIL } from '@/lib/appInfo';
import { restartLiveSync } from '@/lib/liveSync';
import { useLiveRefresh } from '@/hooks/use-live';
import { DEFAULT_REMINDERS, ReminderSettings, getReminderSettings, saveReminderSettings } from '@/lib/reminders';
import { LoadError, friendlyError } from '@/components/LoadError';
import * as ImagePicker from 'expo-image-picker';

export default function SettingsScreen() {
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
      const { data: prof } = await supabase.from('profiles').select('name,avatar_url,is_moderator').eq('id', u.user.id).maybeSingle();
      setIsModerator(!!prof?.is_moderator);
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
      Alert.alert('Linked!', "You're now sharing your baby's logs with this household.");
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

  const step = (key: 'feedingHours' | 'napHours', delta: number) =>
    updateReminders({ [key]: Math.min(6, Math.max(1, Math.round((rem[key] + delta) * 2) / 2)) } as Partial<ReminderSettings>);

  const handleLogout = async () => {
    await signOutEverywhereOnDevice();
    router.replace('/');
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
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6B9BA8" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.title}>Settings</ThemedText>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.photoContainer}>
            {profilePhoto ? (
              <Image
                source={{ uri: profilePhoto }}
                style={styles.profilePhoto}
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <ThemedText style={styles.placeholderText}>No Photo</ThemedText>
              </View>
            )}
          </View>

          <ThemedText style={styles.userName}>{user?.name || 'User'}</ThemedText>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>

          <View style={styles.photoButtonsContainer}>
            <Pressable
              style={[styles.photoButton, { marginRight: 10 }]}
              onPress={pickImage}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.photoButtonText}> Choose Photo</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.photoButton}
              onPress={takePhoto}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.photoButtonText}> Take Photo</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Account Settings Section */}
        <View style={styles.settingsSection}>
          <ThemedText style={styles.sectionTitle}>Account</ThemedText>
          
          <Pressable style={styles.settingItem}>
            <Text style={styles.settingLabel}>Email</Text>
            <Text style={styles.settingValue}>{user?.email || ''}</Text>
          </Pressable>

          <Pressable style={styles.settingItem}>
            <Text style={styles.settingLabel}>Name</Text>
            <Text style={styles.settingValue}>{user?.name || ''}</Text>
          </Pressable>

        </View>

        {loadError ? <LoadError message={loadError} onRetry={loadUserData} /> : null}

        {/* Babies Section */}
        <View style={styles.settingsSection}>
          <ThemedText style={styles.sectionTitle}>Babies</ThemedText>
          {babies.map(b => (
            <View key={b.id} style={styles.settingItem}>
              <Text style={styles.settingLabel}>{b.name}{b.status === 'expected' ? `  ·  due ${b.due_date ?? '?'}` : b.birth_date ? `  ·  born ${b.birth_date}` : ''}</Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Pressable onPress={() => router.push('/survey')}>
                  <Text style={styles.settingValue}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => confirmDeleteBaby(b)}>
                  <Text style={[styles.settingValue, { color: '#ff9db1' }]}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <Pressable style={[styles.settingItem, { marginTop: 8 }]} onPress={() => router.push('/survey')}>
            <Text style={styles.settingLabel}>Add or edit babies (expecting, twins, triplets & more)</Text>
            <Text style={styles.settingValue}>→</Text>
          </Pressable>
        </View>

        {/* Household Section */}
        <View style={styles.settingsSection}>
          <ThemedText style={styles.sectionTitle}>Household</ThemedText>
          <Text style={styles.settingValue}>
            Link with your partner so you both see and add the same logs.
          </Text>

          {household?.members.map(m => (
            <View key={m.id} style={styles.settingItem}>
              <Text style={styles.settingLabel}>{m.name}{m.id === user?.id ? ' (you)' : ''}</Text>
            </View>
          ))}

          {household ? (
            <>
              <Pressable style={styles.settingItem} onPress={shareInvite}>
                <Text style={styles.settingLabel}>Invite code</Text>
                <Text style={styles.settingValue}>{household.invite_code}  ·  Share →</Text>
              </Pressable>
              <TextInput
                style={styles.codeInput}
                placeholder="Have a code? Enter it here"
                placeholderTextColor="#A4CDD3"
                autoCapitalize="characters"
                value={joinCode}
                onChangeText={setJoinCode}
              />
              <Pressable style={styles.photoButton} onPress={handleJoin} disabled={joining}>
                <Text style={styles.photoButtonText}>{joining ? 'Joining...' : 'Join household'}</Text>
              </Pressable>
              {household.members.length > 1 && (
                <Pressable style={[styles.settingItem, { marginTop: 8 }]} onPress={handleLeave}>
                  <Text style={styles.settingLabel}>Leave household</Text>
                </Pressable>
              )}
            </>
          ) : null}

          <Pressable style={[styles.settingItem, { marginTop: 8 }]} onPress={() => router.push('/survey')}>
            <Text style={styles.settingLabel}>Update my info</Text>
            <Text style={styles.settingValue}>→</Text>
          </Pressable>
        </View>

        {isModerator ? (
          <View style={styles.settingsSection}>
            <ThemedText style={styles.sectionTitle}>Moderation</ThemedText>
            <Pressable style={styles.settingItem} onPress={() => router.push('/moderation')}>
              <Text style={styles.settingLabel}>Review reported posts</Text>
              <Text style={styles.settingValue}>→</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Reminders */}
        <View style={styles.settingsSection}>
          <ThemedText style={styles.sectionTitle}>Reminders</ThemedText>
          <Text style={styles.settingValue}>Saved on this phone. They arrive even when the app is closed.</Text>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Next feeding</Text>
            <Switch value={rem.feeding} onValueChange={v => updateReminders({ feeding: v })} trackColor={{ true: '#2F9BA8' }} />
          </View>
          {rem.feeding ? (
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Remind me after</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Pressable onPress={() => step('feedingHours', -0.5)} hitSlop={10}><Text style={styles.stepper}>−</Text></Pressable>
                <Text style={styles.settingValue}>{rem.feedingHours} h</Text>
                <Pressable onPress={() => step('feedingHours', 0.5)} hitSlop={10}><Text style={styles.stepper}>+</Text></Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Awake too long (nap)</Text>
            <Switch value={rem.nap} onValueChange={v => updateReminders({ nap: v })} trackColor={{ true: '#2F9BA8' }} />
          </View>
          {rem.nap ? (
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Remind me after a nap ends</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Pressable onPress={() => step('napHours', -0.5)} hitSlop={10}><Text style={styles.stepper}>−</Text></Pressable>
                <Text style={styles.settingValue}>{rem.napHours} h</Text>
                <Pressable onPress={() => step('napHours', 0.5)} hitSlop={10}><Text style={styles.stepper}>+</Text></Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Weekly wellbeing check-in (Sun 7pm)</Text>
            <Switch value={rem.wellbeing} onValueChange={v => updateReminders({ wellbeing: v })} trackColor={{ true: '#2F9BA8' }} />
          </View>
        </View>

        {/* Change password */}
        <View style={styles.settingsSection}>
          <Pressable style={styles.settingItem} onPress={() => setShowPw(v => !v)}>
            <Text style={styles.settingLabel}>Change password</Text>
            <Text style={styles.settingValue}>{showPw ? '▲' : '→'}</Text>
          </Pressable>
          {showPw ? (
            <>
              <TextInput style={styles.codeInput} placeholder="New password" placeholderTextColor="#A4CDD3" secureTextEntry value={newPw} onChangeText={setNewPw} />
              {pwMsg ? <Text style={styles.settingValue}>{pwMsg}</Text> : null}
              <Pressable style={styles.photoButton} onPress={submitPassword}>
                <Text style={styles.photoButtonText}>Update password</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {blocked.length > 0 ? (
          <View style={styles.settingsSection}>
            <ThemedText style={styles.sectionTitle}>Blocked members</ThemedText>
            {blocked.map(b => (
              <View key={b.id} style={styles.settingItem}>
                <Text style={styles.settingLabel}>{b.name}</Text>
                <Pressable onPress={() => unblock(b.id)}>
                  <Text style={styles.settingValue}>Unblock</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {/* Your data & legal */}
        <View style={styles.settingsSection}>
          <ThemedText style={styles.sectionTitle}>Your data</ThemedText>
          <Pressable style={styles.settingItem} onPress={handleExport} disabled={exporting}>
            <Text style={styles.settingLabel}>{exporting ? 'Preparing your file...' : 'Download my data'}</Text>
            <Text style={styles.settingValue}>→</Text>
          </Pressable>
          <Pressable style={styles.settingItem} onPress={() => router.push('/legal?doc=privacy')}>
            <Text style={styles.settingLabel}>Privacy policy</Text>
            <Text style={styles.settingValue}>→</Text>
          </Pressable>
          <Pressable style={styles.settingItem} onPress={() => router.push('/legal?doc=terms')}>
            <Text style={styles.settingLabel}>Terms of service</Text>
            <Text style={styles.settingValue}>→</Text>
          </Pressable>
          <Pressable style={styles.settingItem} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
            <Text style={styles.settingLabel}>Contact support</Text>
            <Text style={styles.settingValue}>→</Text>
          </Pressable>
          <Pressable style={styles.settingItem} onPress={() => { setDeleteText(''); setDeleteOpen(true); }}>
            <Text style={[styles.settingLabel, { color: '#ff9db1' }]}>Delete my account</Text>
            <Text style={[styles.settingValue, { color: '#ff9db1' }]}>→</Text>
          </Pressable>
        </View>

        {/* Logout Button */}
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </Pressable>
      </ScrollView>
      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#0f3a41ff', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#ff9db1' }}>
            <Text style={{ color: '#ff9db1', fontSize: 20, fontWeight: '700', lineHeight: 26, marginBottom: 10 }}>Delete your account?</Text>
            <Text style={{ color: '#E8FBFF', fontSize: 14, lineHeight: 21 }}>
              This permanently deletes your profile, survey answers, wellbeing check-ins, pumping logs, community posts and photo. It cannot be undone.
            </Text>
            <Text style={{ color: '#E8FBFF', fontSize: 14, lineHeight: 21, marginTop: 10 }}>
              {household && household.members.length > 1
                ? 'Your partner stays in the household and keeps the baby records, including the logs you entered.'
                : 'You are the only member, so your babies and all their logs are deleted too.'}
            </Text>
            <Text style={{ color: '#A4CDD3', fontSize: 13, marginTop: 14, marginBottom: 6 }}>Type DELETE to confirm</Text>
            <TextInput
              style={styles.codeInput}
              value={deleteText}
              onChangeText={setDeleteText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="DELETE"
              placeholderTextColor="#A4CDD3"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <Pressable onPress={() => setDeleteOpen(false)} disabled={deleting}>
                <Text style={{ color: '#A4CDD3', fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmDeleteAccount}
                disabled={deleteText.trim() !== 'DELETE' || deleting}
                style={{ backgroundColor: deleteText.trim() === 'DELETE' ? '#ff9db1' : 'rgba(255,157,177,0.3)', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18 }}>
                <Text style={{ color: '#09282eff', fontWeight: '700' }}>{deleting ? 'Deleting...' : 'Delete forever'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  stepper: { color: '#FED8FE', fontSize: 24, fontWeight: '700', lineHeight: 28, paddingHorizontal: 6 },
  codeInput: {
    backgroundColor: '#0f3a41ff',
    borderWidth: 1,
    borderColor: '#2F9BA8',
    borderRadius: 10,
    color: '#E8FBFF',
    padding: 12,
    marginTop: 12,
    marginBottom: 10,
  },
  container: {
    flex: 1,
    backgroundColor: '#09282eff',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 30,
    color: '#E8FBFF',
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 40,
    backgroundColor: 'rgba(107, 155, 168, 0.1)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(107, 155, 168, 0.2)',
  },
  photoContainer: {
    marginBottom: 16,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#6B9BA8',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(107, 155, 168, 0.2)',
    borderWidth: 2,
    borderColor: '#6B9BA8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#6B9BA8',
    fontSize: 12,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E8FBFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#A4CDD3',
    marginBottom: 20,
  },
  photoButtonsContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
  },
  photoButton: {
    backgroundColor: '#6B9BA8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  photoButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  settingsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E8FBFF',
    marginBottom: 12,
    marginTop: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(107, 155, 168, 0.08)',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(107, 155, 168, 0.15)',
  },
  settingLabel: {
    flex: 1,
    marginRight: 12,
    fontSize: 14,
    color: '#A4CDD3',
    fontWeight: '600',
  },
  settingValue: {
    fontSize: 14,
    color: '#E8FBFF',
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#E74C3C',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
