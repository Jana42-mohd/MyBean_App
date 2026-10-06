import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PostFile } from '@/lib/postMediaStore';

function Placeholder({ label, height }: { label: string; height: number }) {
  return (
    <View style={[styles.placeholder, { height }]}>
      <Text style={styles.placeholderText}>{label}</Text>
    </View>
  );
}

function Video({ url }: { url: string }) {
  const player = useVideoPlayer(url, p => { p.loop = false; });
  return <VideoView player={player} style={styles.video} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} accessibilityLabel="Video" />;
}

// The photos and videos of a post (or of a post being written). Tap a photo to see it full screen; videos play in place.
export function PostMedia({ items, urls }: { items: PostFile[]; urls: Record<string, string> }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<string | null>(null);
  if (!items.length) return null;

  const video = items.find(i => i.kind === 'video');
  const images = items.filter(i => i.kind === 'image');
  const half = images.length > 1;

  return (
    <View style={styles.wrap}>
      {video ? (urls[video.path] ? <Video url={urls[video.path]} /> : <Placeholder label="Video unavailable (needs a connection)" height={200} />) : null}
      {images.length ? (
        <View style={styles.grid}>
          {images.map((i, idx) => {
            const wide = !half || (idx === images.length - 1 && images.length % 2 === 1); // an odd last photo fills the row
            return (
            <Pressable key={i.path} style={[styles.cell, wide ? null : styles.cellHalf]} onPress={() => urls[i.path] && setOpen(i.path)} accessibilityRole="imagebutton" accessibilityLabel="Photo, tap to enlarge">
              {urls[i.path] ? (
                <Image source={{ uri: urls[i.path], cacheKey: i.path }} style={{ width: '100%', height: wide ? (half ? 180 : 220) : 140 }} contentFit="cover" />
              ) : (
                <Placeholder label="Photo unavailable" height={wide ? (half ? 180 : 220) : 140} />
              )}
            </Pressable>
            );
          })}
        </View>
      ) : null}

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.viewer} onPress={() => setOpen(null)}>
          {open ? <Image source={{ uri: urls[open], cacheKey: open }} style={{ flex: 1 }} contentFit="contain" /> : null}
          <View style={[styles.close, { top: insets.top + 12 }]}><MaterialCommunityIcons name="close" size={24} color="#E8FBFF" /></View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: '100%', borderRadius: 12, overflow: 'hidden' },
  cellHalf: { width: '49%' },
  video: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#000' },
  placeholder: { width: '100%', backgroundColor: '#09282eff', alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  placeholderText: { color: '#A4CDD3', fontSize: 12, textAlign: 'center', paddingHorizontal: 8 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  close: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
});
