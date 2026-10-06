import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { signedUrls } from './signedUrls';
import { supabase } from './supabase';

// Private milestone photos. Files live in the 'milestone-photos' bucket under <household id>/<random>.jpg;
// the database only lets that household's members read or add them (migration 0011).
const BUCKET = 'milestone-photos';
const MAX_WIDTH = 1600;

export async function myHouseholdId(): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not signed in');
  const { data, error } = await supabase.from('profiles').select('household_id').eq('id', u.user.id).maybeSingle();
  if (error) throw error;
  if (!data?.household_id) throw new Error('Your household could not be found');
  return data.household_id as string;
}

export interface PickedPhoto {
  uri: string; // a JPEG on this phone, already shrunk and with location data removed
}

// Asks the person for a photo (library or camera). Returns null if they cancel.
export async function pickPhoto(source: 'library' | 'camera'): Promise<PickedPhoto | null> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(source === 'camera' ? 'Camera access is off. You can turn it on in your phone settings.' : 'Photo access is off. You can turn it on in your phone settings.');
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, exif: false };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];

  // Re-encoding drops the photo's hidden data (such as where it was taken) and keeps uploads small
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (asset.width && asset.width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });
  return { uri: out.uri };
}

// Uploads the picked photo and returns its path to store on the entry
export async function uploadPhoto(photo: PickedPhoto): Promise<string> {
  const household = await myHouseholdId();
  const path = `${household}/${Crypto.randomUUID()}.jpg`;
  const bytes = await (await fetch(photo.uri)).arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

// Photos are private: each one is shown through a link that stops working after an hour
export const photoUrls = (paths: string[]) => signedUrls(BUCKET, paths);
export { forgetSignedUrls as forgetPhotoUrls } from './signedUrls';
