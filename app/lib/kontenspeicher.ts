/**
 * Die Sitzungen mehrerer eigener Konten — für „Profil wechseln".
 *
 * WARUM ES DAS GIBT
 *
 * Die App führt eine Liste eigener Konten wie Instagram: man meldet ein
 * zweites an und schaltet zwischen beiden um. Die Liste stand bisher in
 * AsyncStorage, und `wechsleZu()` setzte darin eine andere Kennung als
 * „aktiv". Mehr passierte nicht.
 *
 * supabase-js hat aber genau eine Sitzung. Nach dem Umschalten zeigte die App
 * also Name und Bild des zweiten Kontos, während jede Abfrage und jedes Like
 * weiter unter dem ersten lief — und beim Anmelden des zweiten war die
 * Sitzung des ersten überschrieben und weg. Der Wechsel zurück führte in eine
 * leere App.
 *
 * Hier liegen deshalb die Sitzungen aller angemeldeten Konten, je eine unter
 * ihrer Nutzerkennung. Beim Wechsel wird die aktuelle gesichert und die des
 * Ziels über `auth.setSession()` eingesetzt.
 *
 * WO SIE LIEGEN
 *
 * Im Schlüsselbund, über `lib/sitzungsspeicher.ts` — derselbe Weg, den
 * supabase-js für seine eigene Sitzung nimmt. Ein Erneuerungstoken ist ein
 * Dauerausweis für dieses Konto; in einer unverschlüsselten Datei im
 * App-Verzeichnis hat es nichts zu suchen. Das war Fund 12 der
 * Sicherheitsprüfung vom 04.09.2026 und gilt hier genauso.
 *
 * Gespeichert wird nur, was zum Wiederherstellen nötig ist: die beiden
 * Token. Kein Passwort — das verlässt die Anmeldemaske nicht.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { sitzungsspeicher } from './sitzungsspeicher';

const VORSATZ = 'all-media.konto.';

/** Die Kennungen, zu denen eine Sitzung liegt — für das Aufräumen beim Abmelden. */
const SCHLUESSELLISTE = 'all-media.konten.liste';

interface GespeicherteSitzung {
  access_token: string;
  refresh_token: string;
}

async function liste(): Promise<string[]> {
  try {
    const roh = await sitzungsspeicher.getItem(SCHLUESSELLISTE);
    const daten = roh ? JSON.parse(roh) : [];
    return Array.isArray(daten) ? daten.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function listeSetzen(ids: string[]): Promise<void> {
  await sitzungsspeicher.setItem(SCHLUESSELLISTE, JSON.stringify([...new Set(ids)]));
}

/**
 * Die Sitzung, die gerade im Client steckt, unter ihrem Konto ablegen.
 *
 * Wird vor jedem Wechsel und nach jeder Anmeldung aufgerufen. Die Token
 * ändern sich im Betrieb — `autoRefreshToken` tauscht sie alle Stunde aus —,
 * deshalb wird immer der aktuelle Stand gesichert und nicht der vom Anmelden.
 */
export async function sitzungSichern(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getSession();
  const sitzung = data.session;
  if (!sitzung?.user?.id || !sitzung.refresh_token) return null;

  const eintrag: GespeicherteSitzung = {
    access_token: sitzung.access_token,
    refresh_token: sitzung.refresh_token,
  };
  await sitzungsspeicher.setItem(VORSATZ + sitzung.user.id, JSON.stringify(eintrag));
  await listeSetzen([...(await liste()), sitzung.user.id]);
  return sitzung.user.id;
}

/**
 * Auf ein anderes Konto umschalten.
 *
 * Gibt zurück, ob es geklappt hat. Bei `false` ist die Sitzung des Ziels
 * abgelaufen oder anderswo beendet worden — dann muss sich dieses Konto neu
 * anmelden. Wichtig ist, dass der Aufrufer das erfährt: eine Anzeige, die auf
 * das andere Konto umschaltet, obwohl die Datenbank weiter das alte kennt,
 * ist genau der Zustand, der hier abgeschafft werden soll.
 */
export async function sitzungWechseln(client: SupabaseClient, kontoId: string): Promise<boolean> {
  // Erst das, was gerade läuft, sichern — sonst ist der Rückweg zu.
  await sitzungSichern(client).catch(() => null);

  let eintrag: GespeicherteSitzung | null = null;
  try {
    const roh = await sitzungsspeicher.getItem(VORSATZ + kontoId);
    eintrag = roh ? (JSON.parse(roh) as GespeicherteSitzung) : null;
  } catch {
    eintrag = null;
  }
  if (!eintrag?.refresh_token) return false;

  const { data, error } = await client.auth.setSession({
    access_token: eintrag.access_token,
    refresh_token: eintrag.refresh_token,
  });

  /*
   * `setSession` erneuert bei abgelaufenem Zugangstoken selbst und gibt dann
   * neue Token zurück. Die müssen sofort wieder abgelegt werden, sonst steht
   * hier beim nächsten Wechsel ein verbrauchtes Erneuerungstoken — Supabase
   * gibt jedes nur einmal her.
   */
  if (error || !data.session || data.session.user?.id !== kontoId) {
    if (error) console.error('Kontowechsel fehlgeschlagen:', error.message);
    await sitzungVergessen(kontoId);
    return false;
  }

  await sitzungSichern(client);
  return true;
}

/** Die Sitzung eines Kontos wegwerfen — beim Abmelden dieses einen Kontos. */
export async function sitzungVergessen(kontoId: string): Promise<void> {
  await sitzungsspeicher.removeItem(VORSATZ + kontoId);
  await listeSetzen((await liste()).filter((id) => id !== kontoId));
}

/** Alle Sitzungen wegwerfen — beim vollständigen Abmelden. */
export async function alleVergessen(): Promise<void> {
  for (const id of await liste()) await sitzungsspeicher.removeItem(VORSATZ + id);
  await sitzungsspeicher.removeItem(SCHLUESSELLISTE);
}

/** Wer steckt gerade im Client? Leer, wenn niemand. */
export async function werIstAngemeldet(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getSession();
  return data.session?.user?.id ?? null;
}
