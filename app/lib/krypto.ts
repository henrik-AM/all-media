/**
 * Ende-zu-Ende-Verschlüsselung — die App-Seite.
 *
 * Gerechnet wird in `gemeinsam/krypto.js`, gemeinsam mit der Website. Hier
 * steht nur, was die App allein angeht: wo der geheime Schlüssel liegt, wie
 * er zum ersten Mal entsteht und wie eine Nachricht auf dem Weg nach Supabase
 * durch ihn hindurchgeht.
 *
 * WO DER GEHEIME SCHLÜSSEL LIEGT
 *
 * In `expo-secure-store`, also in der Schlüsselkette des Geräts (Keychain /
 * Keystore). Nicht in AsyncStorage — das ist eine offene Datei im
 * App-Verzeichnis, und ein Schlüssel, den man mit `cat` lesen kann, ist
 * keiner.
 *
 * Er verlässt das Gerät nie. Es gibt bewusst keine Sicherung, keinen Export
 * und keinen Weg, ihn auf ein zweites Gerät zu bringen. Jeder solche Weg
 * ginge über einen Server, und damit wäre „Ende zu Ende" wieder das, was es
 * bis heute war: ein Satz.
 *
 * WAS DAS FÜR EINEN GERÄTEWECHSEL HEISST
 *
 * Das neue Gerät legt ein eigenes Paar an und kann alte Nachrichten nicht
 * lesen. Das ist keine Panne, sondern der Preis, und die Oberfläche sagt es
 * an der Nachricht („Auf diesem Gerät nicht lesbar") statt es zu verstecken.
 */

import * as SecureStore from 'expo-secure-store';
import * as ExpoCrypto from 'expo-crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const Krypto = require('../../gemeinsam/krypto');

/*
 * Die Zufallsquelle, einmal beim Laden des Moduls.
 *
 * tweetnacl findet sie im Browser und in Node allein, in React Native nicht.
 * Ohne sie wirft es „no PRNG" und es wird nichts verschlüsselt — das ist das
 * richtige Verhalten, aber es soll gar nicht erst dazu kommen.
 */
Krypto.zufallsquelleSetzen((x: Uint8Array, n: number) => {
  const bytes = ExpoCrypto.getRandomBytes(n);
  for (let i = 0; i < n; i++) x[i] = bytes[i];
});

const SCHLUESSEL_FACH = 'allmedia.krypto.geheim';
const GERAET_FACH = 'allmedia.krypto.geraet';

export interface MeinSchluessel {
  /** Die Zeilen-Kennung in `krypto_schluessel` — an sie gehen die Kuverts. */
  id: string;
  /** Die Gerätekennung, unter der die Zeile wiedergefunden wird. */
  geraet: string;
  oeffentlich: string;
  geheim: string;
}

/**
 * Der Schlüssel dieses Geräts — angelegt, wenn es ihn noch nicht gibt.
 *
 * Der geheime Teil und die Gerätekennung gehören zusammen: ohne die Kennung
 * findet das Gerät seine Zeile in `krypto_schluessel` nicht wieder und legte
 * bei jedem Start eine neue an. Deshalb liegen beide im selben Fach und
 * werden nur gemeinsam erneuert.
 */
export async function meinSchluessel(
  client: SupabaseClient,
  ichId: string
): Promise<MeinSchluessel | null> {
  try {
    let geheim = await SecureStore.getItemAsync(SCHLUESSEL_FACH);
    let geraet = await SecureStore.getItemAsync(GERAET_FACH);

    if (!geheim || !geraet) {
      const paar = Krypto.schluesselpaarErzeugen();
      geheim = paar.geheim as string;
      geraet = ExpoCrypto.randomUUID();
      await SecureStore.setItemAsync(SCHLUESSEL_FACH, geheim);
      await SecureStore.setItemAsync(GERAET_FACH, geraet);
    }

    const oeffentlich = oeffentlichAus(geheim);

    /*
     * Beim Server anmelden. `upsert` auf (user_id, geraet), damit ein
     * zweiter Start keine zweite Zeile anlegt — und damit ein neu erzeugter
     * Schlüssel die alte Zeile ersetzt statt danebenzustehen.
     */
    const { data, error } = await client
      .from('krypto_schluessel')
      .upsert(
        { user_id: ichId, geraet, art: 'app', oeffentlich },
        { onConflict: 'user_id,geraet' }
      )
      .select('id')
      .single();
    if (error) throw error;

    return { id: (data as any).id, geraet, oeffentlich, geheim };
  } catch (fehler) {
    /*
     * Kein Wurf. Ohne Schlüssel wird eben im Klartext geschrieben, wie vor
     * Schema 31 — eine Chatliste, die wegen der Verschlüsselung gar nicht
     * mehr aufgeht, wäre der schlechtere Zustand. Die Oberfläche zeigt das
     * Schloss dann nicht an, behauptet also auch nichts.
     */
    console.warn('Gerätschlüssel nicht verfügbar:', (fehler as any)?.message ?? fehler);
    return null;
  }
}

