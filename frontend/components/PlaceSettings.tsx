import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CountryPicker } from '@/components/CountryPicker';
import { friendlyError } from '@/components/LoadError';
import { countryName } from '@/lib/countries';
import { EMPTY_PLACE, Place, getMyPlace, savePlace } from '@/lib/neighbors';
import { supabase } from '@/lib/supabase';

// Settings: where I am (typed, never GPS) and whether nearby parents can find me. Off until the person turns it on.
export function PlaceSettings() {
  const router = useRouter();
  const [place, setPlace] = useState<Place>(EMPTY_PLACE);
  const [saved, setSaved] = useState<Place>(EMPTY_PLACE);
  const [pickCountry, setPickCountry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      getMyPlace().then(p => { setPlace(p); setSaved(p); setError(''); }).catch(e => setError(friendlyError(e)));
      supabase.auth.getSession().then(({ data }) => {
        const id = data.session?.user.id;
        if (id) supabase.from('profiles').select('notify_messages').eq('id', id).maybeSingle().then(r => setNotifyMessages(r.data?.notify_messages !== false));
      });
    }, []),
  );

  const dirty = place.country !== saved.country || place.city !== saved.city || place.area !== saved.area || place.discoverable !== saved.discoverable;

  const save = async (next: Place = place) => {
    setSaving(true);
    try {
      await savePlace(next);
      setSaved(next);
      setPlace(next);
    } catch (e) {
      Alert.alert('Could not save', friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleDiscoverable = (on: boolean) => {
    if (!on) return save({ ...place, discoverable: false });
    if (!place.country || !place.city.trim()) return Alert.alert('Add your place first', 'Choose your country and type your city, then turn this on.');
    Alert.alert(
      'Let nearby parents find you?',
      `Other parents who also opted in will see your name, profile photo, ${place.city.trim()}${place.area.trim() ? ` and ${place.area.trim()}` : ''}. They can send you a request, and nobody can message you until you accept. They never see your babies, logs or wellbeing. You can switch this off at any time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn on', onPress: () => save({ ...place, discoverable: true }) },
      ],
    );
  };

  const toggleMessages = async (on: boolean) => {
    setNotifyMessages(on);
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user.id;
    if (!id) return;
    const { error: err } = await supabase.from('profiles').update({ notify_messages: on }).eq('id', id);
    if (err) {
      setNotifyMessages(!on);
      Alert.alert('Could not change this', friendlyError(err));
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Parents near you</Text>
      <Text style={styles.help}>
        Meet parents in your neighbourhood, city or country. You type where you are (we never use GPS), and you are hidden until you switch visibility on.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {place.blocked ? <Text style={styles.error}>Your profile is hidden while a moderator reviews reports about it.</Text> : null}

      <Text style={styles.label}>Country</Text>
      <Pressable style={styles.input} onPress={() => setPickCountry(true)}>
        <Text style={place.country ? styles.value : styles.placeholder}>{countryName(place.country) || 'Choose your country'}</Text>
      </Pressable>
      <Text style={styles.label}>City or town</Text>
      <TextInput style={styles.input} value={place.city} onChangeText={t => setPlace(p => ({ ...p, city: t }))} placeholder="e.g. Toronto" placeholderTextColor="#A4CDD3" maxLength={60} />
      <Text style={styles.label}>Neighbourhood (optional)</Text>
      <TextInput style={styles.input} value={place.area} onChangeText={t => setPlace(p => ({ ...p, area: t }))} placeholder="e.g. The Annex" placeholderTextColor="#A4CDD3" maxLength={60} />
      <Text style={styles.help}>Spell it the way your neighbours would: parents match when city and neighbourhood read the same (capital letters and punctuation do not matter).</Text>

      {dirty ? (
        <Pressable style={styles.saveBtn} onPress={() => save()} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save place'}</Text>
        </Pressable>
      ) : null}

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Let nearby parents find me</Text>
        <Switch value={saved.discoverable} onValueChange={toggleDiscoverable} disabled={saving || place.blocked} trackColor={{ true: '#2F9BA8' }} />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Notify me about requests and messages</Text>
        <Switch value={notifyMessages} onValueChange={toggleMessages} trackColor={{ true: '#2F9BA8' }} />
      </View>

      <Pressable style={styles.link} onPress={() => router.push('/neighbors')}><Text style={styles.linkText}>Find parents near me →</Text></Pressable>
      <Pressable style={styles.link} onPress={() => router.push('/connections')}><Text style={styles.linkText}>My connections and requests →</Text></Pressable>

      <CountryPicker
        visible={pickCountry}
        onClose={() => setPickCountry(false)}
        onPick={code => { setPlace(p => ({ ...p, country: code })); setPickCountry(false); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: '#0f3a41ff', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#2F9BA8' },
  sectionTitle: { color: '#FED8FE', fontSize: 18, fontWeight: '700', lineHeight: 24, marginBottom: 6 },
  help: { color: '#A4CDD3', fontSize: 12, lineHeight: 18, marginTop: 6 },
  error: { color: '#ff9db1', fontSize: 13, marginTop: 8 },
  label: { color: '#A4CDD3', fontSize: 13, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#2F9BA8', borderRadius: 10, padding: 12, color: '#E8FBFF' },
  value: { color: '#E8FBFF' },
  placeholder: { color: '#A4CDD3' },
  saveBtn: { backgroundColor: '#FED8FE', borderRadius: 10, padding: 12, marginTop: 14 },
  saveText: { color: '#09282eff', fontWeight: '700', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 },
  rowLabel: { color: '#E8FBFF', fontSize: 15, flex: 1, lineHeight: 21 },
  link: { marginTop: 16 },
  linkText: { color: '#FDFECC', fontSize: 15, fontWeight: '600' },
});
