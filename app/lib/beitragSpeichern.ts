import type { SupabaseClient } from '@supabase/supabase-js';
import { beitragAnlegen, NeuerBeitrag } from './aktionen';
import { ladeHoch, loesche } from './supabaseStorage';

/** Erst erfolgreich hochladen und speichern, danach eine echte Feedkachel zeigen. */
export async function beitragSpeichern(client: SupabaseClient, ichId: string, felder: NeuerBeitrag) {
  let adresse = felder.mediaUrl;
  let anzeige = adresse;
  let uploadPfad: string | undefined;
  if (adresse && !/^https?:/i.test(adresse)) {
    const endung = felder.art === 'post' ? 'jpg' : 'mp4';
    const upload = await ladeHoch(client, adresse, 'posts', `${ichId}-${Date.now()}.${endung}`);
    if (!upload.success || !upload.url) throw new Error(upload.error || 'Die Aufnahme ließ sich nicht speichern');
    adresse = upload.url;
    anzeige = upload.anzeige || upload.url;
    uploadPfad = adresse.split('/storage/v1/object/public/media/')[1];
  }
  try {
    const id = await beitragAnlegen(client, ichId, { ...felder, mediaUrl: adresse });
    return { id, mediaUri: anzeige };
  } catch (fehler) {
    // Wie beim Websiteformular: fehlgeschlagener Beitrag hinterlässt keine Aufnahme.
    if (uploadPfad) await loesche(client, uploadPfad);
    throw fehler;
  }
}