/** Den öffentlichen Teil aus dem geheimen zurückrechnen — nichts wird gespeichert. */
function oeffentlichAus(geheim: string): string {
  const nacl = require('../../gemeinsam/tweetnacl');
  const paar = nacl.box.keyPair.fromSecretKey(Krypto.ausBase64(geheim));
  return Krypto.zuBase64(paar.publicKey);
}

/** Der Fingerabdruck zum Vergleichen von Hand — im Kontaktprofil sichtbar. */
export function fingerabdruck(oeffentlich: string): string {
  return Krypto.fingerabdruck(oeffentlich);
}

/**
 * Alle Geräte, die eine Nachricht in diesem Chat mitlesen dürfen.
 *
 * Das sind die Geräte aller Chatmitglieder — die des Gegenübers **und** die
 * eigenen. Die eigenen gehören zwingend dazu, sonst kann man seine eigene
 * Nachricht am zweiten Gerät nicht mehr lesen. Das ist der Fehler, den man
 * hier genau einmal macht und der erst Tage später auffällt.
 */
export async function empfaengerSchluessel(
  client: SupabaseClient,
  chatId: string
): Promise<{ id: string; oeffentlich: string }[]> {
  const { data: mitglieder, error: fehlerM } = await client
    .from('chat_members')
    .select('user_id')
    .eq('chat_id', chatId);
  if (fehlerM) throw fehlerM;

  const ids = (mitglieder ?? []).map((m: any) => m.user_id);
  if (!ids.length) return [];

  const { data, error } = await client
    .from('krypto_schluessel')
    .select('id, oeffentlich')
    .in('user_id', ids);
  if (error) throw error;

  return (data ?? []) as { id: string; oeffentlich: string }[];
}

/**
 * Kann dieser Chat verschlüsselt werden?
 *
 * Nur ein Chat zu zweit, und nur wenn beide Seiten ein Gerät angemeldet
 * haben. Ist das Gegenüber noch nie mit einem Gerät dagewesen, gibt es
 * niemanden, für den man verschließen könnte — dann bleibt es Klartext, und
 * die Oberfläche zeigt kein Schloss.
 */
export async function chatVerschluesselbar(
  client: SupabaseClient,
  chatId: string,
  ichId: string
): Promise<boolean> {
  const { data: chat } = await client
    .from('chats')
    .select('is_group')
    .eq('id', chatId)
    .maybeSingle();
  if (!chat || (chat as any).is_group) return false;

  const schluessel = await empfaengerSchluessel(client, chatId);
  const konten = new Set<string>();
  const { data: zeilen } = await client
    .from('krypto_schluessel')
    .select('user_id')
    .in('id', schluessel.map((s) => s.id));
  for (const z of zeilen ?? []) konten.add((z as any).user_id);

  return konten.size >= 2 && konten.has(ichId);
}

/**
 * Was beim Senden in `messages` geschrieben wird.
 *
 * Zwei Formen, je nachdem ob verschlossen werden konnte. Die Kuverts stehen
 * daneben und nicht darin, weil sie in eine eigene Tabelle gehen — erst nach
 * der Nachricht, denn sie brauchen ihre Kennung.
 */
export interface Verschlossen {
  spalten: {
    krypto: number;
    text: string;
    chiffre: string | null;
    krypto_nonce: string | null;
    absender_schluessel: string | null;
  };
  kuverts: { schluesselId: string; nonce: string; chiffre: string }[];
}

/** Klartext lassen — als eigene Funktion, damit der Aufrufer keinen Sonderfall braucht. */
export function offen(text: string): Verschlossen {
  return {
    spalten: {
      krypto: 0,
      text,
      chiffre: null,
      krypto_nonce: null,
      absender_schluessel: null,
    },
    kuverts: [],
  };
}

/**
 * Einen Text für alle Geräte dieses Chats verschließen.
 *
 * Gibt die offene Form zurück, wenn etwas fehlt — kein Schlüssel, kein
 * Empfänger, keine Zufallsquelle. Lieber eine Nachricht, die ankommt und
 * nicht verschlüsselt ist und bei der auch kein Schloss steht, als eine, die
 * gar nicht ankommt.
 */
