import { SupabaseClient } from '@supabase/supabase-js';
import * as D from '../../gemeinsam/instantsdaten';
import * as I from '../../gemeinsam/instants';
import { ladeHoch, loesche } from './supabaseStorage';
import { signiereEine } from './medien';
export { D };
export async function instantSenden(c: SupabaseClient, ich: string, uri: string, text: string, anzahl: number) {
    const grund = I.pruefen(text, anzahl);
    if (grund)
        throw new Error(grund);
    const hoch = await ladeHoch(c, uri, 'instants', `${ich}/${Date.now()}.jpg`, { bytes: I.BILD_MAX, zuGross: () => 'Das Foto darf höchstens 250 KB groß sein.' });
    if (!hoch.success || !hoch.url)
        throw new Error(hoch.error || 'Hochladen fehlgeschlagen');
    const pfad = hoch.url.split('/storage/v1/object/public/media/')[1];
    try {
        return await D.senden(c, pfad, text);
    }
    catch (e) {
        await loesche(c, pfad);
        throw e;
    }
}
export async function instantBild(c: SupabaseClient, id: string) {
    const zeile = await D.datei(c, id);
    const uri = await signiereEine(c, zeile.bild_pfad);
    if (!uri)
        throw new Error('Instant nicht mehr verfügbar');
    return { uri, text: zeile.text };
}
