import type { SupabaseClient } from '@supabase/supabase-js';
import { beitragAnlegen, NeuerBeitrag } from './aktionen';
import { ladeHoch, ladeMedienlisteHoch, loesche } from './supabaseStorage';

/** Erst erfolgreich hochladen und speichern, danach eine echte Feedkachel zeigen. */
export async function beitragSpeichern(client: SupabaseClient, ichId: string, felder: NeuerBeitrag) {
  let adresse = felder.mediaUrl;
  let anzeige = adresse;
  let uploadPfad: string | undefined;
  let medien = felder.medien;
  let neueMedien: string[] = [];
  if (medien?.length) {
    // AF4: gemischtes Karussell. Erst alles hochladen, dann den Beitrag anlegen.
    const vorher = new Set(medien.map((m) => m.url));
    medien = await ladeMedienlisteHoch(client, ichId, medien);
    neueMedien = medien.map((m) => m.url).filter((u) => !vorher.has(u));
    adresse = medien[0].url;
    anzeige = adresse;
  } else if (adresse && !/^https?:/i.test(adresse)) {
    const endung = felder.art === 'post' ? 'jpg' : 'mp4';
    const upload = await ladeHoch(client, adresse, 'posts', `${ichId}-${Date.now()}.${endung}`);
    if (!upload.success || !upload.url) throw new Error(upload.error || 'Die Aufnahme ließ sich nicht speichern');
    adresse = upload.url;
    anzeige = upload.anzeige || upload.url;
    uploadPfad = adresse.split('/storage/v1/object/public/media/')[1];
  }
  try {
    const id = await beitragAnlegen(client, ichId, { ...felder, medien, mediaUrl: adresse });
    return { id, mediaUri: anzeige };
  } catch (fehler) {
    // Wie beim Websiteformular: fehlgeschlagener Beitrag hinterlässt keine Aufnahme.
    if (uploadPfad) await loesche(client, uploadPfad);
    for (const url of neueMedien) {
      const pfad = url.split('/storage/v1/object/public/media/')[1];
      if (pfad) await loesche(client, pfad);
    }
    throw fehler;
  }
}