export function verschliessen(
  text: string,
  meiner: MeinSchluessel | null,
  empfaenger: { id: string; oeffentlich: string }[]
): Verschlossen {
  if (!meiner || !empfaenger.length) return offen(text);
  try {
    const paket = Krypto.verschluesseln(text, meiner.geheim, empfaenger);
    return {
      spalten: {
        krypto: paket.version,
        text: '',
        chiffre: paket.chiffre,
        krypto_nonce: paket.nonce,
        absender_schluessel: paket.absender,
      },
      kuverts: paket.kuverts,
    };
  } catch (fehler) {
    console.warn('Verschlüsseln fehlgeschlagen:', (fehler as any)?.message ?? fehler);
    return offen(text);
  }
}

/**
 * Der ganze Weg auf einmal: Schlüssel holen, Chat prüfen, Text verschließen.
 *
 * Es gibt diese Funktion, damit `nachrichtSenden` **einen** Aufruf hat und
 * nicht drei. Wo drei Schritte stehen, vergisst irgendwann jemand den
 * mittleren — und der mittlere ist hier die Prüfung, ob es überhaupt ein
 * Chat zu zweit ist. Vergisst man die, werden Gruppen halb verschlüsselt,
 * und ein später hinzugekommenes Mitglied sieht Kästen statt Nachrichten.
 */
export async function fuerChatVerschliessen(
  client: SupabaseClient,
  chatId: string,
  ichId: string,
  text: string
): Promise<Verschlossen> {
  try {
    // Ein Anhang ohne Text ist kein Fall für die Verschlüsselung: das Bild
    // liegt ohnehin offen im Speicher-Bucket, und ein leerer Text ergäbe
    // eine Chiffre, die nichts verbirgt.
    if (!text) return offen(text);

    const { data: chat } = await client
      .from('chats')
      .select('is_group')
      .eq('id', chatId)
      .maybeSingle();
    if (!chat || (chat as any).is_group) return offen(text);

    const meiner = await meinSchluessel(client, ichId);
    if (!meiner) return offen(text);

    const empfaenger = await empfaengerSchluessel(client, chatId);
    // Weniger als zwei Konten heißt: das Gegenüber war noch nie mit einem
    // Gerät da. Dann gibt es niemanden, für den man verschließen könnte.
    const { data: konten } = await client
      .from('krypto_schluessel')
      .select('user_id')
      .in('id', empfaenger.map((s) => s.id));
    const verschieden = new Set((konten ?? []).map((k: any) => k.user_id));
    if (verschieden.size < 2) return offen(text);

    return verschliessen(text, meiner, empfaenger);
  } catch (fehler) {
    console.warn('Verschlüsseln übersprungen:', (fehler as any)?.message ?? fehler);
    return offen(text);
  }
}

/** Der Platzhalter für eine Nachricht, deren Kuvert dieses Gerät nicht hat. */
export const NICHT_LESBAR = 'Auf diesem Gerät nicht lesbar';

/**
 * Einen geladenen Stapel Nachrichten aufschließen.
 *
 * Die Kuverts kommen in **einer** Abfrage nach, nicht je Nachricht einzeln —
 * bei fünfhundert Nachrichten wären das fünfhundert Rundläufe, und der Chat
 * bräuchte Sekunden zum Öffnen. Derselbe Grund wie beim Nachladen der Bezüge
 * in `ladeNachrichten`.
 *
 * Die Funktion ändert `text` an Ort und Stelle. Alles danach — Vorschau in
 * der Chatliste, Suche, Antwortbezug — arbeitet damit weiter, als hätte es
 * nie eine Chiffre gegeben. Nur so bleibt die Verschlüsselung eine Schicht
 * und nicht ein Sonderfall an fünfzig Stellen.
 */
export async function aufschliessen(
  client: SupabaseClient,
  zeilen: any[],
  meiner: MeinSchluessel | null
): Promise<any[]> {
  const verschlossen = zeilen.filter((z) => Number(z?.krypto) > 0);
  if (!verschlossen.length) return zeilen;

  if (!meiner) {
    for (const z of verschlossen) z.text = NICHT_LESBAR;
    return zeilen;
  }

  const { data: kuverts } = await client
    .from('message_keys')
    .select('message_id, nonce, chiffre')
    .eq('schluessel_id', meiner.id)
    .in('message_id', verschlossen.map((z) => z.id));

  const nachId = new Map<string, any>();
  for (const k of kuverts ?? []) nachId.set((k as any).message_id, k);

  for (const z of verschlossen) {
    const kuvert = nachId.get(z.id);
    const klar = kuvert
      ? Krypto.entschluesseln(
          { version: z.krypto, chiffre: z.chiffre, nonce: z.krypto_nonce, absender: z.absender_schluessel },
          kuvert,
          meiner.geheim
        )
      : null;
    z.text = klar === null ? NICHT_LESBAR : klar;
    z.warVerschluesselt = true;
  }

  return zeilen;
}
