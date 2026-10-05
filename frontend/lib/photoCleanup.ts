import { supabase } from './supabase';

// Deletes a milestone photo file once no entry points at it any more. (A milestone logged for twins shares one file.)
// If we cannot tell (no signal), the file is kept: a stray file is better than a missing photo.
export async function removePhotoIfUnused(path: string | undefined | null) {
  if (!path) return;
  try {
    const { data, error } = await supabase.from('logs').select('id').eq('data->>photo', path).limit(1);
    if (error || (data ?? []).length > 0) return;
    await supabase.storage.from('milestone-photos').remove([path]);
  } catch {}
}
