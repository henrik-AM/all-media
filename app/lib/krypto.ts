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
const { schluesselHolen } = require('../../gemeinsam/kryptodaten');

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

/*
 * Die Fächer in der Schlüsselkette — je KONTO (AR-08, 16.10.2026).
 *
 * Bis dahin gab es genau ein Fach für das ganze Gerät
 * (`allmedia.krypto.geheim` / `allmedia.krypto.geraet`). Jedes Konto, das
 * sich hier anmeldete, meldete dasselbe Paar beim Server an. Folgen: zwei
 * Konten auf einem Gerät (Zweitkonto, Geschwister) hatten dieselbe
 * Sicherheitsnummer und ließen sich einander zuordnen, und wer nach dem
 * Abmelden ein anderes Konto anmeldete, erbte das Paar samt allem, was damit
 * zu öffnen war.
 *
 * Jetzt trägt jedes Fach die Kontokennung. Das alte Fach ohne Kennung ist
 * der ALTBESTAND: es wird beim ersten Zugriff übernommen und dann gelöscht —
 * siehe `altbestandUebernehmen`.
 */
const ALT_SCHLUESSEL_FACH = 'allmedia.krypto.geheim';
const ALT_GERAET_FACH = 'allmedia.krypto.geraet';

/** SecureStore erlaubt nur Buchstaben, Ziffern und `._-` im Namen. */
function faecher(kontoId: string) {
  const id = String(kontoId);
  if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error('Ungültige Kontokennung');
  return { geheim: `${ALT_SCHLUESSEL_FACH}.${id}`, geraet: `${ALT_GERAET_FACH}.${id}` };
}

/**
 * Das alte, kontolose Fach übernehmen — damit bestehende Chats lesbar bleiben.
 *
 * Die Kuverts alter Nachrichten sind für genau dieses Paar verschlossen.
 * Würde es einfach verworfen, stünde in jedem Chat „Auf diesem Gerät nicht
 * lesbar". Also wird es in das Fach des Kontos kopiert, das gerade zugreift,
 * und — weil vor dem 16.10.2026 JEDES Konto dieses Geräts mit demselben
 * Paar geschrieben hat — auch in die Fächer der übrigen hier angemeldeten
 * Konten (lib/kontenspeicher.ts), sofern sie noch keins haben. Erst danach
 * wird das alte Fach gelöscht: ein später neu angemeldetes Konto erbt nichts
 * mehr.
 *
 * Erst schreiben, dann löschen: bricht die App dazwischen ab, liegt der
 * Schlüssel doppelt, aber nie gar nicht.
 *
 * Die Konten, die das Paar so behalten, teilen es weiterhin — das löst erst
 * ein neues Paar je Konto, und das hieße wieder „nicht lesbar" für alles
 * Alte. Neue Konten bekommen von jetzt an ein eigenes.
 */
async function altbestandUebernehmen(kontoId: string): Promise<void> {
  const altGeheim = await SecureStore.getItemAsync(ALT_SCHLUESSEL_FACH);
  const altGeraet = await SecureStore.getItemAsync(ALT_GERAET_FACH);
  if (!altGeheim) return;

  let konten: string[] = [kontoId];
  try {
    /*
     * Erst hier und über `require`: kontenspeicher zieht die
     * Supabase-Einstellungen nach sich, die hier sonst niemand braucht. In
     * den Prüfläufen im Browser (test/_modulquelle.js) gibt es kein
     * `require` — dann wird eben nur das aktive Konto bedacht.
     */
    const { gespeicherteKonten } = require('./kontenspeicher') as typeof import('./kontenspeicher');
    konten = [...new Set([kontoId, ...(await gespeicherteKonten())])];
  } catch {
    throw new Error('Gespeicherte Konten nicht ladbar; Altbestand bleibt erhalten');
  }

  for (const id of konten) {
    const f = faecher(id);
    const vorhanden = await SecureStore.getItemAsync(f.geheim);
    if (vorhanden && vorhanden !== altGeheim) continue;
    if (!vorhanden) await SecureStore.setItemAsync(f.geheim, altGeheim);
    // Nach einem Abbruch zwischen beiden Schreibvorgängen das Paar ergänzen.
    if (altGeraet && !(await SecureStore.getItemAsync(f.geraet))) {
      await SecureStore.setItemAsync(f.geraet, altGeraet);
    }
  }
  await SecureStore.deleteItemAsync(ALT_SCHLUESSEL_FACH);
  await SecureStore.deleteItemAsync(ALT_GERAET_FACH);
}

