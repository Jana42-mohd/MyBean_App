import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CountryPicker } from '@/components/CountryPicker';
import { friendlyError } from '@/components/LoadError';
import { Button, Field, Hint, Pad, Row, Section, ToggleRow } from '@/components/settings-ui';
import { countryName } from '@/lib/countries';
import { EMPTY_PLACE, Place, getMyPlace, savePlace } from '@/lib/neighbors';

// Settings: where I am (typed, never GPS) and whether nearby parents can find me. Off until the person turns it on.
export function PlaceSettings() {
  const router = useRouter();
  const [place, setPlace] = useState<Place>(EMPTY_PLACE);
  const [saved, setSaved] = useState<Place>(EMPTY_PLACE);
  const [pickCountry, setPickCountry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      getMyPlace().then(p => { setPlace(p); setSaved(p); setError(''); }).catch(e => setError(friendlyError(e)));
    }, []),
  );

  const dirty = place.country !== saved.country || place.city !== saved.city || place.area !== saved.area;

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

  return (
    <>
      <Section title="Parents near you">
        <Pad>
          <Hint>Meet parents in your neighbourhood, city or country. You type where you are (we never use GPS), and you stay hidden until you switch visibility on.</Hint>
          {error ? <Hint danger>{error}</Hint> : null}
          {place.blocked ? <Hint danger>Your profile is hidden while a moderator reviews reports about it.</Hint> : null}
        </Pad>
        <Row icon="earth" label="Country" value={countryName(place.country) || 'Choose'} onPress={() => setPickCountry(true)} />
        <Pad>
          <Field label="City or town" value={place.city} onChangeText={t => setPlace(p => ({ ...p, city: t }))} placeholder="e.g. Toronto" maxLength={60} />
          <Field label="Neighbourhood (optional)" value={place.area} onChangeText={t => setPlace(p => ({ ...p, area: t }))} placeholder="e.g. The Annex" maxLength={60} />
          <Hint>Spell it the way your neighbours would. Parents match when city and neighbourhood read the same (capitals and punctuation do not matter).</Hint>
          {dirty ? <Button title="Save place" onPress={() => save()} busy={saving} /> : null}
        </Pad>
        <ToggleRow icon="eye-outline" label="Let nearby parents find me" sub="Off until you turn it on" value={saved.discoverable} onValueChange={toggleDiscoverable} disabled={saving || place.blocked} />
        <Row icon="map-marker-radius-outline" label="Find parents near me" onPress={() => router.push('/neighbors')} />
        <Row icon="account-multiple-outline" label="Connections, requests and groups" onPress={() => router.push('/connections')} />
      </Section>
      <CountryPicker visible={pickCountry} onClose={() => setPickCountry(false)} onPick={code => { setPlace(p => ({ ...p, country: code })); setPickCountry(false); }} />
    </>
  );
}
