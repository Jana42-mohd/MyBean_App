import React, { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { supabase } from '@/lib/supabase';
import { CountryPicker } from '@/components/CountryPicker';
import { countryName } from '@/lib/countries';
import { FIND_A_HELPLINE, HELPLINES_CHECKED, getHelpCountryChoice, helpFor, pickHelpCountry, setHelpCountryChoice } from '@/lib/helplines';
import { getMyPlace } from '@/lib/neighbors';
import { weeklyMood, nudgeFor } from '@/lib/wellbeingTrend';
import { Palette, useStyles, useTheme } from '@/lib/theme';

interface Entry {
  id: string;
  kind: 'checkin' | 'epds';
  score: number | null;
  data: any;
  created_at: string;
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Mood faces: red to green, with a tone that stays readable on both the light and the dark cards
const moodsFor = (colors: Palette): { value: number; icon: IconName; color: string; label: string }[] => {
  const dark = colors.scheme === 'dark';
  return [
    { value: 1, icon: 'emoticon-cry-outline', color: colors.danger, label: 'Really low' },
    { value: 2, icon: 'emoticon-sad-outline', color: dark ? '#f4b69a' : '#C0652B', label: 'Down' },
    { value: 3, icon: 'emoticon-neutral-outline', color: dark ? colors.link : '#5F7E85', label: 'Okay' },
    { value: 4, icon: 'emoticon-happy-outline', color: dark ? '#a8e6cf' : '#2F8F68', label: 'Good' },
    { value: 5, icon: 'emoticon-excited-outline', color: dark ? '#7fe3b4' : '#1F8A5A', label: 'Great' },
  ];
};

// Small icon shown before each card title
function CardTitle({ icon, children }: { icon: IconName; children: string }) {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.titleRow}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.accentText} />
      <Text style={[styles.cardTitle, { marginBottom: 0, flex: 1, flexShrink: 1 }]}>{children}</Text>
    </View>
  );
}

const SLEEP = ['Under 3 hrs', '3-5 hrs', '5-7 hrs', '7+ hrs'];

// Edinburgh Postnatal Depression Scale (Cox, Holden & Sagovsky, 1987). Each answer is listed
// in the order shown, with the score for that answer.
const EPDS: { q: string; a: [string, number][] }[] = [
  { q: 'I have been able to laugh and see the funny side of things', a: [['As much as I always could', 0], ['Not quite so much now', 1], ['Definitely not so much now', 2], ['Not at all', 3]] },
  { q: 'I have looked forward with enjoyment to things', a: [['As much as I ever did', 0], ['Rather less than I used to', 1], ['Definitely less than I used to', 2], ['Hardly at all', 3]] },
  { q: 'I have blamed myself unnecessarily when things went wrong', a: [['No, never', 0], ['Not very often', 1], ['Yes, some of the time', 2], ['Yes, most of the time', 3]] },
  { q: 'I have been anxious or worried for no good reason', a: [['No, not at all', 0], ['Hardly ever', 1], ['Yes, sometimes', 2], ['Yes, very often', 3]] },
  { q: 'I have felt scared or panicky for no very good reason', a: [['No, not at all', 0], ['No, not much', 1], ['Yes, sometimes', 2], ['Yes, quite a lot', 3]] },
  { q: 'Things have been getting on top of me', a: [['No, I have been coping as well as ever', 0], ['No, most of the time I have coped quite well', 1], ["Yes, sometimes I haven't been coping as well as usual", 2], ["Yes, most of the time I haven't been able to cope at all", 3]] },
  { q: 'I have been so unhappy that I have had difficulty sleeping', a: [['No, not at all', 0], ['Not very often', 1], ['Yes, sometimes', 2], ['Yes, most of the time', 3]] },
  { q: 'I have felt sad or miserable', a: [['No, not at all', 0], ['Not very often', 1], ['Yes, quite often', 2], ['Yes, most of the time', 3]] },
  { q: 'I have been so unhappy that I have been crying', a: [['No, never', 0], ['Only occasionally', 1], ['Yes, quite often', 2], ['Yes, most of the time', 3]] },
  { q: 'The thought of harming myself has occurred to me', a: [['Never', 0], ['Hardly ever', 1], ['Sometimes', 2], ['Yes, quite often', 3]] },
];