/*
 * Laufende Zugriffe je Konto. Beim Start fragen Chatliste, Verlauf und
 * DatenContext gleichzeitig nach dem Schlüssel; ohne diese Sperre legten
 * zwei davon auf einem frischen Gerät je ein eigenes Paar an, und eines
 * davon ginge verloren — samt allem, was dafür verschlossen wurde.
 */
let uebernahmeLaeuft: Promise<void> = Promise.resolve();
const lokalLaeuft = new Map<string, Promise<{ geheim: string; geraet: string }>>();

/** Das Paar dieses Kontos aus der Schlüsselkette — übernommen oder neu angelegt. */
function lokalesPaar(kontoId: string): Promise<{ geheim: string; geraet: string }> {
  const laufend = lokalLaeuft.get(kontoId);
  if (laufend) return laufend;

  const weg = (async () => {
    const f = faecher(kontoId);
    let geheim = await SecureStore.getItemAsync(f.geheim);
    let geraet = await SecureStore.getItemAsync(f.geraet);

    if (!geheim || !geraet) {
      const uebernahme = uebernahmeLaeuft.then(() => altbestandUebernehmen(kontoId));
      uebernahmeLaeuft = uebernahme.catch(() => {});
      await uebernahme;
      geheim = await SecureStore.getItemAsync(f.geheim);
      geraet = await SecureStore.getItemAsync(f.geraet);
    }

    if (!geheim) {
      const paar = Krypto.schluesselpaarErzeugen();
      geheim = paar.geheim as string;
      geraet = ExpoCrypto.randomUUID();
      await SecureStore.setItemAsync(f.geheim, geheim);
      await SecureStore.setItemAsync(f.geraet, geraet);
    } else if (!geraet) {
      geraet = ExpoCrypto.randomUUID();
      await SecureStore.setItemAsync(f.geraet, geraet);
    }
    return { geheim: geheim as string, geraet: geraet as string };
  })();

  lokalLaeuft.set(kontoId, weg);
  weg.then(
    () => lokalLaeuft.delete(kontoId),
    () => lokalLaeuft.delete(kontoId)
  );
  return weg;
}

export interface MeinSchluessel {
  /** Die Zeilen-Kennung in `krypto_schluessel` — an sie gehen die Kuverts. */
  id: string;
  /** Die Gerätekennung, unter der die Zeile wiedergefunden wird. */
  geraet: string;
  oeffentlich: string;
  geheim: string;
}

/**
 * Der Schlüssel dieses Geräts für dieses Konto — angelegt, wenn es ihn noch
 * nicht gibt.
 *
 * Der geheime Teil und die Gerätekennung gehören zusammen: ohne die Kennung
 * findet das Gerät seine Zeile in `krypto_schluessel` nicht wieder und legte
 * bei jedem Start eine neue an. Deshalb liegen beide nebeneinander und
 * werden nur gemeinsam erneuert — seit dem 16.10.2026 je Konto (AR-08).
 */
