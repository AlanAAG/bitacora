import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { supabase } from './supabase';
import { RefObject } from 'react';

// ponytail: upload via fetch->blob (same pattern as the audio upload) — no expo-file-system,
// no hand-rolled base64 decode. The local share alone is the viral loop; the remote upload
// just persists share_card_url for later reference.
export async function captureAndShareCard(
  viewRef: RefObject<any>,
  sessionId: string,
): Promise<void> {
  // Capture the card view as a PNG file
  const uri = await captureRef(viewRef, { format: 'png', quality: 0.95 });

  // Persist to the public guard-cards bucket
  const filename = `${sessionId}.png`;
  const blob = await (await fetch(uri)).blob();
  const { error } = await supabase.storage.from('guard-cards')
    .upload(filename, blob, { contentType: 'image/png', upsert: true });

  if (!error) {
    const { data: { publicUrl } } = supabase.storage.from('guard-cards').getPublicUrl(filename);
    await supabase.from('guard_sessions').update({ share_card_url: publicUrl }).eq('id', sessionId);
  }

  // Share locally
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartir resultado de Guardia' });
  }
}