const call = (num: string) => Linking.openURL(`tel:${num}`);

// The numbers for the parent's country (from their place under Parents near you, or a country chosen here for this phone only).
// With no country known, the Canada and US lines are shown and labelled as such, as before.
function HelpBtn({ label, onPress, crisis }: { label: string; onPress: () => void; crisis?: boolean }) {
  const styles = useStyles(makeStyles);
  return crisis ? (
    <Pressable style={styles.crisisBtn} onPress={onPress} accessibilityRole="button"><Text style={styles.crisisBtnText}>{label}</Text></Pressable>
  ) : (
    <Pressable style={styles.link} onPress={onPress} accessibilityRole="link"><Text style={styles.linkText}>{label}</Text></Pressable>
  );
}

function HelpList({ country, crisis, onChoose }: { country: string | null; crisis?: boolean; onChoose: () => void }) {
  const styles = useStyles(makeStyles);
  const help = helpFor(country);
  return (
    <View>
      {help ? (
        <>
          {help.lines.map(l => <HelpBtn crisis={crisis} key={l.phone} label={`${l.name}: ${l.display}${l.note ? ` (${l.note})` : ''}`} onPress={() => call(l.phone)} />)}
          <HelpBtn crisis={crisis} label={`Emergency: call ${help.emergency.display}`} onPress={() => call(help.emergency.phone)} />
        </>
      ) : country ? (
        <Text style={styles.body}>
          We don't have a checked list for {countryName(country) || 'your country'} yet. If you are in danger, call your local emergency number. The directory below lists helplines in your country.
        </Text>
      ) : (
        <>
          <HelpBtn crisis={crisis} label="Call or text 9-8-8 (Canada & US crisis line)" onPress={() => call('988')} />
          <HelpBtn crisis={crisis} label="Emergency in Canada & US: call 911" onPress={() => call('911')} />
          <Pressable style={styles.link} onPress={onChoose}><Text style={styles.linkText}>Somewhere else? Choose your country</Text></Pressable>
        </>
      )}
      <Pressable style={styles.link} onPress={() => Linking.openURL(FIND_A_HELPLINE)} accessibilityRole="link">
        <Text style={styles.linkText}>More helplines in your country: findahelpline.com</Text>
      </Pressable>
    </View>
  );
}

function CrisisCard({ country, onChoose }: { country: string | null; onChoose: () => void }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.card, styles.crisis]}>
      <Text style={styles.crisisTitle}>You deserve support right now</Text>
      <Text style={styles.body}>
        If you have thoughts of harming yourself or your baby, or you feel unsafe, please reach out immediately. You are not alone and this can get better.
      </Text>
      <HelpList country={country} crisis onChoose={onChoose} />
    </View>
  );
}