export async function meinSchluessel(
  client: SupabaseClient,
  ichId: string
): Promise<MeinSchluessel | null> {
  try {
    if (!ichId) throw new Error('Kein Konto');
    const { geheim, geraet } = await lokalesPaar(ichId);

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
     * Kein Wurf. Ohne Schlüssel wird nur dort im Klartext geschrieben, wo
     * Verschlüsselung gar nicht vorgesehen ist; wo sie es ist, lehnt
     * `fuerChatVerschliessen` das Senden ab (AR-05). Eine Chatliste, die
     * wegen der Verschlüsselung gar nicht mehr aufgeht, wäre der
     * schlechtere Zustand.
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

/** Der Fingerabdruck eines einzelnen Schlüssels. */
export function fingerabdruck(oeffentlich: string): string {
  return Krypto.fingerabdruck(oeffentlich);
}

/**
 * Die Sicherheitsnummer einer Person über ALLE ihre Geräte — im
 * Kontaktprofil sichtbar (AR-04, 16.10.2026). Gerechnet in
 * gemeinsam/krypto.js, damit die Website dieselbe Nummer zeigt.
 */
export function sicherheitsnummer(
  oeffentliche: string[]
): { nummer: string; geraete: number } | null {
  return Krypto.sicherheitsnummer(oeffentliche);
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
): Promise<{ id: string; oeffentlich: string; user_id: string }[]> {
  const { data: mitglieder, error: fehlerM } = await client
    .from('chat_members')
    .select('user_id')
    .eq('chat_id', chatId);
  if (fehlerM) throw fehlerM;

  const ids = (mitglieder ?? []).map((m: any) => m.user_id);
  if (!ids.length) return [];

  return schluesselHolen(client, ids);
}

/** Alle Geräte eines Kontos, auch jenseits der PostgREST-Zeilengrenze. */
export async function kontoSchluessel(client: SupabaseClient, kontoId: string): Promise<{ id: string; user_id: string; oeffentlich: string }[]> {
  return schluesselHolen(client, [kontoId]);
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
  try {
    const fakten = await sendefakten(client, chatId, ichId);
    return Krypto.sendeweg(fakten).art === 'verschliessen';
  } catch {
    return false;
  }
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
 * Der Fehler, mit dem das Senden abbricht, statt still im Klartext zu
 * schicken (AR-05, 16.10.2026).
 *
 * Eine eigene Klasse, damit die Bildschirme ihn von einer gewöhnlichen
 * Netzstörung unterscheiden und seine Meldung wörtlich zeigen — „Die
 * Nachricht ging nicht raus" wäre hier zu wenig: der Nutzer soll wissen,
 * dass es an der Verschlüsselung lag und dass NICHTS offen hinausging.
 */
export class VerschluesselnFehler extends Error {
  constructor(meldung: string = Krypto.MELDUNG_NICHT_VERSCHLUESSELT) {
    super(meldung);
    this.name = 'VerschluesselnFehler';
  }
}

/**
 * Chats, die dieses Gerät in dieser Sitzung schon verschlüsselt erlebt hat —
 * beim Öffnen einer verschlossenen Nachricht oder beim eigenen Senden.
 *
 * Das ist die zweite Sicherung neben der Abfrage nach `krypto > 0`: liefert
 * der Server später einmal eine leere Antwort (Störung, oder jemand will es
 * so), weiß das Gerät trotzdem, dass hier verschlüsselt geschrieben wird,
 * und lehnt ab statt offen zu senden. Nur im Speicher — nach einem Neustart
 * zählt wieder allein die Datenbank.
 */
const verschluesselteChats = new Set<string>();

/**
 * Einen Text für alle Geräte dieses Chats verschließen.
 *
 * Wirft bei jedem Fehler `VerschluesselnFehler` — der Aufrufer hat sich zu
 * diesem Zeitpunkt schon für „verschlüsseln" entschieden, und ein Rückfall
 * auf Klartext ist genau das, was nicht passieren darf.
 */
export function verschliessen(
  text: string,
  meiner: MeinSchluessel,
  empfaenger: { id: string; oeffentlich: string }[]
): Verschlossen {
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
    throw new VerschluesselnFehler();
  }
}

/**
 * Alles, was `Krypto.sendeweg` wissen muss — in so wenigen Rundläufen wie
 * möglich. Wirft, wenn eine Abfrage scheitert: ohne die Fakten lässt sich
 * nicht sagen, ob Klartext erlaubt wäre, und dann ist es keiner.
 */
async function sendefakten(client: SupabaseClient, chatId: string, ichId: string) {
  const { data: chat, error: fehlerC } = await client
    .from('chats')
    .select('is_group')
    .eq('id', chatId)
    .maybeSingle();
  if (fehlerC) throw fehlerC;
  if (!chat) throw new Error('Chat nicht ladbar');
  // Eine Gruppe braucht nichts weiter — dort ist Klartext die Regel.
  if ((chat as any)?.is_group) return { istGruppe: true };

  const [meiner, mitgliederUndSchluessel, verlauf] = await Promise.all([
    meinSchluessel(client, ichId),
    (async () => {
      const { data: mitglieder, error: fehlerM } = await client
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', chatId);
      if (fehlerM) throw fehlerM;
      const ids = (mitglieder ?? []).map((m: any) => m.user_id as string);
      if (!ids.length) return { ids, schluessel: [] };
      return { ids, schluessel: await schluesselHolen(client, ids) };
    })(),
    // Wurde hier schon einmal verschlüsselt geschrieben? Eine Zeile reicht.
    client.from('messages').select('id').eq('chat_id', chatId).gt('krypto', 0).limit(1),
  ]);
  if ((verlauf as any).error) throw (verlauf as any).error;

  return {
    istGruppe: false,
    mitglieder: mitgliederUndSchluessel.ids,
    ichId,
    schluessel: mitgliederUndSchluessel.schluessel,
    schonVerschluesselt: ((verlauf as any).data ?? []).length > 0,
    gemerkt: verschluesselteChats.has(chatId),
    meiner,
  };
}

/**
 * Der ganze Weg auf einmal: Fakten holen, entscheiden, Text verschließen.
 *
 * Es gibt diese Funktion, damit `nachrichtSenden` **einen** Aufruf hat und
 * nicht drei. Wo drei Schritte stehen, vergisst irgendwann jemand den
 * mittleren — und der mittlere ist hier die Prüfung, ob es überhaupt ein
 * Chat zu zweit ist. Vergisst man die, werden Gruppen halb verschlüsselt,
 * und ein später hinzugekommenes Mitglied sieht Kästen statt Nachrichten.
 *
 * Seit dem 16.10.2026 (AR-05) gibt es hier keinen stillen Rückfall mehr:
 * bis dahin wurde bei JEDEM Fehler `offen(text)` zurückgegeben. Jetzt
 * entscheidet `Krypto.sendeweg` — dieselbe Regel wie auf der Website —, und
 * wo verschlüsselt werden muss und nicht kann, wirft es
 * `VerschluesselnFehler`. Klartext bleibt nur, wo Verschlüsselung gar nicht
 * vorgesehen ist.
 */
export async function fuerChatVerschliessen(
  client: SupabaseClient,
  chatId: string,
  ichId: string,
  text: string
): Promise<Verschlossen> {
  let fakten: any;
  try {
    fakten = await sendefakten(client, chatId, ichId);
  } catch (fehler) {
    console.warn('Verschlüsselung nicht prüfbar:', (fehler as any)?.message ?? fehler);
    throw new VerschluesselnFehler();
  }

  /*
   * Ein Zweierchat mit drei Mitgliedern nimmt gar nichts an, auch keinen
   * Anhang (gemeinsam/krypto.js, zuVieleMitglieder). Die Website prüft
   * dasselbe in handleSendMessage.
   */
  if (Krypto.zuVieleMitglieder(fakten)) throw new VerschluesselnFehler(Krypto.MELDUNG_NUR_ZU_ZWEIT);

  // Ein Anhang ohne Text ist kein Fall für die Verschlüsselung: das Bild
  // liegt ohnehin offen im Speicher-Bucket, und ein leerer Text ergäbe
  // eine Chiffre, die nichts verbirgt.
  if (!text) return offen(text);

  const weg = Krypto.sendeweg(fakten);
  if (weg.art === 'offen') return offen(text);
  if (weg.art === 'ablehnen') throw new VerschluesselnFehler(weg.meldung);

  const paket = verschliessen(text, fakten.meiner as MeinSchluessel, weg.empfaenger);
  verschluesselteChats.add(chatId);
  return paket;
}

/**
 * Eine verschlüsselte Nachricht mit neuem Text verschließen — fürs
 * Bearbeiten (Kasten 27).
 *
 * Holt Chiffre-Kopf und MEIN Kuvert der Nachricht und verschließt nur den
 * Inhalt neu; alle Kuverts bleiben gültig (gemeinsam/krypto.js,
 * `umschliessen`). Gibt die zwei Spalten zurück, die sich ändern, oder null,
 * wenn dieses Gerät die Nachricht nicht öffnen kann — dann kann es sie auch
 * nicht bearbeiten. Gleicher Weg auf der Website (KryptoWeb.umschliessen).
 */
export async function fuerBearbeitenUmschliessen(
  client: SupabaseClient,
  ichId: string,
  nachrichtId: string,
  text: string
): Promise<{ chiffre: string; krypto_nonce: string } | null> {
  const meiner = await meinSchluessel(client, ichId);
  if (!meiner) return null;
  const [{ data: n }, { data: kuvert }] = await Promise.all([
    client
      .from('messages')
      .select('krypto, absender_schluessel')
      .eq('id', nachrichtId)
      .maybeSingle(),
    client
      .from('message_keys')
      .select('nonce, chiffre')
      .eq('message_id', nachrichtId)
      .eq('schluessel_id', meiner.id)
      .maybeSingle(),
  ]);
  if (!n || !kuvert) return null;
  const neu = Krypto.umschliessen(
    text,
    { version: (n as any).krypto, absender: (n as any).absender_schluessel },
    kuvert,
    meiner.geheim
  );
  return neu ? { chiffre: neu.chiffre, krypto_nonce: neu.nonce } : null;
}

/**
 * Der Beleg einer gemeldeten Nachricht (Kasten RS 3, Schema 102).
 *
 * Unverschlüsselt: `{ text }` — der Server hat den Text ohnehin.
 * Verschlüsselt: `{ text, sitzung }` — der Klartext und der
 * Sitzungsschlüssel NUR dieser Nachricht (gemeinsam/krypto.js,
 * `meldebeleg`). Der Gerätschlüssel verlässt das Gerät nicht; mit dem
 * Sitzungsschlüssel lässt sich keine andere Nachricht öffnen.
 *
 * null, wenn dieses Gerät die Nachricht nicht öffnen kann — dann gibt es
 * auch nichts Belegbares, und die Meldung geht ohne Klartext (der Moderator
 * sieht „ohne Schlüssel gemeldet"). Gleicher Weg auf der Website
 * (KryptoWeb.meldebeleg).
 */
export async function meldebelegHolen(
  client: SupabaseClient,
  ichId: string,
  nachrichtId: string,
  angezeigt: string
): Promise<{ text: string; sitzung?: string } | null> {
  const { data: n } = await client
    .from('messages')
    .select('krypto, chiffre, krypto_nonce, absender_schluessel')
    .eq('id', nachrichtId)
    .maybeSingle();
  if (!n) return null;
  if (!Number((n as any).krypto)) return { text: angezeigt ?? '' };
  const meiner = await meinSchluessel(client, ichId);
  if (!meiner) return null;
  const { data: kuvert } = await client
    .from('message_keys')
    .select('nonce, chiffre')
    .eq('message_id', nachrichtId)
    .eq('schluessel_id', meiner.id)
    .maybeSingle();
  if (!kuvert) return null;
  const beleg = Krypto.meldebeleg(
    {
      version: (n as any).krypto,
      chiffre: (n as any).chiffre,
      nonce: (n as any).krypto_nonce,
      absender: (n as any).absender_schluessel,
    },
    kuvert,
    meiner.geheim
  );
  return beleg ? { text: beleg.text, sitzung: beleg.sitzung } : null;
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
/*
 * Der Absender-Prüfer je Supabase-Client (AR-04, gemeinsam/krypto.js
 * `absenderPruefer`). Er merkt sich, welche Paare aus Konto und Schlüssel es
 * gibt, damit das Nachsehen alle vier Sekunden nicht jedes Mal fragt.
 */
const absenderPruefer = new WeakMap<SupabaseClient, { pruefen: (p: any[]) => Promise<(boolean | null)[]> }>();

function prueferFuer(client: SupabaseClient) {
  let p = absenderPruefer.get(client);
  if (!p) {
    p = Krypto.absenderPruefer(async (paare: { userId: string; schluessel: string }[]) => {
      return schluesselHolen(client,
        [...new Set(paare.map((x) => x.userId))],
        [...new Set(paare.map((x) => x.schluessel))]);
    }) as { pruefen: (p: any[]) => Promise<(boolean | null)[]> };
    absenderPruefer.set(client, p);
  }
  return p;
}

export async function aufschliessen(
  client: SupabaseClient,
  zeilen: any[],
  meiner: MeinSchluessel | null,
  optionen: { absenderPruefen?: boolean } = {}
): Promise<any[]> {
  const verschlossen = zeilen.filter((z) => Number(z?.krypto) > 0);
  if (!verschlossen.length) return zeilen;

  // Ab jetzt weiß dieses Gerät: in diesen Chats wird verschlüsselt
  // geschrieben (siehe verschluesselteChats). Bezugszeilen tragen keine
  // chat_id und zählen deshalb nicht mit.
  for (const z of verschlossen) if (z.chat_id) verschluesselteChats.add(z.chat_id);

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
    z._geoeffnet = klar !== null;
  }

  /*
   * Gehört der Absenderschlüssel zum Absender? (AR-04, 16.10.2026)
   *
   * Nur für geöffnete Nachrichten — eine, die nicht aufgeht, steht ohnehin
   * als „nicht lesbar" da. Ist eine Antwort `false`, kennzeichnet die Blase
   * sie als „nicht prüfbar" (`nichtPruefbar`). Sind die Schlüssel gerade
   * nicht ladbar (`null`), warnt die Blase ebenfalls; der Text bleibt lesbar.
   * Nur beim Chatverlauf, nicht bei der Vorschau der Chatliste: dort gibt es
   * keine Blase, und die Abfrage liefe für jeden Chat.
   */
  if (optionen.absenderPruefen) {
    const geoeffnet = verschlossen.filter((z) => z._geoeffnet && z.sender_id && z.absender_schluessel);
    if (geoeffnet.length) {
      const urteile = await prueferFuer(client).pruefen(
        geoeffnet.map((z) => ({ userId: z.sender_id, schluessel: z.absender_schluessel }))
      );
      geoeffnet.forEach((z, i) => {
        z.nichtPruefbar = urteile[i] !== true;
      });
    }
  }

  return zeilen;
}
