import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MilestonePhoto } from '@/components/MilestonePhoto';
import { friendlyError } from '@/components/LoadError';
import { isOnline } from '@/lib/online';
import { PickedPhoto, photoUrls, pickPhoto } from '@/lib/photos';
import { Palette, useStyles, useTheme } from '@/lib/theme';

export interface PhotoChoice {
  local: PickedPhoto | null; // a newly chosen photo, not uploaded yet
  removed: boolean;          // the existing photo should be taken off
}
export const NO_PHOTO_CHANGE: PhotoChoice = { local: null, removed: false };

// Add, replace or remove the photo of a milestone. Uploading happens when the entry is saved.
export function PhotoField({ existing, value, onChange }: { existing?: string; value: PhotoChoice; onChange: (v: PhotoChoice) => void }) {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    let live = true;
    if (existing) photoUrls([existing]).then(m => live && setUrl(m[existing]));
    return () => { live = false; };
  }, [existing]);

  const choose = async (source: 'library' | 'camera') => {
    if (!(await isOnline())) return Alert.alert('No connection', 'Photos need a connection to upload. You can add the photo later, once you are back online.');
    try {
      const p = await pickPhoto(source);
      if (p) onChange({ local: p, removed: false });
    } catch (e) {
      Alert.alert('Could not add the photo', friendlyError(e));
    }
  };

  const showing = value.local ? 'local' : existing && !value.removed ? 'existing' : 'none';
  return (
    <View>
      {showing === 'local' ? <Image source={{ uri: value.local!.uri }} style={styles.preview} contentFit="cover" /> : null}
      {showing === 'existing' ? <MilestonePhoto path={existing!} url={url} /> : null}
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => choose('library')}><Text style={styles.btnText}>{showing === 'none' ? 'Add a photo' : 'Choose another'}</Text></Pressable>
        <Pressable style={styles.btn} onPress={() => choose('camera')}><Text style={styles.btnText}>Take a photo</Text></Pressable>
        {showing !== 'none' ? (
          <Pressable style={styles.btn} onPress={() => onChange({ local: null, removed: true })}><Text style={[styles.btnText, { color: colors.danger }]}>Remove</Text></Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>Photos are private to you and your partner.</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  preview: { width: '100%', height: 180, borderRadius: 12, marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  btn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  btnText: { color: colors.text, fontSize: 13 },
  hint: { color: colors.muted, fontSize: 11, marginTop: 6 },
});
