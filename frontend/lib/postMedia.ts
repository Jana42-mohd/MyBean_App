import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LocalMedia, MAX_FILES } from './postMediaStore';

// Choosing photos and videos for a community post.
export const MAX_VIDEO_SECONDS = 30;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_WIDTH = 1600;

const VIDEO_EXT: Record<string, { ext: string; mime: string }> = {
  'video/mp4': { ext: 'mp4', mime: 'video/mp4' },
  'video/quicktime': { ext: 'mov', mime: 'video/quicktime' },
};

async function prepareImage(a: ImagePicker.ImagePickerAsset): Promise<LocalMedia> {
  // Re-encoding drops hidden data such as where the photo was taken, and keeps uploads small
  const ctx = ImageManipulator.manipulate(a.uri);
  if (a.width && a.width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH });
  const out = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });
  return { uri: out.uri, kind: 'image', ext: 'jpg', mime: 'image/jpeg' };
}

function prepareVideo(a: ImagePicker.ImagePickerAsset): LocalMedia {
  const seconds = a.duration != null ? a.duration / 1000 : undefined; // the picker reports milliseconds
  if (seconds != null && seconds > MAX_VIDEO_SECONDS + 0.5) throw new Error(`Videos can be up to ${MAX_VIDEO_SECONDS} seconds. Trim it in your gallery and try again.`);
  if (a.fileSize != null && a.fileSize > MAX_VIDEO_BYTES) throw new Error('That video is too large (the limit is 25 MB). Try a shorter clip.');
  const type = VIDEO_EXT[(a.mimeType ?? '').toLowerCase()] ?? (a.uri.toLowerCase().endsWith('.mov') ? VIDEO_EXT['video/quicktime'] : VIDEO_EXT['video/mp4']);
  return { uri: a.uri, kind: 'video', ext: type.ext, mime: type.mime, duration: seconds };
}

// `current` is what is already in the post, so the limits (4 files, one video) hold across several picks
export async function pickPostMedia(source: 'library' | 'camera', current: LocalMedia[]): Promise<LocalMedia[]> {
  const room = MAX_FILES - current.length;
  if (room <= 0) throw new Error(`A post can have at most ${MAX_FILES} photos or videos.`);
  const hasVideo = current.some(m => m.kind === 'video');

  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(source === 'camera' ? 'Camera access is off. You can turn it on in your phone settings.' : 'Photo access is off. You can turn it on in your phone settings.');

  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: hasVideo ? ['images'] : ['images', 'videos'],
    allowsMultipleSelection: source === 'library',
    selectionLimit: room,
    videoMaxDuration: MAX_VIDEO_SECONDS,
    quality: 0.8,
    exif: false,
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return [];

  const picked: LocalMedia[] = [];
  let video = hasVideo;
  for (const a of res.assets.slice(0, room)) {
    if (a.type === 'video') {
      if (video) throw new Error('A post can have only one video.');
      picked.push(prepareVideo(a));
      video = true;
    } else {
      picked.push(await prepareImage(a));
    }
  }
  return picked;
}
