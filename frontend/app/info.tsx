import { StyleSheet, ScrollView, Text, View, Pressable, Linking } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

const openURL = (url: string) => {
  Linking.openURL(url).catch(() => {});
};

export default function InfoScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.title}>Information Hub</ThemedText>
        <Text style={styles.subtitle}>Resources for growth, development, safety & health</Text>

        {/* Growth Tracking Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Growth Tracking</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Weight & Height</Text>
            <Text style={styles.cardBody}>
              Track baby's growth at regular check-ups. Most babies double their birth weight by 5-6 months and triple it by 1 year. Growth patterns are more important than absolute numbers.
            </Text>
            <Pressable onPress={() => openURL('https://www.cdc.gov/growthcharts/')}>
              <Text style={styles.link}>CDC Growth Charts →</Text>
            </Pressable>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Head Circumference</Text>
            <Text style={styles.cardBody}>
              Measuring head circumference helps monitor brain development and detect any concerns early. Your pediatrician tracks this at each visit.
            </Text>
          </View>
        </View>

        {/* Developmental Milestones Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Developmental Milestones</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>0-3 Months</Text>
            <Text style={styles.cardBody}>
              Fixes eyes on objects, lifts head briefly, startles to loud sounds, coos, follows objects with eyes
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>3-6 Months</Text>
            <Text style={styles.cardBody}>
              Laughs, reaches for objects, begins to sit with support, rolls over, babbles, recognizes faces
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>6-12 Months</Text>
            <Text style={styles.cardBody}>
              Sits alone, crawls, pulls to stand, waves bye-bye, says "mama" and "dada", feeds self with fingers
            </Text>
          </View>
        </View>

        {/* Red Flags Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>When to Call the Doctor</Text>
          <View style={[styles.card, styles.warningCard]}>
            <Text style={styles.cardTitle}>Seek immediate care if:</Text>
            <Text style={styles.cardBody}>
              • Temperature 100.4°F (38°C) or higher in baby under 3 months{'\n'}
              • Difficulty breathing or rapid breathing{'\n'}
              • Extreme lethargy or unresponsiveness{'\n'}
              • Purple or blue skin{'\n'}
              • Convulsions or seizures{'\n'}
              • Severe allergic reaction{'\n'}
              • Suspected poisoning or ingestion of harmful substance
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contact doctor within 24 hours:</Text>
            <Text style={styles.cardBody}>
              • Fever (100.4°F) in baby 3-6 months{'\n'}
              • Vomiting (not just spitting up){'\n'}
              • Diarrhea lasting more than a few hours{'\n'}
              • Refusing multiple feedings{'\n'}
              • Unusual rash{'\n'}
              • Persistent crying despite comforting{'\n'}
              • Ear pulling with fever
            </Text>
          </View>
        </View>

        {/* Safe Sleep Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Safe Sleep Guidelines</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SIDS Prevention Checklist</Text>
            <Text style={styles.cardBody}>
              ✓ Place baby on back to sleep{'\n'}
              ✓ Use firm, flat sleep surface{'\n'}
              ✓ Room-share without bed-sharing for 6+ months{'\n'}
              ✓ Keep soft objects out of crib{'\n'}
              ✓ Avoid overheating (68-72°F optimal){'\n'}
              ✓ Consider offering a pacifier at nap/bedtime{'\n'}
              ✓ Avoid smoke, alcohol, and drug exposure during pregnancy and after birth
            </Text>
            <Pressable onPress={() => openURL('https://safetosleep.nichd.nih.gov/')}>
              <Text style={styles.link}>Safe Sleep Guidelines →</Text>
            </Pressable>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Shaken Baby Syndrome</Text>
            <Text style={styles.cardBody}>
              Never shake a baby. Even brief, vigorous shaking can cause permanent injury or death. If overwhelmed, safely place baby in crib and step away.
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Suffocation Hazards</Text>
            <Text style={styles.cardBody}>
              Avoid: blankets, pillows, bumpers, sleep positioners, co-sleeping on couches, wedges that restrict movement
            </Text>
            <Pressable onPress={() => openURL('https://www.cdc.gov/sids/about/index.html')}>
              <Text style={styles.link}>Read more about safe sleep →</Text>
            </Pressable>
          </View>
        </View>

        {/* Health & Infections Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Health & Infections</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Infections in Newborns</Text>
            <Text style={styles.cardBody}>
              Newborns (0-28 days) are highly vulnerable. Watch for: fever, poor feeding, lethargy, difficulty breathing, unusual fussiness, jaundice
            </Text>
            <Pressable onPress={() => openURL('https://www.cdc.gov/rsv/index.html')}>
              <Text style={styles.link}>CDC on RSV & Infections →</Text>
            </Pressable>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Jaundice Monitoring</Text>
            <Text style={styles.cardBody}>
              Mild jaundice is common. Severe cases need treatment. Follow up with pediatrician if baby's skin or eyes appear very yellow.
            </Text>
            <Pressable onPress={() => openURL('https://www.cdc.gov/ncbddd/jaundice/facts.html')}>
              <Text style={styles.link}>Jaundice Facts →</Text>
            </Pressable>
          </View>
        </View>

        {/* Choking Prevention */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Choking Prevention</Text>
          <View style={styles.card}>
            <Text style={styles.cardBody}>
              • Keep small objects away (coins, buttons, batteries){'\n'}
              • Cut foods into small, safe pieces{'\n'}
              • Avoid: grapes, nuts, popcorn, hard candy until age 4+{'\n'}
              • Never leave baby unattended while eating{'\n'}
              • Learn infant CPR and choking first aid
            </Text>
            <Pressable onPress={() => openURL('https://www.healthychildren.org/English/health-issues/injuries-emergencies/Pages/Choking-Prevention.aspx')}>
              <Text style={styles.link}>Choking Prevention Tips →</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.reminderCard}>
          <Text style={styles.reminderText}>
            Being informed and aware is the best protection. Most infant health risks are preventable with simple precautions and timely care.
          </Text>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09282eff',
  },
  content: {
    paddingTop: 80,
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 24,
    color: '#FED8FE',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    color: '#A4CDD3',
  },
  sectionContainer: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#FDFECC',
    fontWeight: '700',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#0f3a41ff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2F9BA8',
    gap: 8,
  },
  warningCard: {
    borderColor: '#FED8FE',
    borderWidth: 1.5,
  },
  cardTitle: {
    fontSize: 15,
    color: '#FDFECC',
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 14,
    color: '#E8FBFF',
    lineHeight: 21,
  },
  link: {
    fontSize: 14,
    color: '#FDFECC',
    marginTop: 8,
    fontWeight: '600',
  },
  reminderCard: {
    backgroundColor: 'rgba(254, 216, 254, 0.1)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FED8FE',
    marginTop: 8,
  },
  reminderText: {
    fontSize: 15,
    color: '#FED8FE',
    lineHeight: 22,
    fontWeight: '500',
  },
});