export default function WellbeingScreen() {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [now, setNow] = useState(() => Date.now()); // refreshed each time the screen loads
  const [mood, setMood] = useState<number | null>(null);
  const [sleep, setSleep] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [quiz, setQuiz] = useState<number[] | null>(null); // answer scores, -1 = unanswered
  const [result, setResult] = useState<{ score: number; selfHarm: boolean } | null>(null);
  const [choice, setChoice] = useState<string | null>(null);   // a country picked here, kept on this phone only
  const [placeCountry, setPlaceCountry] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const helpCountry = pickHelpCountry(choice, placeCountry);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('wellbeing_entries')
      .select('id,kind,score,data,created_at')
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) console.error('Wellbeing load failed:', error);
    else {
      setEntries((data ?? []) as Entry[]);
      setNow(Date.now());
    }
  }, []);

  const loadCountry = useCallback(async () => {
    setChoice(await getHelpCountryChoice());
    try {
      setPlaceCountry((await getMyPlace()).country);
    } catch {
      setPlaceCountry(null); // offline or not set: the choice made here, or the Canada and US lines, are used
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); loadCountry(); }, [load, loadCountry]));

  const checkins = entries.filter(e => e.kind === 'checkin');
  const lastEpds = entries.find(e => e.kind === 'epds');
  const nudge = nudgeFor(entries, now);
  const weeks = weeklyMood(entries, now);
  const epdsList = entries.filter(e => e.kind === 'epds').slice(0, 4).reverse();
  const daysSinceEpds = lastEpds ? Math.floor((now - new Date(lastEpds.created_at).getTime()) / 86400000) : null;

  const saveCheckin = async () => {
    if (!mood) return Alert.alert('How are you feeling?', 'Pick the face that fits best today.');
    setSaving(true);
    const { error } = await supabase.from('wellbeing_entries').insert({
      kind: 'checkin', score: mood, data: { sleep, note: note.trim() || undefined },
    });
    setSaving(false);
    if (error) return Alert.alert('Could not save', error.message);
    setMood(null); setSleep(null); setNote('');
    load();
  };

  const finishQuiz = async () => {
    if (!quiz || quiz.some(v => v < 0)) return Alert.alert('Almost there', 'Please answer every question.');
    const score = quiz.reduce((a, b) => a + b, 0);
    const selfHarm = quiz[9] > 0;
    const { error } = await supabase.from('wellbeing_entries').insert({
      kind: 'epds', score, data: { answers: quiz, selfHarm },
    });
    if (error) Alert.alert('Could not save', error.message);
    setResult({ score, selfHarm });
    setQuiz(null);
    load();
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.title}>Your Wellbeing</ThemedText>
        <Text style={styles.subtitle}>
          Taking care of you matters too. This section is private: only you can see it, and it is never shared with your partner.
        </Text>

        {(result?.selfHarm || (lastEpds?.data?.selfHarm && (daysSinceEpds ?? 99) < 14)) && <CrisisCard country={helpCountry} onChoose={() => setPicking(true)} />}

        {nudge && !quiz && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{nudge === 'low-mood' ? 'The last couple of weeks have been heavy' : 'Your last two screenings were in a range worth talking about'}</Text>
            <Text style={styles.body}>
              {nudge === 'low-mood'
                ? "Your check-ins have been low for two weeks in a row. That's really common during pregnancy and after having a baby, and it doesn't mean you're doing anything wrong. It could help to talk to someone: your doctor, midwife or public health nurse, a friend, or one of the lines under \"Support, any time\"."
                : "Both of your most recent screenings were at 10 or above. That isn't a diagnosis, but it's a good reason to talk to your doctor, midwife or public health nurse, or one of the lines under \"Support, any time\"."}
            </Text>
            <Text style={styles.muted}>Only you can see this. It is worked out on your phone from your own check-ins and is never shared.</Text>
          </View>
        )}

        {/* Daily check-in */}
        {!quiz && (
          <View style={styles.card}>
            <CardTitle icon="calendar-heart">Daily check-in</CardTitle>
            <Text style={styles.label}>How are you feeling today?</Text>
            <View style={styles.row}>
              {moodsFor(colors).map(m => (
                <Pressable
                  key={m.value}
                  onPress={() => setMood(m.value)}
                  accessibilityRole="button"
                  accessibilityLabel={`Mood: ${m.label}`}
                  style={[styles.moodBtn, mood === m.value && styles.active]}>
                  <MaterialCommunityIcons name={m.icon} size={32} color={m.color} />
                  <Text style={styles.moodLabel}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>How did you sleep last night?</Text>
            <View style={styles.wrapRow}>
              {SLEEP.map(s => (
                <Pressable key={s} onPress={() => setSleep(s)} style={[styles.chip, sleep === s && styles.active]}>
                  <Text style={styles.chipText}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Anything on your mind? (optional)"
              placeholderTextColor={colors.muted}
              value={note}
              onChangeText={setNote}
              multiline
            />
            <Pressable style={styles.primary} onPress={saveCheckin} disabled={saving}>
              <Text style={styles.primaryText}>{saving ? 'Saving...' : 'Save check-in'}</Text>
            </Pressable>

            {checkins.length > 0 && (
              <>
                <Text style={[styles.label, { marginTop: 18 }]}>Your last {Math.min(checkins.length, 14)} check-ins</Text>
                <View style={styles.chart}>
                  {checkins.slice(0, 14).reverse().map(c => (
                    <View key={c.id} style={styles.barWrap}>
                      <View style={[styles.bar, { height: 10 + (c.score ?? 0) * 12, opacity: 0.4 + (c.score ?? 0) * 0.12 }]} />
                      <Text style={styles.barLabel}>{fmt(c.created_at).replace(' ', '\n')}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* Weeks at a glance */}
        {!quiz && weeks.some(w => w.count > 0) && (
          <View style={styles.card}>
            <CardTitle icon="chart-line">Your weeks</CardTitle>
            <Text style={styles.body}>Your average mood for each week, from your check-ins. Taller is better. A week with no check-ins is left empty.</Text>
            <View style={[styles.chart, { marginTop: 14 }]}>
              {weeks.map((w, i) => (
                <View key={i} style={styles.barWrap} accessible accessibilityLabel={w.average === null ? `Week of ${fmt(w.start.toISOString())}: no check-ins` : `Week of ${fmt(w.start.toISOString())}: average ${w.average.toFixed(1)} out of 5`}>
                  <View style={[styles.bar, styles.weekBar, w.average === null ? styles.barEmpty : { height: 10 + w.average * 14, opacity: 0.5 + w.average * 0.1 }]} />
                  <Text style={styles.barLabel}>{fmt(w.start.toISOString()).replace(' ', '\n')}</Text>
                </View>
              ))}
            </View>
            {epdsList.length > 0 && (
              <Text style={styles.muted}>Screenings: {epdsList.map(e => `${fmt(e.created_at)} · ${e.score}/30`).join('   ')}</Text>
            )}
          </View>
        )}

        {/* EPDS screening */}
        {!quiz && (
          <View style={styles.card}>
            <CardTitle icon="clipboard-text-outline">Pregnancy & postpartum check (EPDS)</CardTitle>
            <Text style={styles.body}>
              A 10-question screening used by doctors and midwives worldwide, during pregnancy and after birth. It takes about 2 minutes. It is not a diagnosis, but it can help you know when to reach out.
            </Text>
            {lastEpds && (
              <Text style={styles.muted}>
                Last taken {fmt(lastEpds.created_at)} · score {lastEpds.score}/30
                {daysSinceEpds !== null && daysSinceEpds >= 14 ? ' · time for a new one' : ''}
              </Text>
            )}
            <Pressable style={styles.primary} onPress={() => { setResult(null); setQuiz(Array(10).fill(-1)); }}>
              <Text style={styles.primaryText}>Take the screening</Text>
            </Pressable>
          </View>
        )}

        {quiz && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>In the past 7 days...</Text>
            {EPDS.map((item, qi) => (
              <View key={qi} style={{ marginTop: 14 }}>
                <Text style={styles.question}>{qi + 1}. {item.q}</Text>
                {item.a.map(([label, pts]) => (
                  <Pressable
                    key={label}
                    onPress={() => setQuiz(quiz.map((v, i) => (i === qi ? pts : v)))}
                    style={[styles.option, quiz[qi] === pts && styles.active]}>
                    <Text style={styles.optionText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
            <Pressable style={styles.primary} onPress={finishQuiz}>
              <Text style={styles.primaryText}>See my result</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => setQuiz(null)}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Text style={styles.muted}>Source: Cox, Holden & Sagovsky (1987), Edinburgh Postnatal Depression Scale.</Text>
          </View>
        )}

        {result && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your score: {result.score} / 30</Text>
            <Text style={styles.body}>
              {result.score >= 13
                ? "This score suggests you may be experiencing postpartum depression or anxiety. Please contact your doctor, midwife or public health nurse soon and share this result. Treatment works, and you don't have to wait for it to get worse."
                : result.score >= 10
                ? "This score is in a range where it's worth checking in with your doctor or midwife. Mood changes after a baby are common and treatable. Keep tracking how you feel."
                : "Your score is in the lower range, which is a good sign. If things change or you just don't feel like yourself, it's always okay to reach out."}
            </Text>
            <Text style={styles.muted}>This screening can't diagnose anything. Only a health professional can.</Text>
          </View>
        )}

        {/* Resources */}
        <View style={styles.card}>
          <CardTitle icon="phone-in-talk">Support, any time</CardTitle>
          <Text style={styles.muted}>
            {helpCountry ? `Showing help for ${countryName(helpCountry) || helpCountry}. ` : ''}
            Numbers last checked {HELPLINES_CHECKED}; they can change.
          </Text>
          <HelpList country={helpCountry} onChoose={() => setPicking(true)} />
          <Pressable style={styles.link} onPress={() => setPicking(true)} accessibilityRole="button">
            <Text style={styles.linkText}>{helpCountry ? 'Not your country? Change it' : 'Choose your country'}</Text>
          </Pressable>
          {choice ? (
            <Pressable style={styles.link} onPress={async () => { await setHelpCountryChoice(null); setChoice(null); }}>
              <Text style={styles.linkText}>Go back to the country in my place settings</Text>
            </Pressable>
          ) : null}
          <Text style={styles.muted}>
            Your country comes from "Parents near you" in Settings, if you set it. A country chosen here stays on this phone only.
          </Text>
          <Text style={styles.body}>
            Your doctor, midwife or public health nurse can also point you to local services. Rest, asking a partner or friend to take a night shift, and talking about it all help.
          </Text>
        </View>
      </ScrollView>
      <CountryPicker
        visible={picking}
        onClose={() => setPicking(false)}
        onPick={async code => { await setHelpCountryChoice(code); setChoice(code); setPicking(false); }}
      />
    </ThemedView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 60 },
  title: { fontSize: 26, color: colors.heading, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: 18, lineHeight: 20 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  crisis: { borderColor: colors.accent, borderWidth: 2 },
  crisisTitle: { color: colors.heading, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  crisisBtn: { backgroundColor: colors.accent, borderRadius: 10, padding: 12, marginTop: 10 },
  crisisBtnText: { color: colors.onAccent, fontWeight: '700', textAlign: 'center' },
  cardTitle: { color: colors.heading, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  muted: { color: colors.muted, fontSize: 12, marginTop: 8, lineHeight: 18 },
  label: { color: colors.muted, fontSize: 13, marginTop: 12, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  moodLabel: { color: colors.text, fontSize: 10, marginTop: 6, textAlign: 'center' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.text, fontSize: 13 },
  active: { backgroundColor: colors.tint, borderColor: colors.accent },
  input: { marginTop: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.text, minHeight: 60 },
  primary: { backgroundColor: colors.accent, borderRadius: 10, padding: 14, marginTop: 14 },
  primaryText: { color: colors.onAccent, fontWeight: '700', textAlign: 'center' },
  secondary: { padding: 12, marginTop: 6 },
  secondaryText: { color: colors.muted, textAlign: 'center' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 110 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  weekBar: { backgroundColor: colors.link },
  barEmpty: { height: 3, opacity: 0.35 },
  barLabel: { color: colors.muted, fontSize: 8, textAlign: 'center', marginTop: 4 },
  question: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  option: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginTop: 6 },
  optionText: { color: colors.text, fontSize: 13 },
  link: { paddingVertical: 10 },
  linkText: { color: colors.link, fontSize: 14, textDecorationLine: 'underline' },
});
