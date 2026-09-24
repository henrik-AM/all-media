/**
 * All Media — was die App in die Datenbank schreibt.
 *
 * WARUM ES DAS GIBT
 *
 * `lib/daten.ts` holt Inhalte; hier stehen die Gegenstücke, die etwas
 * verändern. Bis zum 01.09.2026 gab es die in der App gar nicht: Like,
 * Speichern, Folgen, Repost und der Beitragshinweis änderten nur den Zustand
 * im Bildschirm. Das Herz wurde rot, die Zahl ging hoch — und beim nächsten
 * Start der App war alles wieder wie vorher. Auf der Website erschien es nie.
 *
 * Nach außen sah das aus wie ein Fehler in der Datenbank. Es war keiner. Es
 * wurde schlicht nie etwas hingeschickt.
 *
 * Die Website macht dasselbe in web/server/sync-handlers.js. Beide schreiben
 * in dieselben Tabellen mit denselben Spalten; wer hier etwas ändert, muss
 * dort nachsehen, sonst laufen die beiden Fassungen wieder auseinander.
 *
 * WIE ES SICH ANFÜHLT
 *
 * Die Bildschirme schalten sofort um und rufen das hier nebenbei auf. Geht
 * es schief, wird zurückgeschaltet und der Grund gemeldet — nicht still
 * geschluckt. Ein Herz, das rot bleibt, obwohl nichts gespeichert wurde,
 * ist schlimmer als eines, das wieder grau wird.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { signiereMedien } from './medien';
import type { Impression } from './impressionen';
import {
  aufschliessen,
  fuerChatVerschliessen,
  meinSchluessel,
  NICHT_LESBAR,
  offen,
} from './krypto';

// Dieselbe Regel wie auf der Website — siehe gemeinsam/telefon.js.
const Telefon = require('../../gemeinsam/telefon') as typeof import('../../gemeinsam/telefon');

// Wie ein eigener Kommentar in der Liste steht — gemeinsam mit der Website.
const Kommentar = require('../../gemeinsam/kommentar') as typeof import('../../gemeinsam/kommentar');

/**
 * Eine Zeile, die es entweder gibt oder nicht — Like, Speichern, Folgen.
 *
 * Gibt zurück, ob sie danach da ist. Gleiches Vorgehen wie umschalten() in
 * web/server/sync-handlers.js, damit beide Seiten sich gleich verhalten.
 */
async function umschalten(
  client: SupabaseClient,
  tabelle: string,
  schluessel: Record<string, string>
): Promise<boolean> {
  let abfrage = client.from(tabelle).select('*', { count: 'exact', head: true });
  for (const [spalte, wert] of Object.entries(schluessel)) abfrage = abfrage.eq(spalte, wert);

  const { count, error: fehlerLesen } = await abfrage;
  if (fehlerLesen) throw fehlerLesen;

  if ((count ?? 0) > 0) {
    /*
     * `count: 'exact'` ist hier keine Zierde.
     *
     * Verbietet eine Regel der Datenbank das Loeschen, kommt kein Fehler
     * zurueck — PostgREST loescht null Zeilen und meldet Erfolg. Ohne diese
     * Zahl gaebe `umschalten` dann `false` zurueck, das Herz wuerde grau, und
     * das Like bliebe stehen. Beim naechsten Laden waere es wieder rot, ohne
     * dass irgendwo ein Fehler stuende.
     */
    let loeschen = client.from(tabelle).delete({ count: 'exact' });
    for (const [spalte, wert] of Object.entries(schluessel)) loeschen = loeschen.eq(spalte, wert);
    const { error, count: geloescht } = await loeschen;
    if (error) throw error;
    if ((geloescht ?? 0) === 0) throw new Error(`Zeile in ${tabelle} liess sich nicht entfernen`);
    return false;
  }

  const { error } = await client.from(tabelle).insert(schluessel);
  // 23505 = die Zeile gab es schon (zweimal schnell getippt). Kein Fehlerfall.
  if (error && error.code !== '23505') throw error;
  return true;
}

/** Herz an oder aus. Gibt zurück, ob der Beitrag danach geliked ist. */
export function like(client: SupabaseClient, ichId: string, beitragId: string) {
  return umschalten(client, 'post_likes', { post_id: beitragId, user_id: ichId });
}

/** Lesezeichen an oder aus. */
export function speichern(client: SupabaseClient, ichId: string, beitragId: string) {
  return umschalten(client, 'saves', { post_id: beitragId, user_id: ichId });
}

/** Repost an oder aus. */
export function repost(client: SupabaseClient, ichId: string, beitragId: string) {
  return umschalten(client, 'reposts', { post_id: beitragId, user_id: ichId });
}

/** „Sag mir Bescheid, wenn diese Person etwas Neues postet." */
export function beitragshinweis(client: SupabaseClient, ichId: string, beitragId: string) {
  return umschalten(client, 'post_notify', { post_id: beitragId, user_id: ichId });
}

/** Einer Person folgen oder nicht mehr folgen. */
export async function folgen(client: SupabaseClient, ichId: string, zielId: string) {
  // Sich selbst zu folgen wäre eine Zeile, die niemand je sehen will — und
  // die Datenbank ließe sie durch.
  if (zielId === ichId) throw new Error('Sich selbst folgen geht nicht');
  return umschalten(client, 'follows', { follower_id: ichId, followee_id: zielId });
}

/**
 * Einer Community beitreten oder sie verlassen.
 *
 * Auch das lief in der App bis zum 01.09.2026 nur in der Anzeige: der Knopf
 * sagte „Gefolgt", die Community stand aber weder unter „Meine" noch sah
 * die Website davon etwas.
 */
export function communityBeitritt(client: SupabaseClient, ichId: string, communityId: string) {
  return umschalten(client, 'community_members', {
    community_id: communityId,
    user_id: ichId,
  });
}

/**
 * Eine Community stummschalten oder wieder hoerbar machen.
 *
 * Kein umschalten(): stumm ist keine Zeile, die es gibt oder nicht, sondern
 * eine Spalte der Mitgliedschaft. Wer nicht Mitglied ist, kann auch nichts
 * stummschalten — dann trifft das UPDATE keine Zeile, und das ist der
 * richtige Ausgang, kein Fehler. Zurueck kommt der Zustand danach.
 *
 * Der Einstellungspunkt „Gestummte Communitys" stand in App und Website,
 * seit es die Einstellungen gibt. Gespeichert wurde bis zum 02.09.2026
 * nichts; die App zeigte dort schlicht alle privaten Communitys.
 */
export async function communityStumm(
  client: SupabaseClient,
  ichId: string,
  communityId: string
): Promise<boolean> {
  const { data: zeile, error: fehlerLesen } = await client
    .from('community_members')
    .select('is_muted')
    .eq('community_id', communityId)
    .eq('user_id', ichId)
    .maybeSingle();
  if (fehlerLesen) throw fehlerLesen;
  if (!zeile) throw new Error('Du bist in dieser Community nicht Mitglied.');

  const neu = !zeile.is_muted;
  const { error } = await client
    .from('community_members')
    .update({ is_muted: neu })
    .eq('community_id', communityId)
    .eq('user_id', ichId);
  if (error) throw error;
  return neu;
}

/**
 * Jemanden blockieren oder die Blockierung aufheben.
 *
 * Das hier war der schwerste Fall der alten Bauweise: eine Blockierung, die
 * nur im Arbeitsspeicher der App stand, war nach dem naechsten Start wieder
 * weg — ohne dass es jemand merkte.
 */
export function blockieren(client: SupabaseClient, ichId: string, zielId: string) {
  if (zielId === ichId) throw new Error('Sich selbst blockieren geht nicht');
  return umschalten(client, 'blocks', { user_id: ichId, blocked_user_id: zielId });
}

/** Jemanden stummschalten oder wieder hoerbar machen. */
export function stummschalten(client: SupabaseClient, ichId: string, zielId: string) {
  if (zielId === ichId) throw new Error('Sich selbst stummschalten geht nicht');
  return umschalten(client, 'mutes', { user_id: ichId, muted_user_id: zielId });
}

/**
 * Etwas melden.
 *
 * Kein Umschalten: eine Meldung nimmt man nicht zurueck, indem man noch
 * einmal darauf tippt. `art` muss zu den Werten passen, die die Datenbank
 * zulaesst (SUPABASE_SCHEMA_2.sql, Spalte target_type).
 */
export async function melden(
  client: SupabaseClient,
  ichId: string,
  zielId: string,
  grund: string,
  art: 'post' | 'comment' | 'story' | 'user' | 'message' = 'post'
) {
  const { error } = await client
    .from('reports')
    .insert({ reported_by: ichId, target_type: art, target_id: zielId, reason: grund || '' });
  if (error) throw error;
  return true;
}

/** Eine Mitteilung als gelesen vermerken. */
export async function mitteilungGelesen(client: SupabaseClient, ichId: string, id: string) {
  const { error } = await client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', ichId);
  if (error) throw error;
  return true;
}

/**
 * Alle Mitteilungen eines Bereichs als gelesen vermerken.
 *
 * Ohne `bereich` gilt es für alle. Nur ungelesene werden angefasst, damit
 * der Zeitpunkt einer schon gelesenen Mitteilung nicht neu gesetzt wird.
 */
export async function alleMitteilungenGelesen(
  client: SupabaseClient,
  ichId: string,
  bereich?: string
) {
  let abfrage = client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', ichId)
    .is('read_at', null);
  if (bereich) abfrage = abfrage.eq('bereich', bereich);

  const { error } = await abfrage;
  if (error) throw error;
  return true;
}

/** Eine Nachricht mit einem Stern versehen — oder den Stern wieder wegnehmen. */
export function nachrichtMarkieren(client: SupabaseClient, ichId: string, nachrichtId: string) {
  return umschalten(client, 'message_stars', { message_id: nachrichtId, user_id: ichId });
}

/**
 * Einen Kontakt umbenennen und mit einer Notiz versehen.
 *
 * Henrik, 07.09.2026: "Kontaktinfo-Änderungen (z.B. Name) speichern/
 * synchronisieren nicht." Das Blatt "Kontakt bearbeiten" schrieb bis heute
 * nirgendwohin — der neue Name lag in einem Zustand im Bildschirm und war
 * beim naechsten Oeffnen weg, die Notiz wurde gar nicht erst gelesen.
 *
 * Geschrieben wird an `contacts`, nicht an `profiles`: wie jemand heisst,
 * entscheidet die Person selbst; wie ich sie in meiner Liste nenne, ich
 * (Schema 33). Ein leeres Feld nimmt den Spitznamen wieder zurueck — sonst
 * gaebe es keinen Weg zurueck zum echten Namen.
 */
export async function kontaktBearbeiten(
  client: SupabaseClient,
  ichId: string,
  zielId: string,
  werte: { spitzname?: string; notiz?: string }
) {
  const felder: { spitzname?: string | null; notiz?: string | null } = {};
  if (werte.spitzname !== undefined) felder.spitzname = werte.spitzname.trim() || null;
  if (werte.notiz !== undefined) felder.notiz = werte.notiz.trim() || null;

  const { data, error } = await client
    .from('contacts')
    .update(felder)
    .eq('user_id', ichId)
    .eq('contact_id', zielId)
    .select('contact_id');
  if (error) throw error;
  /*
   * Gegengeprueft, nicht geglaubt: unter den Zeilenregeln liefert ein
   * abgelehntes UPDATE null Zeilen und keinen Fehler. Ohne diese Pruefung
   * meldete die Oberflaeche wieder "gespeichert", und wieder waere nichts
   * gespeichert — genau der Fehler, den dieser Punkt behebt.
   */
  if (!data || data.length === 0) {
    throw new Error('Diese Person steht nicht in deinen Kontakten');
  }
  return true;
}

/**
 * Einen Kontakt zum Liebling machen oder nicht mehr.
 *
 * Anders als die übrigen: es gibt keine eigene Tabelle, sondern eine Spalte
 * an `contacts`. Steht die Person nicht in den Kontakten, gibt es nichts
 * umzuschalten — das sagt die Funktion dann auch, statt still nichts zu tun.
 */
export async function kontaktFavorit(client: SupabaseClient, ichId: string, zielId: string) {
  const { data, error } = await client
    .from('contacts')
    .select('is_favorite')
    .eq('user_id', ichId)
    .eq('contact_id', zielId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Diese Person steht nicht in deinen Kontakten');

  const danach = !data.is_favorite;
  const { error: fehler } = await client
    .from('contacts')
    .update({ is_favorite: danach })
    .eq('user_id', ichId)
    .eq('contact_id', zielId);
  if (fehler) throw fehler;
  return danach;
}

/**
 * Vermerken, dass ich diese Story gesehen habe — das macht den Ring grau.
 *
 * Kein normales insert: hat man dieselbe Story schon einmal gesehen, gibt es
 * die Zeile bereits. `ignoreDuplicates` laesst sie dann in Ruhe. Ein upsert
 * ohne das wuerde daraus ein UPDATE machen, und dafuer hat story_views gar
 * keine Regel — die Datenbank weist es ab (siehe web/server/sync-handlers.js,
 * handleViewStory).
 */
export async function storyGesehen(client: SupabaseClient, ichId: string, storyId: string) {
  const { error } = await client
    .from('story_views')
    .upsert(
      { story_id: storyId, user_id: ichId },
      { onConflict: 'story_id,user_id', ignoreDuplicates: true }
    );
  if (error) throw error;
  return true;
}

/**
 * Gesehene Beitraege vermerken — die Grundlage des spaeteren Feed-Rankings.
 *
 * Gebuendelt, nicht einzeln: wer zwei Minuten scrollt, hat zwanzig
 * Sichtungen gesammelt, und zwanzig Rundreisen ueber das Mobilfunknetz sind
 * zwanzig Gelegenheiten zu scheitern. Gemessen wird in
 * `lib/impressionen.ts`, geschrieben wird hier.
 *
 * Der Betrachter kommt aus `auth.uid()` in der Datenbank und wird bewusst
 * nicht mitgeschickt — die Lehre aus Fund 11 der Sicherheitspruefung.
 * Andernfalls koennte sich jeder Sichtungen unter fremdem Namen ausdenken
 * und damit spaeter das Ranking faerben.
 *
 * Die Website macht dasselbe in `web/server/sync-handlers.js`.
 */
export async function impressionenVermerken(
  client: SupabaseClient,
  eintraege: Impression[]
): Promise<number> {
  if (eintraege.length === 0) return 0;
  const { data, error } = await client.rpc('impressionen_vermerken', { eintraege });
  if (error) throw error;
  return Number(data ?? 0);
}

export interface NeuerBeitrag {
  /** 'post' = Bild, 'reel' = Hochformat, 'clip' = Querformat. */
  art?: 'post' | 'reel' | 'clip';
  titel?: string;
  beschreibung?: string;
  ort?: string;
  musik?: string;
  mediaUrl?: string;
  thumbnail?: string;
  dauer?: string;
  /**
   * "Spaeter posten": Zeitpunkt, ab dem der Beitrag sichtbar ist.
   * Leer heisst sofort. Steht in posts.publish_at.
   */
  geplantAb?: string | null;
}

/**
 * Einen eigenen Beitrag anlegen.
 *
 * Gibt die Kennung zurueck, die die Datenbank vergeben hat. Die App hat sich
 * ihre Kennungen vorher selbst ausgedacht („p_1756…") — brauchbar fuer die
 * Anzeige, aber unter dieser Kennung liess sich der Beitrag danach weder
 * liken noch kommentieren noch loeschen, weil es ihn nirgends gab.
 *
 * Dasselbe tut die Website in handleCreatePost.
 */
export async function beitragAnlegen(
  client: SupabaseClient,
  ichId: string,
  felder: NeuerBeitrag = {}
): Promise<string> {
  const { data, error } = await client
    .from('posts')
    .insert({
      user_id: ichId,
      kind: felder.art || 'post',
      title: felder.titel || '',
      description: felder.beschreibung || '',
      location: felder.ort || '',
      music: felder.musik || '',
      media_url: felder.mediaUrl || null,
      thumbnail_url: felder.thumbnail || null,
      duration: felder.dauer || null,
      publish_at: felder.geplantAb || null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Einen eigenen Beitrag wieder loeschen. Fremde ruehrt die Datenbank nicht an. */
export async function beitragLoeschen(client: SupabaseClient, ichId: string, id: string) {
  const { error } = await client.from('posts').delete().eq('id', id).eq('user_id', ichId);
  if (error) throw error;
  return true;
}

/**
 * Das eigene Profil ändern — Name, Info, Link.
 *
 * Es werden nur Felder durchgereicht, die es wirklich gibt; die Regeln der
 * Datenbank lassen ohnehin nur die eigene Zeile zu. Dieselbe Liste wie in
 * web/server/sync-handlers.js, handleUpdateProfile.
 */
export async function profilAendern(
  client: SupabaseClient,
  ichId: string,
  aenderungen: Record<string, unknown>
) {
  const erlaubt = ['name', 'handle', 'bio', 'link', 'status', 'initials', 'color', 'phone', 'privat'];
  const felder: Record<string, unknown> = {};
  for (const feld of erlaubt) {
    if (aenderungen[feld] !== undefined) felder[feld] = aenderungen[feld];
  }
  if (Object.keys(felder).length === 0) throw new Error('Nichts zu ändern');

  felder.updated_at = new Date().toISOString();

  const { error } = await client.from('profiles').update(felder).eq('id', ichId);
  if (error) throw error;
  return true;
}

/**
 * Eine Person ueber ihre Telefonnummer suchen.
 *
 * Henrik am 07.09.2026: „Kontakt hinzufügen nur über Telefonnummer/QR-Code,
 * nicht Username."
 *
 * WARUM DIE DATENBANK UND NICHT DIE GELADENE LISTE
 *
 * `AddContactSheet` suchte bis dahin in `useDaten().users`. Dort steht die
 * Nummer aber nur von Leuten, mit denen man schon beidseitig Kontakt ist
 * (Sicherheitspruefung 04.09.2026, Fund 1 — `meine_kontaktnummern()`). Wer
 * jemand Neues ueber die Nummer suchte, bekam also „Zu dieser Nummer gibt es
 * noch kein Konto", obwohl es das Konto gab. Genau der Weg, den Henrik als
 * einzigen behalten will, war der einzige, der nicht funktionierte.
 *
 * `finde_per_nummer` (Schema 24) rechnet dieselbe Vergleichsform wie
 * gemeinsam/telefon.js und gibt nur die eine passende Zeile heraus — wer die
 * Nummer kennt, findet die Person, wer sie nicht kennt, bekommt nichts. Die
 * Website nimmt denselben Weg (`handleFindPerson` in
 * web/server/sync-handlers.js).
 */
export async function personPerNummer(
  client: SupabaseClient,
  nummer: string
): Promise<{ id: string; name: string; handle: string; privat: boolean; about?: string } | null> {
  const grund = Telefon.pruefe(nummer);
  if (grund) throw new Error(grund);

  const { data, error } = await client.rpc('finde_per_nummer', {
    nummer: Telefon.speicherform(nummer),
  });
  if (error) throw error;
  if (!data) return null;

  const p = data as any;
  return {
    id: p.id,
    name: p.name,
    handle: p.handle,
    privat: Boolean(p.privat),
    about: p.about ?? '',
  };
}

/**
 * Die eigene Telefonnummer ändern.
 *
 * Bis zum 07.09.2026 stand hinter „Telefonnummer ändern" ein Formular, das
 * „Wir haben dir einen Bestätigungscode geschickt" meldete und nichts tat.
 * Beides war falsch: es ging kein Code raus, und die Nummer wurde nirgends
 * gespeichert — obwohl `profiles.phone` seit SUPABASE_SCHEMA_2.sql da ist und
 * die Kontaktinfo im Profil daraus liest.
 *
 * Ein Bestätigungscode bleibt aus, solange kein SMS-Versand eingerichtet ist.
 * Die Nummer wird deshalb gespeichert und die Meldung sagt genau das.
 *
 * DIE DOPPLUNGSPRÜFUNG
 *
 * `profiles_phone_einmalig` aus SUPABASE_SCHEMA_11_handbuch.sql lässt
 * dieselbe Nummer nur einmal zu — aber nur zeichengleich. „0151 2345678" und
 * „+49 151 2345678" sind für den Index zwei verschiedene Werte. Gefragt wird
 * deshalb vorher `finde_per_nummer`: dieselbe Funktion, mit der die App auch
 * Personen über ihre Nummer sucht, und sie vergleicht auf reine Ziffern.
 *
 * Der Index bleibt trotzdem der letzte Riegel — zwischen Frage und Schreiben
 * kann sich etwas ändern. Postgres meldet ihn als 23505; ohne Übersetzung
 * stünde dort „duplicate key value violates unique constraint".
 */
export async function telefonAendern(
  client: SupabaseClient,
  ichId: string,
  nummer: string
): Promise<string> {
  const grund = Telefon.pruefe(nummer);
  if (grund) throw new Error(grund);

  const sauber = Telefon.speicherform(nummer);

  /*
   * Der Fehlerwert wird hier ausgewertet und nicht weggeworfen.
   *
   * Seit Schema 38 hat `finde_per_nummer` eine Bremse (40 Nachschlaege je
   * Stunde). Loest sie aus, kommt ein Fehler statt einer Person — und mit dem
   * alten `const { data: schonDa } = …` waere `schonDa` dann null gewesen und
   * die Dopplungspruefung stillschweigend uebersprungen. Die Bremse haette
   * also ausgerechnet das Loch aufgemacht, das der Index darunter zuhaelt.
   */
  const { data: schonDa, error: pruefFehler } = await client.rpc('finde_per_nummer', {
    nummer: sauber,
  });
  if (pruefFehler) throw pruefFehler;
  if (schonDa) throw new Error('Diese Nummer gehört schon zu einem anderen Konto');

  const { error } = await client
    .from('profiles')
    .update({ phone: sauber, updated_at: new Date().toISOString() })
    .eq('id', ichId);

  if (error) {
    if (error.code === '23505') throw new Error('Diese Nummer gehört schon zu einem anderen Konto');
    throw error;
  }
  return sauber;
}

/**
 * Eine eigene Community anlegen — und sich selbst als erstes Mitglied
 * eintragen.
 *
 * Gibt die Kennung aus der Datenbank zurueck. Ohne die Mitgliedschaft stuende
 * sie unter „Erstellt", aber nicht unter „Meine"; scheitert sie, wird die
 * halb angelegte Community wieder weggeraeumt.
 */
export async function communityAnlegen(
  client: SupabaseClient,
  ichId: string,
  name: string,
  thema = '',
  privat = false
): Promise<string> {
  const { data, error } = await client
    .from('communities')
    .insert({
      name,
      topic: thema,
      visibility: privat ? 'private' : 'public',
      created_by: ichId,
    })
    .select('id')
    .single();
  if (error) throw error;

  const { error: fehlerMitglied } = await client
    .from('community_members')
    .insert({ community_id: data.id, user_id: ichId });
  if (fehlerMitglied) {
    await client.from('communities').delete().eq('id', data.id);
    throw fehlerMitglied;
  }

  return data.id as string;
}

/** Ein Kommentar-Herz. */
export function kommentarLike(client: SupabaseClient, ichId: string, kommentarId: string) {
  return umschalten(client, 'comment_likes', { comment_id: kommentarId, user_id: ichId });
}

/**
 * Einen Beitrag an Personen schicken — als Nachricht in ihren Chat, und als
 * gezählte Weiterleitung.
 *
 * Zwei Dinge, die zusammengehören: die Website macht in handleShareToChats
 * genau dasselbe. Fehlte hier der Eintrag in `shares`, stünde unter dem
 * Beitrag weiter dieselbe Zahl.
 */
export async function teilen(
  client: SupabaseClient,
  ichId: string,
  beitragId: string,
  empfaenger: string[],
  vorschau = 'Beitrag geteilt',
  bereich = 'messenger'
): Promise<string[]> {
  if (empfaenger.length === 0) throw new Error('Bitte mindestens eine Person auswählen');

  const gesendet: string[] = [];
  for (const zielId of empfaenger) {
    /*
     * `bereich` entscheidet, in welcher der beiden Chatlisten die Nachricht
     * landet — Messenger oder Communitys. Hier stand bis zum 17.09.2026 ein
     * Aufruf ohne diesen Wert, und `chatMit` nahm dann seinen Standard
     * 'messenger'. Zusammen mit den drei anderen Aufrufern hiess das: **kein**
     * Codepfad hat je einen Chat mit bereich='community' erzeugt. Die
     * Community-Chatliste konnte sich durch Benutzung nie fuellen; was dort
     * stand, kam aus dem Testbestand (vorlage_chats).
     *
     * Gleiche Regel in web/server/sync-handlers.js (handleShareToChats).
     */
    const chatId = await chatMit(client, ichId, zielId, bereich);
    const { error } = await client
      .from('messages')
      .insert({ chat_id: chatId, sender_id: ichId, text: vorschau, shared_post_id: beitragId });
    if (error) throw error;
    gesendet.push(zielId);
  }

  const { error } = await client
    .from('shares')
    .insert(gesendet.map((id) => ({ post_id: beitragId, shared_by: ichId, shared_to: id })));
  if (error) throw error;

  return gesendet;
}

/**
 * Der Zweierchat mit dieser Person — der vorhandene, sonst ein neuer.
 *
 * Ohne die Suche nach dem vorhandenen entstünde bei jedem Teilen ein neuer
 * Chat, und der Verlauf zerfiele in lauter Einzelstücke.
 */
export async function chatMit(
  client: SupabaseClient,
  ichId: string,
  zielId: string,
  bereich = 'messenger'
): Promise<string> {
  const { data: meine, error } = await client
    .from('chat_members')
    .select('chat_id, chats(id, is_group, bereich)')
    .eq('user_id', ichId);
  if (error) throw error;

  const zweier = (meine ?? []).filter((m: any) => {
    const c = Array.isArray(m.chats) ? m.chats[0] : m.chats;
    return c && !c.is_group && (c.bereich || 'messenger') === bereich;
  });

  if (zweier.length > 0) {
    const { data: andere } = await client
      .from('chat_members')
      .select('chat_id, user_id')
      .in('chat_id', zweier.map((z: any) => z.chat_id))
      .eq('user_id', zielId);
    if (andere && andere.length > 0) return andere[0].chat_id;
  }

  /*
   * Vor dem Anlegen fragen, nicht danach.
   *
   * Die Regel aus Schema 22 wuerde das Eintragen des zweiten Mitglieds
   * ohnehin abweisen — aber erst, nachdem die Chatzeile schon steht. Uebrig
   * bliebe ein Chat ohne Gegenueber und eine Fehlermeldung aus der Datenbank.
   * Die Frage vorweg kostet einen Aufruf und spart beides.
   */
  if (!(await darfAngeschriebenWerden(client, zielId, ichId))) {
    throw new Error('Diese Person empfängt keine Nachrichten.');
  }

  const { data: person } = await client
    .from('profiles')
    .select('name')
    .eq('id', zielId)
    .maybeSingle();

  const { data: neu, error: fehlerNeu } = await client
    .from('chats')
    .insert({ name: person?.name || 'Chat', is_group: false, bereich, created_by: ichId })
    .select()
    .single();
  if (fehlerNeu) throw fehlerNeu;

  // Ein Chat ohne Mitglieder taucht in keiner Liste auf, nimmt aber jede
  // Nachricht an — die dann nie jemand sieht. Lieber wieder wegräumen.
  const { error: fehlerMitglieder } = await client.from('chat_members').insert([
    { chat_id: neu.id, user_id: ichId },
    { chat_id: neu.id, user_id: zielId },
  ]);
  if (fehlerMitglieder) {
    await client.from('chats').delete().eq('id', neu.id);
    throw fehlerMitglieder;
  }

  return neu.id;
}

/* ======================================================================== *
 *  Der zweite Teil: was am 01.09.2026 noch fehlte
 *
 *  Oben stehen die Aktionen rund um Beiträge und Profile — die wurden zuerst
 *  nachgezogen, weil sie am sichtbarsten waren. Alles rund um Chats,
 *  Kontakte, Storys, Kommentare und Communitys blieb dabei liegen: die
 *  Website konnte es (web/server/sync-handlers.js), die App zeigte es nur an.
 *
 *  Ein archivierter Chat war nach dem Neustart wieder in der Liste, eine
 *  angelegte Gruppe war weg, eine Story-Antwort kam bei niemandem an. Auf der
 *  Website war von alldem nie etwas zu sehen — die beiden Fassungen zeigten
 *  denselben Lesestand und liefen beim Schreiben auseinander.
 *
 *  Jede Funktion hier hat ihr Gegenstück in sync-handlers.js und schreibt in
 *  dieselbe Tabelle mit denselben Spalten. Wer eine ändert, ändert beide.
 * ======================================================================== */

// ---------------------------------------------------------------- Chats --

/**
 * Was sich an einem Chat einstellen lässt — und wie die Spalte dazu heißt.
 *
 * Die Einstellung hängt an chat_members, also am einzelnen Mitglied. Sonst
 * würde Annas Archivieren auch Bobs Liste verändern. Dieselbe Zuordnung wie
 * in handleChatAction.
 */
const CHAT_SPALTEN: Record<string, string> = {
  archiv: 'is_archived',
  stumm: 'is_muted',
  gelesen: 'is_read',
  favorit: 'is_favorite',
  sperren: 'is_locked',
  mitteilungen: 'notifications_off',
};

export type ChatEinstellung = keyof typeof CHAT_SPALTEN;

/**
 * Eine Einstellung am Chat setzen — oder umschalten, wenn kein Wert kommt.
 *
 * Ohne ausdrücklichen Wert wird umgeschaltet: die Oberfläche weiß den alten
 * Zustand nicht sicher, wenn App und Website gleichzeitig offen sind. Gibt
 * zurück, wie die Einstellung danach steht.
 */
export async function chatEinstellung(
  client: SupabaseClient,
  ichId: string,
  chatId: string,
  was: ChatEinstellung,
  wert?: boolean
): Promise<boolean> {
  const spalte = CHAT_SPALTEN[was];
  if (!spalte) throw new Error(`Unbekannte Einstellung: ${was}`);

  let neu = wert;
  if (neu === undefined || neu === null) {
    const { data, error } = await client
      .from('chat_members')
      .select(spalte)
      .eq('chat_id', chatId)
      .eq('user_id', ichId)
      .maybeSingle();
    if (error) throw error;
    neu = !(data as Record<string, unknown> | null)?.[spalte];
  }

  const felder: Record<string, unknown> = { [spalte]: neu };
  // „Gelesen" ist nicht nur ein Häkchen: der Zeitpunkt entscheidet, welche
  // Nachrichten danach noch als ungelesen zählen.
  if (spalte === 'is_read' && neu) felder.last_read_at = new Date().toISOString();

  const { error } = await client
    .from('chat_members')
    .update(felder)
    .eq('chat_id', chatId)
    .eq('user_id', ichId);
  if (error) throw error;

  return neu;
}

/**
 * Einen Chat verlassen.
 *
 * Gelöscht wird die eigene Mitgliedschaft, nicht der Chat: er gehört auch der
 * anderen Person. Bleibt niemand übrig, kommt er weg.
 */
export async function chatVerlassen(client: SupabaseClient, ichId: string, chatId: string) {
  const { error } = await client
    .from('chat_members')
    .delete()
    .eq('chat_id', chatId)
    .eq('user_id', ichId);
  if (error) throw error;

  const { count } = await client
    .from('chat_members')
    .select('*', { count: 'exact', head: true })
    .eq('chat_id', chatId);

  /*
   * Nachsehen, ob wirklich etwas weg ist.
   *
   * Ein DELETE, das die Regeln der Datenbank nicht zulassen, wird nicht
   * abgewiesen: es loescht null Zeilen und meldet Erfolg. Fuer chat_members
   * gab es bis zum 01.09.2026 gar keine Regel zum Loeschen — die App meldete
   * "Chat geloescht", und beim naechsten Laden stand er wieder da. Behoben
   * in SUPABASE_SCHEMA_9_loeschen.sql; die Kontrolle bleibt, damit derselbe
   * stille Fehlschlag nicht ein zweites Mal unbemerkt bleibt.
   */
  const { count: meine } = await client
    .from('chat_members')
    .select('*', { count: 'exact', head: true })
    .eq('chat_id', chatId)
    .eq('user_id', ichId);
  if ((meine ?? 0) > 0) {
    throw new Error('Der Chat liess sich nicht verlassen — die Datenbank hat es abgelehnt');
  }

  if (!count) await client.from('chats').delete().eq('id', chatId);

  return true;
}

/**
 * Chat leeren: die Unterhaltung bleibt, der Verlauf ist für mich weg.
 *
 * Die eigenen Nachrichten werden wirklich gelöscht — sie gehören mir. Für
 * alles andere wird ein Strich gezogen (`geleert_bis`); fremde Zeilen zu
 * löschen steht niemandem zu, und die Datenbank lässt es auch nicht zu.
 * In der App stand das Leeren bis hierher nur im Arbeitsspeicher.
 */
export async function chatLeeren(client: SupabaseClient, ichId: string, chatId: string) {
  const { error } = await client
    .from('messages')
    .delete()
    .eq('chat_id', chatId)
    .eq('sender_id', ichId);
  if (error) throw error;

  const { error: fehlerStrich } = await client
    .from('chat_members')
    .update({ geleert_bis: new Date().toISOString() })
    .eq('chat_id', chatId)
    .eq('user_id', ichId);
  if (fehlerStrich) throw fehlerStrich;

  return true;
}

/**
 * Eine Gruppe anlegen und alle Mitglieder eintragen.
 *
 * Gibt die Kennung aus der Datenbank zurueck. Die App hat sich ihre bisher
 * selbst ausgedacht („c1756…") — unter der liess sich danach nichts in die
 * Gruppe schreiben, weil es sie nirgends gab.
 */
export async function gruppeAnlegen(
  client: SupabaseClient,
  ichId: string,
  name: string,
  mitglieder: string[] = [],
  bereich = 'messenger'
): Promise<string> {
  const { data, error } = await client
    .from('chats')
    .insert({ name, is_group: true, bereich, created_by: ichId })
    .select('id')
    .single();
  if (error) throw error;

  const alle = [...new Set([ichId, ...mitglieder])];
  const { error: fehlerM } = await client
    .from('chat_members')
    .insert(alle.map((id) => ({ chat_id: data.id, user_id: id })));
  if (fehlerM) {
    // Eine Gruppe ohne Mitglieder steht in keiner Liste und nimmt trotzdem
    // Nachrichten an. Lieber wieder wegräumen.
    await client.from('chats').delete().eq('id', data.id);
    throw fehlerM;
  }

  return data.id as string;
}

/** Was an einer Nachricht hängen kann — Bild, Ton, Standort, Kontakt. */
export interface Anhang {
  url?: string | null;
  typ?: string | null;
  standortId?: string | null;
  kontaktId?: string | null;
  /** Bezug: eine Antwort zeigt ihn an, ein Zitat nimmt den Text mit. */
  antwortAuf?: string | null;
  zitatVon?: string | null;
  /** Bei einer Datei: ohne Name und Groesse steht dort ein graues Kaestchen. */
  dateiName?: string | null;
  dateiGroesse?: number | null;
  /**
   * Die Story, auf die sich diese Nachricht bezieht — eine Antwort darauf
   * oder ein Herz. Der Chat zeigt dann die Vorschau der Story an der Blase
   * statt eines Satzes ohne Bezug. Siehe
   * SUPABASE_SCHEMA_41_story_im_chat.sql.
   *
   * Nur bei `messages`. Ein Unterthema einer Community hat die Spalte nicht —
   * dort wird `storyId` schlicht nicht gelesen.
   */
  storyId?: string | null;
}

/**
 * Eine Nachricht senden.
 *
 * Der ChatDetailScreen schrieb bisher selbst in `messages` — an zwei Stellen,
 * jede mit einer eigenen Spaltenliste. Hier steht es einmal, gleichlautend
 * mit handleSendMessage.
 *
 * Seit Schema 31 geht der Text durch `fuerChatVerschliessen`. In einem Chat
 * zu zweit, in dem beide Seiten ein Gerät angemeldet haben, steht danach in
 * `text` nichts mehr und in `chiffre` alles. In jedem anderen Fall — Gruppe,
 * Gegenüber ohne Gerät, kein Zufall verfügbar — bleibt es beim Klartext von
 * vorher. Der Aufrufer merkt davon nichts; das ist der Zweck.
 */
export async function nachrichtSenden(
  client: SupabaseClient,
  ichId: string,
  chatId: string,
  text: string,
  anhang: Anhang = {}
): Promise<{ id: string; created_at: string }> {
  const paket = await fuerChatVerschliessen(client, chatId, ichId, text);

  const { data, error } = await client
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: ichId,
      ...paket.spalten,
      media_url: anhang.url || null,
      media_type: anhang.typ || null,
      place_id: anhang.standortId || null,
      contact_user_id: anhang.kontaktId || null,
      reply_to: anhang.antwortAuf || null,
      quote_of: anhang.zitatVon || null,
      file_name: anhang.dateiName || null,
      file_size: anhang.dateiGroesse || null,
      reply_to_story: anhang.storyId || null,
    })
    .select('id, created_at')
    .single();
  if (error) throw error;

  /*
   * Die Kuverts, einer je mitlesendem Gerät.
   *
   * Sie müssen nach der Nachricht kommen — sie zeigen auf deren Kennung, die
   * es vorher nicht gibt. Und sie müssen ankommen: ohne Kuvert ist die
   * Nachricht für niemanden zu öffnen, auch nicht für den Absender. Deshalb
   * wird hier geworfen und die halbe Nachricht wieder weggeräumt, statt sie
   * als unlesbare Zeile stehen zu lassen.
   */
  if (paket.kuverts.length) {
    const { error: fehlerK } = await client.from('message_keys').insert(
      paket.kuverts.map((k) => ({
        message_id: (data as any).id,
        schluessel_id: k.schluesselId,
        nonce: k.nonce,
        chiffre: k.chiffre,
      }))
    );
    if (fehlerK) {
      await client.from('messages').delete().eq('id', (data as any).id);
      throw fehlerK;
    }
  }

  // Damit der Chat in der Liste nach oben rutscht. Klappt das nicht, ist die
  // Nachricht trotzdem angekommen — kein Grund, das Senden scheitern zu
  // lassen, aber auch keiner, es zu verschweigen.
  const { error: fehlerReihenfolge } = await client
    .from('chats')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', chatId);
  if (fehlerReihenfolge) {
    console.warn('Chat konnte nicht nach oben sortiert werden:', fehlerReihenfolge.message);
  }

  return data as { id: string; created_at: string };
}

/**
 * Einen Anruf im Chat vermerken.
 *
 * Henrik 07.09.2026: „Anrufe sollen als Chatnachricht protokolliert werden
 * (wie WhatsApp)." Vorher ging der Anrufbildschirm auf und wieder zu, und
 * danach war nirgends mehr festzustellen, dass es ihn gab.
 *
 * Der Eintrag ist eine gewoehnliche Nachricht mit leerem Text und gesetztem
 * `anruf_art` (SUPABASE_SCHEMA_35_anrufe.sql) — deshalb steht er in der
 * richtigen Reihenfolge, zaehlt fuer die Vorschau in der Chatliste und
 * unterliegt denselben Leserechten wie jede andere Zeile.
 *
 * Verschluesselt wird er nicht: Er traegt keinen Text, und er soll auch dann
 * lesbar bleiben, wenn ein Geraet den Chatschluessel nicht hat. Was er verraet
 * — dass angerufen wurde —, weiss die Gegenseite ohnehin.
 *
 * Gleiche Regel in web/server/sync-handlers.js (handleAnrufNotieren).
 */
export async function anrufNotieren(
  client: SupabaseClient,
  ichId: string,
  zielId: string,
  art: 'audio' | 'video',
  sekunden: number,
  status: 'beendet' | 'verpasst' | 'abgelehnt' = 'beendet'
): Promise<boolean> {
  const chatId = await chatMit(client, ichId, zielId);

  const { error } = await client.from('messages').insert({
    chat_id: chatId,
    sender_id: ichId,
    text: '',
    anruf_art: art,
    anruf_status: status,
    anruf_dauer: status === 'beendet' ? Math.max(0, Math.round(sekunden)) : 0,
  });
  if (error) throw error;

  await client.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);
  return true;
}

/**
 * Alle fremden Nachrichten eines Chats als gelesen vermerken.
 *
 * Die Entscheidung trifft die Datenbank (Schema 40, `chat_gelesen`): sie prüft
 * die Mitgliedschaft und den Schalter „lesebestaetigung" des Lesers. Direkt
 * schreiben ginge ohnehin nicht — die Regel „Eigene Nachricht aendern" lässt
 * nur den Absender an `read_at`, und ein verbotenes UPDATE trifft still null
 * Zeilen. Gibt die Zahl der bestätigten Nachrichten zurück.
 */
export async function chatGelesen(client: SupabaseClient, chatId: string) {
  const { data, error } = await client.rpc('chat_gelesen', { p_chat: chatId });
  if (error) throw error;
  return Number(data) || 0;
}

// ------------------------------------------------------------- Kontakte --

/**
 * Jemanden als Kontakt aufnehmen — und den gemeinsamen Chat gleich mit.
 *
 * Bei einem privaten Profil bleibt es zunächst bei `pending`: die Anfrage
 * läuft. Bei einem öffentlichen ist man sofort verbunden — eine Freigabe,
 * die niemand geben muss, wäre nur eine Hürde ohne Zweck. Wie handleAddContact.
 */
export async function kontaktHinzufuegen(
  client: SupabaseClient,
  ichId: string,
  zielId: string,
  privat = false,
  nachricht = ''
): Promise<{ status: string; chatId: string }> {
  if (zielId === ichId) throw new Error('Sich selbst hinzufügen geht nicht');

  const { count } = await client
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', ichId)
    .eq('contact_id', zielId);
  if ((count ?? 0) > 0) throw new Error('Diese Person steht schon in deinen Kontakten');

  const status = privat ? 'pending' : 'friend';
  const { error } = await client
    .from('contacts')
    .insert({ user_id: ichId, contact_id: zielId, status });
  if (error && error.code !== '23505') throw error;

  const chatId = await chatMit(client, ichId, zielId);
  if (nachricht.trim()) {
    const { error: fehlerNachricht } = await client
      .from('messages')
      .insert({ chat_id: chatId, sender_id: ichId, text: nachricht.trim() });
    if (fehlerNachricht) throw fehlerNachricht;
  }

  return { status, chatId };
}

/**
 * Über eine Chat-Anfrage entscheiden — annehmen oder ablehnen.
 *
 * Hier stand bis zum 03.09.2026 `anfrageAnnehmen`, und die schrieb
 * `contacts.status = 'friend'` in die Zeile des ABSENDERS. Damit nahm der
 * Absender seine eigene Anfrage an. Der Knopf dazu hieß im Chat ehrlich
 * „Annahme simulieren" — nur stand er beim Falschen und wirkte echt.
 *
 * Jetzt geht es an den Chat, den beide sehen. Wer nicht entscheiden darf,
 * kommt am Auslöser in Schema 21 nicht vorbei; die Meldung von dort ist
 * verständlich genug, um sie durchzureichen.
 */
export async function anfrageEntscheiden(
  client: SupabaseClient,
  chatId: string,
  annehmen: boolean
) {
  const { error } = await client
    .from('chats')
    .update({ anfrage_zustand: annehmen ? 'angenommen' : 'abgelehnt' })
    .eq('id', chatId);
  if (error) throw error;
  return true;
}

// --------------------------------------------------------------- Storys --

/** Eine eigene Story anlegen. Gibt die Kennung aus der Datenbank zurueck. */
export async function storyAnlegen(
  client: SupabaseClient,
  ichId: string,
  felder: {
    mediaUrl?: string | null;
    mediaTyp?: string;
    text?: string;
    /*
     * Henrik am 07.09.2026: „beim Posten fragen ob uebergreifend teilen."
     * Die Antwort gilt fuer diese eine Story (Schema 36). Ohne Angabe:
     * nein — eine Story ist eine Messenger-Sache, und was nicht ausdruecklich
     * in einen oeffentlichen Bereich gehoert, gehoert nicht dorthin.
     */
    inVideos?: boolean;
  } = {}
): Promise<string> {
  const { data, error } = await client
    .from('stories')
    .insert({
      user_id: ichId,
      media_url: felder.mediaUrl || null,
      media_type: felder.mediaTyp || 'image',
      caption: felder.text || '',
      in_videos: Boolean(felder.inVideos),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Einen Beitrag als eigene Story weitergeben — "Zu Story hinzufügen" im
 * Drei-Punkte-Menü (Henrik am 21.09.2026, Vorbild TikTok).
 *
 * Die Story zeigt dieselbe Datei wie der Beitrag; kopiert wird nur die
 * Adresse aus der Datenbank, nicht die unterschriebene aus der Anzeige —
 * die liefe nach einer Stunde ab. Sie steht auch unter Videos, weil sie
 * von dort kommt. Gleiche Regel in web/server/app.js (/api/beitraege/:id/story).
 */
export async function beitragInStory(client: SupabaseClient, ichId: string, beitragId: string) {
  const { data: beitrag, error } = await client
    .from('posts')
    .select('media_url, kind, description')
    .eq('id', beitragId)
    .maybeSingle();
  if (error) throw error;
  if (!beitrag?.media_url) throw new Error('Dieser Beitrag hat kein Bild und kein Video');
  const video = beitrag.kind !== 'post' || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(beitrag.media_url);
  return storyAnlegen(client, ichId, {
    mediaUrl: beitrag.media_url,
    mediaTyp: video ? 'video' : 'image',
    inVideos: true,
  });
}

/**
 * "Kein Interesse" — der Beitrag faellt aus dem eigenen Feed (Schema 55).
 * Doppelt tippen schadet nicht: die Zeile gibt es dann schon.
 */
export async function keinInteresse(client: SupabaseClient, ichId: string, beitragId: string) {
  const { error } = await client
    .from('kein_interesse')
    .upsert({ user_id: ichId, post_id: beitragId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true });
  if (error) throw error;
  return true;
}

/**
 * Herz an einer Story — und die Nachricht darüber an die Person.
 *
 * WARUM DIE NACHRICHT DAZUGEHÖRT
 *
 * Henrik am 18.09.2026: „Story-Like wird nicht im Chat angezeigt." Bis dahin
 * schrieb diese Funktion eine Zeile nach `story_likes` und sonst nirgendwohin.
 * Die Person, deren Story geliked wurde, erfuhr davon nichts — es gab keine
 * Nachricht, keine Mitteilung, nichts. So macht es keine App, die Storys hat:
 * ein Herz an einer Story landet immer im Chat.
 *
 * Die Nachricht trägt `reply_to_story`, zeigt im Chat also die Vorschau der
 * Story und nicht nur einen Satz. Sie geht durch `nachrichtSenden` und damit
 * durch dieselbe Verschlüsselung wie jede andere.
 *
 * ZWEI DINGE, DIE ABSICHTLICH NICHT GESCHEHEN
 *
 * Beim Zurücknehmen des Herzens wird die Nachricht NICHT gelöscht. Sie war
 * heraus; sie stillschweigend verschwinden zu lassen, hieße, den Verlauf der
 * Gegenseite zu verändern. Wer sie weghaben will, nimmt sie zurück wie jede
 * andere Nachricht.
 *
 * An der eigenen Story entsteht keine Nachricht. Es gäbe keinen Chat dafür,
 * und `chatMit` würde einen mit einem selbst anlegen wollen.
 *
 * Gleiche Regel in web/server/sync-handlers.js (handleStoryLike).
 */
export async function storyLike(client: SupabaseClient, ichId: string, storyId: string) {
  const an = await umschalten(client, 'story_likes', { story_id: storyId, user_id: ichId });

  // Nur beim Setzen, nicht beim Zurücknehmen.
  if (!an) return an;

  const { data: story } = await client
    .from('stories')
    .select('id, user_id')
    .eq('id', storyId)
    .maybeSingle();
  if (!story || story.user_id === ichId) return an;

  /*
   * Das Herz darf am Chat scheitern, ohne das Like mitzunehmen.
   *
   * Die Gegenseite kann Nachrichten abgestellt haben (Schema 22) — dann wirft
   * `chatMit`. Das Like ist dann trotzdem gesetzt, und genau so soll es sein:
   * es gehört der Story, nicht dem Chat. Ein geworfener Fehler hier würde in
   * `useAktionen` das rote Herz wieder ausschalten, obwohl es steht.
   */
  try {
    const chatId = await chatMit(client, ichId, story.user_id as string);
    await nachrichtSenden(client, ichId, chatId, '❤️', { storyId });
  } catch (fehler: any) {
    console.warn('Herz an der Story kam nicht in den Chat:', fehler?.message ?? fehler);
  }

  return an;
}

/**
 * Auf eine Story antworten.
 *
 * Die Antwort landet im normalen Chat mit dieser Person — im Betrachter sieht
 * es aus wie ein eigenes Eingabefeld, geschickt wird eine ganz gewöhnliche
 * Nachricht. In der App ging sie bisher nirgendwo hin.
 */
export async function storyAntwort(
  client: SupabaseClient,
  ichId: string,
  storyId: string,
  text: string
): Promise<string> {
  const { data: story, error } = await client
    .from('stories')
    .select('id, user_id')
    .eq('id', storyId)
    .maybeSingle();
  if (error) throw error;
  if (!story) throw new Error('Diese Story gibt es nicht mehr');

  const chatId = await chatMit(client, ichId, story.user_id as string);
  // Mit Bezug auf die Story. Ohne ihn stand im Chat ein Satz wie „schönes
  // Bild!", und niemand — auch der Schreiber nicht — wusste zwei Tage später
  // noch, worauf er sich bezog.
  await nachrichtSenden(client, ichId, chatId, text, { storyId });
  return chatId;
}

/** Eine eigene Story wieder loeschen. */
export async function storyLoeschen(client: SupabaseClient, ichId: string, id: string) {
  const { error } = await client.from('stories').delete().eq('id', id).eq('user_id', ichId);
  if (error) throw error;
  return true;
}

// ----------------------------------------------------------- Kommentare --

/**
 * Einen Kommentar schreiben.
 *
 * Gibt Kennung und Zeitpunkt aus der Datenbank zurueck — beides steht danach
 * unter dem Kommentar, und beides soll von dort kommen und nicht von der Uhr
 * des Geraets.
 */
export async function kommentarAnlegen(
  client: SupabaseClient,
  ichId: string,
  beitragId: string,
  text: string
): Promise<{ id: string; created_at: string }> {
  const { data, error } = await client
    .from('comments')
    .insert({ post_id: beitragId, user_id: ichId, text })
    .select('id, created_at')
    .single();
  if (error) throw error;
  return data as { id: string; created_at: string };
}

/** Einen eigenen Kommentar loeschen. */
export async function kommentarLoeschen(
  client: SupabaseClient,
  ichId: string,
  kommentarId: string
) {
  const { error } = await client
    .from('comments')
    .delete()
    .eq('id', kommentarId)
    .eq('user_id', ichId);
  if (error) throw error;
  return true;
}

// ----------------------------------------------------------- Communitys --

/**
 * Ein neues Unterthema in einer Community.
 *
 * Den Kurznamen baut die App genauso wie die Website, damit derselbe Name
 * auf beiden Seiten denselben Kanal ergibt.
 */
export async function kanalAnlegen(
  client: SupabaseClient,
  _ichId: string,
  communityId: string,
  name: string
): Promise<string> {
  const slug = 'ch-' + name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '');

  const { count } = await client
    .from('community_channels')
    .select('*', { count: 'exact', head: true })
    .eq('community_id', communityId)
    .ilike('name', name);
  if ((count ?? 0) > 0) throw new Error('Dieses Unterthema gibt es schon');

  const { data, error } = await client
    .from('community_channels')
    .insert({ community_id: communityId, slug, name })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Eine Nachricht in einem Community-Kanal — mit oder ohne Anhang.
 *
 * Kanaele haben eine eigene Tabelle. Der ChatDetailScreen las von dort
 * (ladeKanalNachrichten), schrieb aber nach `messages` — was man in einem
 * Unterthema schrieb, war beim naechsten Oeffnen spurlos weg.
 *
 * Der ANHANG kam am 04.09.2026 dazu, und mit ihm faellt eine zweite Luecke
 * weg: Foto, Gif, Sticker, Datei, Standort und Kontakt gingen im Kanal
 * ausnahmslos ueber `nachrichtSenden()` nach `messages`. Dort verlangt die
 * Regel „Nachricht senden" eine Mitgliedschaft im Chat mit dieser Kennung —
 * eine Kanal-Kennung ist keine, und die Datenbank wies den Datensatz mit
 * 42501 ab. Auf dem Bildschirm stand „Der Anhang ging nicht raus", und im
 * Kanal blieb es leer. Die Spalten dafuer stehen seit
 * SUPABASE_SCHEMA_25_kanal_anhang.sql.
 */
export async function kanalNachricht(
  client: SupabaseClient,
  ichId: string,
  kanalId: string,
  text: string,
  anhang: Anhang = {}
): Promise<{ id: string; created_at: string }> {
  const { data, error } = await client
    .from('community_channel_messages')
    .insert({
      channel_id: kanalId,
      sender_id: ichId,
      text,
      media_url: anhang.url || null,
      media_type: anhang.typ || null,
      place_id: anhang.standortId || null,
      contact_user_id: anhang.kontaktId || null,
      file_name: anhang.dateiName || null,
      file_size: anhang.dateiGroesse || null,
    })
    .select('id, created_at')
    .single();
  if (error) throw error;
  return data as { id: string; created_at: string };
}

// ---------------------------------------------------------------- Profil --

/**
 * Ein Highlight oder eine Playlist anlegen.
 *
 * Beides sind Textlisten in der eigenen Profilzeile. Sie lagen in der App nur
 * im Arbeitsspeicher — nach dem Neustart waren sie weg, obwohl die Website
 * sie längst speicherte. Gibt die vollständige Liste danach zurueck.
 */
export async function profilListe(
  client: SupabaseClient,
  ichId: string,
  spalte: 'highlights' | 'playlists',
  name: string
): Promise<string[]> {
  if (!['highlights', 'playlists'].includes(spalte)) throw new Error('Unbekannte Sammlung');

  const { data, error } = await client
    .from('profiles')
    .select(spalte)
    .eq('id', ichId)
    .maybeSingle();
  if (error) throw error;

  const bestand: string[] = ((data as Record<string, unknown> | null)?.[spalte] as string[]) || [];
  if (bestand.includes(name)) {
    throw new Error(
      spalte === 'highlights' ? 'Dieses Highlight gibt es schon' : 'Diese Playlist gibt es schon'
    );
  }

  const neu = [...bestand, name];
  const { error: fehlerSchreiben } = await client
    .from('profiles')
    .update({ [spalte]: neu })
    .eq('id', ichId);
  if (fehlerSchreiben) throw fehlerSchreiben;

  return neu;
}

/**
 * Gegenstueck zu profilListe: einen Namen aus der Textliste nehmen.
 *
 * Solange `profiles.highlights` / `.playlists` noch gelesen werden, muss der
 * Name beim Loeschen an beiden Stellen verschwinden — sonst steht der Kreis
 * beim naechsten Start wieder da, nur ohne id und ohne Inhalt.
 */
export async function profilListeOhne(
  client: SupabaseClient,
  ichId: string,
  spalte: 'highlights' | 'playlists',
  name: string
): Promise<string[]> {
  if (!['highlights', 'playlists'].includes(spalte)) throw new Error('Unbekannte Sammlung');

  const { data, error } = await client
    .from('profiles')
    .select(spalte)
    .eq('id', ichId)
    .maybeSingle();
  if (error) throw error;

  const bestand: string[] = ((data as Record<string, unknown> | null)?.[spalte] as string[]) || [];
  const rest = bestand.filter((n) => n !== name);
  if (rest.length === bestand.length) return bestand;

  const { error: fehlerSchreiben } = await client
    .from('profiles')
    .update({ [spalte]: rest })
    .eq('id', ichId);
  if (fehlerSchreiben) throw fehlerSchreiben;

  return rest;
}

/** Das Spendenziel setzen — oder mit `null` wieder abräumen. */
export async function spendeSetzen(
  client: SupabaseClient,
  ichId: string,
  spende: Record<string, unknown> | null
) {
  const { error } = await client
    .from('profiles')
    .update({ spende: spende ? JSON.stringify(spende) : null })
    .eq('id', ichId);
  if (error) throw error;
  return true;
}

/** Livestream an oder aus. */
export async function livestreamSetzen(
  client: SupabaseClient,
  ichId: string,
  live: string | null
) {
  const { error } = await client.from('profiles').update({ live: live || null }).eq('id', ichId);
  if (error) throw error;
  return Boolean(live);
}

// ===========================================================================
//  Was das Handbuch verlangt — nachgetragen am 01.09.2026
//
//  Der Abgleich mit `All-Media Handbuch.pdf` ergab ein gutes Dutzend
//  beschriebener, nie gebauter Funktionen. Die Gegenstücke auf der Website
//  stehen in web/server/sync-handlers.js unter derselben Überschrift.
// ===========================================================================

// ------------------------------------------------------------- Insights --
//
//  Zur Begriffsklärung, weil sie im Code schon einmal schiefging: ein
//  *Insight* ist ein Foto oder Video, das an ausgewählte Personen geht — das
//  Snapchat-Äquivalent. Die *Insight Time* zählt die Tage in Folge, an denen
//  sich beide Seiten gegenseitig einen geschickt haben. Die *Insights* im
//  Einstellungsmenü sind etwas völlig anderes: Statistik zum eigenen Profil.

export interface NeuerInsight {
  mediaUrl: string;
  mediaTyp?: 'image' | 'video';
  filter?: string;
  /** Anzeigedauer in Sekunden; 0 heißt unbegrenzt ansehen. */
  dauer?: number;
  /** Nach dem ersten Öffnen verschwunden. */
  einmal?: boolean;
  /** Selbstlöschend: nach so vielen Stunden ist die Aufnahme ganz weg. */
  loeschtNachStunden?: number;
  /** Bei sich selbst behalten. */
  gespeichert?: boolean;
}

/**
 * Einen Insight an mehrere Personen schicken und die Ketten fortschreiben.
 *
 * Die Kette rechnet die Datenbank aus (`insight_streak_fortschreiben`), nicht
 * die App. Sonst stünde die Regel „Tage in Folge, an denen beide gesendet
 * haben" zweimal da — hier und in der Website — und liefe beim ersten
 * Zahlendreher auseinander.
 */
export async function insightSenden(
  client: SupabaseClient,
  ichId: string,
  empfaenger: string[],
  felder: NeuerInsight
): Promise<{ id: string; streaks: Record<string, number> }> {
  if (!empfaenger.length) throw new Error('Ohne Empfänger geht kein Insight raus');

  const ablauf = felder.loeschtNachStunden
    ? new Date(Date.now() + felder.loeschtNachStunden * 3600_000).toISOString()
    : null;

  const { data, error } = await client
    .from('insights')
    .insert({
      sender_id: ichId,
      media_url: felder.mediaUrl,
      media_type: felder.mediaTyp || 'image',
      filter: felder.filter || '',
      dauer: felder.dauer ?? 0,
      einmal: felder.einmal ?? true,
      ablauf_at: ablauf,
      gespeichert: felder.gespeichert ?? false,
    })
    .select('id')
    .single();
  if (error) throw error;

  const id = (data as { id: string }).id;

  const { error: fehlerEmpfaenger } = await client
    .from('insight_recipients')
    .insert(empfaenger.map((user_id) => ({ insight_id: id, user_id })));
  if (fehlerEmpfaenger) throw fehlerEmpfaenger;

  // Für jeden Empfänger die Kette fortschreiben. Schlägt eine fehl, ist der
  // Insight trotzdem angekommen — die Zahl daneben ist dann nur eine Weile
  // veraltet. Das Senden daran scheitern zu lassen wäre die schlechtere Wahl.
  const streaks: Record<string, number> = {};
  for (const partner of empfaenger) {
    const { data: tage, error: fehlerStreak } = await client.rpc(
      'insight_streak_fortschreiben',
      { partner }
    );
    if (fehlerStreak) {
      console.warn('Insight Time nicht fortgeschrieben:', fehlerStreak.message);
      continue;
    }
    streaks[partner] = (tage as number) ?? 0;
  }

  return { id, streaks };
}

/**
 * Einen empfangenen Insight als gesehen vermerken.
 *
 * Bei Einmalansicht ist er danach vorbei — deshalb wird der Zeitpunkt
 * gesetzt und nicht nur ein Schalter umgelegt: so lässt sich später sagen,
 * wann er verbraucht wurde, ohne die Zeile zu löschen.
 */
export async function insightGesehen(
  client: SupabaseClient,
  ichId: string,
  insightId: string
) {
  const { error } = await client
    .from('insight_recipients')
    .update({ gesehen_at: new Date().toISOString() })
    .eq('insight_id', insightId)
    .eq('user_id', ichId);
  if (error) throw error;
  return true;
}

/** Einen eigenen Insight behalten oder das Behalten zurücknehmen. */
export async function insightSpeichern(
  client: SupabaseClient,
  ichId: string,
  insightId: string,
  behalten: boolean
) {
  const { error } = await client
    .from('insights')
    .update({ gespeichert: behalten })
    .eq('id', insightId)
    .eq('sender_id', ichId);
  if (error) throw error;
  return behalten;
}

/**
 * Einen Insight noch einmal schicken — an dieselben oder an andere.
 *
 * Das Handbuch nennt das „Insights wiederholen". Es wird bewusst ein neuer
 * Insight angelegt und nicht die Empfängerliste des alten erweitert: sonst
 * bekäme jemand eine Aufnahme, deren Einmalansicht ein anderer schon
 * verbraucht hat.
 */
export async function insightWiederholen(
  client: SupabaseClient,
  ichId: string,
  insightId: string,
  empfaenger: string[]
) {
  const { data, error } = await client
    .from('insights')
    .select('media_url, media_type, filter, dauer, einmal')
    .eq('id', insightId)
    .eq('sender_id', ichId)
    .single();
  if (error) throw error;

  const alt = data as {
    media_url: string;
    media_type: 'image' | 'video';
    filter: string;
    dauer: number;
    einmal: boolean;
  };

  return insightSenden(client, ichId, empfaenger, {
    mediaUrl: alt.media_url,
    mediaTyp: alt.media_type,
    filter: alt.filter,
    dauer: alt.dauer,
    einmal: alt.einmal,
  });
}

/** Jemanden in die feste Empfängerliste aufnehmen — oder wieder heraus. */
export function insightZiel(client: SupabaseClient, ichId: string, zielId: string) {
  return umschalten(client, 'insight_targets', { user_id: ichId, target_id: zielId });
}

// ------------------------------------------------ Nachrichten-Werkzeuge --

/**
 * Eine eigene Nachricht ändern.
 *
 * `edited_at` wird mitgesetzt, damit in der Blase „bearbeitet" stehen kann.
 * Eine stille Änderung wäre schlimmer als gar keine: das Gegenüber erinnert
 * sich an einen anderen Text und findet ihn nicht wieder.
 */
export async function nachrichtBearbeiten(
  client: SupabaseClient,
  ichId: string,
  nachrichtId: string,
  text: string
) {
  /*
   * Eine verschlüsselte Nachricht wird neu verschlossen, nicht überschrieben.
   * Der naheliegende Weg — einfach `text` setzen — hätte den geänderten Text
   * im Klartext neben die alte Chiffre gelegt. Die Datenbank weist das seit
   * Schema 31 zurück (`messages_krypto_stimmig`), und das ist gut so: sonst
   * wäre ausgerechnet die bearbeitete Fassung die lesbare.
   *
   * Die alten Kuverts bleiben stehen und passen weiter — sie tragen den
   * Sitzungsschlüssel, und der wird beim Neuverschließen ersetzt. Deshalb
   * werden sie ausgetauscht, nicht ergänzt.
   */
  const { data: alt } = await client
    .from('messages')
    .select('chat_id, krypto')
    .eq('id', nachrichtId)
    .maybeSingle();

  const paket =
    alt && Number((alt as any).krypto) > 0
      ? await fuerChatVerschliessen(client, (alt as any).chat_id, ichId, text)
      : offen(text);

  const { error } = await client
    .from('messages')
    .update({ ...paket.spalten, edited_at: new Date().toISOString() })
    .eq('id', nachrichtId)
    .eq('sender_id', ichId);
  if (error) throw error;

  if (paket.kuverts.length) {
    await client.from('message_keys').delete().eq('message_id', nachrichtId);
    const { error: fehlerK } = await client.from('message_keys').insert(
      paket.kuverts.map((k) => ({
        message_id: nachrichtId,
        schluessel_id: k.schluesselId,
        nonce: k.nonce,
        chiffre: k.chiffre,
      }))
    );
    if (fehlerK) throw fehlerK;
  }
  return true;
}

/**
 * Eine eigene Nachricht zurücknehmen.
 *
 * Die Zeile bleibt stehen und bekommt nur `deleted_at`. Würde sie gelöscht,
 * verlören Antworten und Zitate ihren Bezug und stünden ohne Anlass da.
 */
export async function nachrichtZuruecknehmen(
  client: SupabaseClient,
  ichId: string,
  nachrichtId: string
) {
  const { error } = await client
    .from('messages')
    .update({
      deleted_at: new Date().toISOString(),
      text: '',
      // Die Chiffre muss mit weg, nicht nur der Text. Bliebe sie stehen,
      // wäre die zurückgenommene Nachricht die einzige, die noch da ist —
      // und `messages_krypto_stimmig` ließe die Änderung ohnehin nicht zu.
      krypto: 0,
      chiffre: null,
      krypto_nonce: null,
      absender_schluessel: null,
    })
    .eq('id', nachrichtId)
    .eq('sender_id', ichId);
  if (error) throw error;
  return true;
}

/**
 * Eine Nachricht in andere Chats weiterleiten.
 *
 * `forwarded_from` merkt sich, von wem sie ursprünglich stammt — ohne das
 * sähe eine weitergeleitete Nachricht aus wie eine selbst geschriebene.
 */
export async function nachrichtWeiterleiten(
  client: SupabaseClient,
  ichId: string,
  nachrichtId: string,
  chatIds: string[]
) {
  if (!chatIds.length) throw new Error('Kein Ziel gewählt');

  const { data, error } = await client
    .from('messages')
    .select(
      'id, text, media_url, media_type, file_name, file_size, sender_id,' +
      ' krypto, chiffre, krypto_nonce, absender_schluessel'
    )
    .eq('id', nachrichtId)
    .single();
  if (error) throw error;

  const alt = data as any;

  /*
   * Eine verschlüsselte Nachricht steht mit leerem `text` da. Ohne diesen
   * Schritt wäre das Weitergeleitete eine leere Blase gewesen — der Fehler,
   * den man beim Einbau einer Verschlüsselung genau an solchen Nebenwegen
   * macht. Sie wird deshalb erst geöffnet und dann für jedes Ziel neu
   * verschlossen.
   *
   * Neu verschlossen, nicht mitgenommen: die Kuverts des Ursprungschats sind
   * für dessen Geräte bestimmt und passen im Zielchat auf niemanden.
   */
  let text = alt.text as string;
  if (Number(alt.krypto) > 0) {
    const meiner = await meinSchluessel(client, ichId);
    const [geoeffnet] = await aufschliessen(client, [{ ...alt }], meiner);
    text = geoeffnet.text;
    if (text === NICHT_LESBAR) {
      throw new Error('Diese Nachricht lässt sich auf diesem Gerät nicht weiterleiten');
    }
  }

  /*
   * Ein Ziel nach dem anderen statt eines gemeinsamen Inserts: jeder Chat
   * hat seine eigenen Geräte und bekommt damit eine eigene Chiffre. Ein
   * Insert über alle Ziele könnte nur eine einzige tragen.
   */
  for (const chat_id of chatIds) {
    const paket = await fuerChatVerschliessen(client, chat_id, ichId, text);
    const { data: neue, error: fehler } = await client
      .from('messages')
      .insert({
        chat_id,
        sender_id: ichId,
        ...paket.spalten,
        media_url: alt.media_url,
        media_type: alt.media_type,
        file_name: alt.file_name,
        file_size: alt.file_size,
        forwarded_from: alt.sender_id,
      })
      .select('id')
      .single();
    if (fehler) throw fehler;

    if (paket.kuverts.length) {
      const { error: fehlerK } = await client.from('message_keys').insert(
        paket.kuverts.map((k) => ({
          message_id: (neue as any).id,
          schluessel_id: k.schluesselId,
          nonce: k.nonce,
          chiffre: k.chiffre,
        }))
      );
      if (fehlerK) {
        await client.from('messages').delete().eq('id', (neue as any).id);
        throw fehlerK;
      }
    }
  }

  // Damit die Chats in der Liste nach oben rutschen.
  await client
    .from('chats')
    .update({ updated_at: new Date().toISOString() })
    .in('id', chatIds);

  return chatIds.length;
}

/**
 * Eine Reaktion setzen, wechseln oder wegnehmen.
 *
 * Eine Person hat je Nachricht genau eine Reaktion — daher der
 * Primärschlüssel ohne Emoji. Wer dasselbe Emoji noch einmal antippt, nimmt
 * es weg; ein anderes ersetzt das alte.
 */
export async function nachrichtReaktion(
  client: SupabaseClient,
  ichId: string,
  nachrichtId: string,
  emoji: string
): Promise<string | null> {
  const { data, error } = await client
    .from('message_reactions')
    .select('emoji')
    .eq('message_id', nachrichtId)
    .eq('user_id', ichId)
    .maybeSingle();
  if (error) throw error;

  const bisher = (data as { emoji: string } | null)?.emoji ?? null;

  if (bisher === emoji) {
    const { error: fehler } = await client
      .from('message_reactions')
      .delete()
      .eq('message_id', nachrichtId)
      .eq('user_id', ichId);
    if (fehler) throw fehler;
    return null;
  }

  const { error: fehler } = await client
    .from('message_reactions')
    .upsert({ message_id: nachrichtId, user_id: ichId, emoji });
  if (fehler) throw fehler;
  return emoji;
}

// -------------------------------------------------------------- Umfragen --

export interface NeueUmfrage {
  frage: string;
  antworten: string[];
  mehrfach?: boolean;
  /** Läuft nach so vielen Stunden aus; leer heißt ohne Ende. */
  endetNachStunden?: number;
}

/** Eine Umfrage an einen Beitrag, eine Story oder einen Kanal hängen. */
export async function umfrageAnlegen(
  client: SupabaseClient,
  ichId: string,
  traeger: { art: 'post' | 'story' | 'channel'; id: string },
  felder: NeueUmfrage
): Promise<string> {
  const antworten = felder.antworten.map((t) => t.trim()).filter(Boolean);
  if (!felder.frage.trim()) throw new Error('Die Frage fehlt');
  if (antworten.length < 2) throw new Error('Eine Umfrage braucht mindestens zwei Antworten');

  const { data, error } = await client
    .from('polls')
    .insert({
      user_id: ichId,
      traeger_art: traeger.art,
      traeger_id: traeger.id,
      frage: felder.frage.trim(),
      mehrfach: felder.mehrfach ?? false,
      ende_at: felder.endetNachStunden
        ? new Date(Date.now() + felder.endetNachStunden * 3600_000).toISOString()
        : null,
    })
    .select('id')
    .single();
  if (error) throw error;

  const id = (data as { id: string }).id;

  const { error: fehler } = await client
    .from('poll_options')
    .insert(antworten.map((text, position) => ({ poll_id: id, text, position })));
  if (fehler) throw fehler;

  return id;
}

/**
 * Abstimmen.
 *
 * Bei einfacher Wahl ersetzt die neue Stimme die alte — sonst könnte jemand
 * für zwei Antworten gleichzeitig stimmen und die Summe wäre größer als die
 * Zahl der Teilnehmer.
 */
export async function umfrageStimmen(
  client: SupabaseClient,
  ichId: string,
  pollId: string,
  optionId: string
) {
  const { data, error } = await client
    .from('polls')
    .select('mehrfach, ende_at')
    .eq('id', pollId)
    .single();
  if (error) throw error;

  const umfrage = data as { mehrfach: boolean; ende_at: string | null };
  if (umfrage.ende_at && new Date(umfrage.ende_at) < new Date()) {
    throw new Error('Diese Umfrage ist beendet');
  }

  if (!umfrage.mehrfach) {
    const { error: fehlerAlt } = await client
      .from('poll_votes')
      .delete()
      .eq('poll_id', pollId)
      .eq('user_id', ichId)
      .neq('option_id', optionId);
    if (fehlerAlt) throw fehlerAlt;
  }

  return umschalten(client, 'poll_votes', {
    poll_id: pollId,
    option_id: optionId,
    user_id: ichId,
  });
}

// --------------------------------------------------- Sichtbarkeit (4x) --

export type SichtbarkeitBereich =
  | 'standort'
  | 'story'
  | 'repost'
  | 'onlinestatus'
  | 'ptt'
  | 'likes'
  | 'download'
  /*
   * Zwei Bereiche, die bis zum 03.09.2026 fehlten — und es sind die beiden,
   * wegen derer man so eine Einstellung ueberhaupt aufmacht. Ohne sie blieb
   * einem nur, das ganze Profil privat zu stellen.
   */
  | 'kommentare'
  | 'markierung'
  | 'dm';

export type SichtbarkeitStufe = 'niemand' | 'niemand_bis_auf' | 'alle_bis_auf' | 'alle';

/**
 * Eine Sichtbarkeitsstufe setzen.
 *
 * Vier Stufen, nicht drei. Bis zum 01.09.2026 stand in App und Website
 * überall „Alle / Meine Kontakte / Niemand" — die beiden mittleren Stufen
 * des Handbuchs fehlten, und mit ihnen die Ausnahmelisten. „Alle bis auf
 * meinen Chef" ließ sich schlicht nicht ausdrücken.
 */
export async function sichtbarkeitSetzen(
  client: SupabaseClient,
  ichId: string,
  bereich: SichtbarkeitBereich,
  stufe: SichtbarkeitStufe
) {
  const { error } = await client
    .from('visibility_settings')
    .upsert(
      { user_id: ichId, bereich, stufe, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,bereich' }
    );
  if (error) throw error;

  // Ohne Ausnahme ist „bis auf" sinnlos, aber die Liste bleibt trotzdem
  // stehen: wer von „Alle bis auf" auf „Alle" und wieder zurück schaltet,
  // will seine mühsam zusammengesuchten Namen wiederfinden.
  return stufe;
}

/**
 * „Story auch in Videos teilen" — der Zusatz zur Stufe „Alle".
 *
 * Das Handbuch führt ihn nicht als eigene Einstellung, sondern als Anhängsel
 * der Story-Sichtbarkeit: „… Jeder -> Story auch in Videos teilen". Er
 * entscheidet, ob die eigene Story zusätzlich im Videos-Bereich der Leute
 * erscheint, die einem folgen — Kontakte sehen sie ohnehin.
 *
 * Der Wert steht auf `profiles` und nicht in `user_settings`, weil fremde
 * Geräte ihn lesen müssen (Schema 30). Dass er nur bei Stufe „Alle" gilt,
 * setzt die Datenbank durch; hier wird es nicht noch einmal geprüft, sonst
 * stünde dieselbe Regel an drei Stellen.
 */
export async function storyInVideosSetzen(
  client: SupabaseClient,
  ichId: string,
  an: boolean
) {
  const { error } = await client
    .from('profiles')
    .update({ story_in_videos: an })
    .eq('id', ichId);
  if (error) throw error;
  return an;
}

/** Jemanden auf die Ausnahmeliste setzen — oder herunternehmen. */
export function sichtbarkeitAusnahme(
  client: SupabaseClient,
  ichId: string,
  bereich: SichtbarkeitBereich,
  zielId: string
) {
  return umschalten(client, 'visibility_exceptions', {
    user_id: ichId,
    bereich,
    target_id: zielId,
  });
}

// ------------------------------------------------------- Altersschutz --

/**
 * Geburtsdatum setzen und, falls nötig, den Erziehungsberechtigten anfragen.
 *
 * Das Handbuch: unter 16 nur mit Zustimmung eines Erziehungsberechtigten,
 * und der muss selbst einen All-Media-Account besitzen. Genau deshalb wird
 * hier eine Profil-Kennung verlangt und keine E-Mail-Adresse — eine Adresse
 * kann jeder erfinden.
 */
export async function altersangabe(
  client: SupabaseClient,
  ichId: string,
  geburtsdatum: string,
  guardianHandle?: string
): Promise<{ alter: number; brauchtFreigabe: boolean; guardian: string | null }> {
  const geboren = new Date(geburtsdatum);
  if (Number.isNaN(geboren.getTime())) throw new Error('Das Geburtsdatum ist ungültig');

  const jetzt = new Date();
  let alter = jetzt.getFullYear() - geboren.getFullYear();
  const monat = jetzt.getMonth() - geboren.getMonth();
  if (monat < 0 || (monat === 0 && jetzt.getDate() < geboren.getDate())) alter--;

  if (alter < 0 || alter > 120) throw new Error('Das Geburtsdatum ist unglaubwürdig');

  const brauchtFreigabe = alter < 16;
  let guardianId: string | null = null;

  if (brauchtFreigabe) {
    if (!guardianHandle) {
      throw new Error(
        'Unter 16 braucht es einen Erziehungsberechtigten mit eigenem All-Media-Konto'
      );
    }
    const { data, error } = await client
      .from('profiles')
      .select('id')
      .eq('handle', guardianHandle.replace(/^@/, ''))
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Zu diesem Nutzernamen gibt es kein All-Media-Konto');
    guardianId = (data as { id: string }).id;
    if (guardianId === ichId) throw new Error('Das eigene Konto geht nicht');
  }

  const { error } = await client
    .from('profiles')
    .update({
      geburtsdatum,
      guardian_id: guardianId,
      guardian_status: brauchtFreigabe ? 'angefragt' : 'keiner',
    })
    .eq('id', ichId);
  if (error) throw error;

  return { alter, brauchtFreigabe, guardian: guardianId };
}

/** Als Erziehungsberechtigte(r) zustimmen oder ablehnen. */
export async function freigabeEntscheiden(
  client: SupabaseClient,
  ichId: string,
  kindId: string,
  zustimmen: boolean
) {
  const { error } = await client
    .from('profiles')
    .update({ guardian_status: zustimmen ? 'bestaetigt' : 'abgelehnt' })
    .eq('id', kindId)
    .eq('guardian_id', ichId);
  if (error) throw error;
  return zustimmen;
}

// ---------------------------------------------------- Datenauskunft --

/**
 * Alles, was zu diesem Konto gespeichert ist — Artikel 15 DSGVO.
 *
 * Die Zusammenstellung macht die Datenbank (`meine_daten()`), nicht der
 * Client. So steht an einer Stelle, was „meine Daten" sind, und eine neue
 * Tabelle wird dort ergänzt statt in App und Website getrennt.
 *
 * Nicht enthalten sind fremde Inhalte. Ein Chat gehört zwei Menschen; die
 * Nachrichten des Gegenübers sind dessen Daten, nicht die eigenen.
 */
export async function meineDaten(
  client: SupabaseClient,
  _ichId: string
): Promise<unknown> {
  const { data, error } = await client.rpc('meine_daten');
  if (error) throw error;
  return data;
}

// ------------------------------------------------------ Einstellungen --

/**
 * Eine Einstellung setzen.
 *
 * Bis zum 03.09.2026 gab es das nicht. Neun Schalter und achtzehn Auswahlen
 * lagen im Bildschirmzustand der App und in einem Modul-Objekt der Website —
 * „Privates Profil" war beim nächsten Start wieder aus.
 *
 * Ein `upsert` und kein `umschalten()`: eine Einstellung ist kein Zustand,
 * den es gibt oder nicht, sondern einer mit einem Wert. Der Wert ist immer
 * Text; ein Schalter ist `'an'` oder `'aus'`. Zahlen und Wahrheitswerte
 * wären drei Spalten für dieselbe Sache, und die Oberfläche weiß ohnehin,
 * was sie geschrieben hat.
 */
export async function einstellungSetzen(
  client: SupabaseClient,
  ichId: string,
  schluessel: string,
  wert: string
): Promise<string> {
  const { error } = await client
    .from('user_settings')
    .upsert(
      { user_id: ichId, schluessel, wert, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,schluessel' }
    );
  if (error) throw error;

  /*
   * Zwei Einstellungen haben über die Liste hinaus Bedeutung für die
   * Datenbank selbst und stehen deshalb zusätzlich in `profiles`: das
   * private Profil steuert, wer die Inhalte sieht, und der Nutzerstatus
   * steht in der Chatliste hinter dem Namen. Ohne diese Zeilen wäre der
   * Schalter zwar gespeichert — nur eben ohne Wirkung.
   */
  if (schluessel === 'videoPrivate' || schluessel === 'commPrivate') {
    const { error: fehler } = await client
      .from('profiles')
      .update({ privat: wert === 'an' })
      .eq('id', ichId);
    if (fehler) throw fehler;

    /*
     * „Privates Profil" steht zweimal in den Einstellungen — einmal unter
     * Videos, einmal unter Communitys. Beide schalten dieselbe Spalte
     * `profiles.privat`; es gibt kein privates Videoprofil neben einem
     * oeffentlichen Community-Profil.
     *
     * In `user_settings` liefen die zwei Schluessel trotzdem auseinander: wer
     * den einen umlegte, sah den anderen unveraendert stehen, obwohl er sich
     * mitgeaendert hatte. Ein Widerspruch auf demselben Bildschirm. Deshalb
     * wandert der Wert immer an beide Schluessel. Gleiche Regel in
     * web/server/sync-handlers.js.
     */
    const anderer = schluessel === 'videoPrivate' ? 'commPrivate' : 'videoPrivate';
    const { error: zwilling } = await client
      .from('user_settings')
      .upsert(
        { user_id: ichId, schluessel: anderer, wert, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,schluessel' }
      );
    if (zwilling) throw zwilling;
  }

  return wert;
}

/**
 * Einen fremden Profilaufruf vermerken.
 *
 * „Wie viele Aufrufe hatte mein Profil in den letzten Wochen?" ließ sich
 * bisher nicht beantworten, weil nichts gemessen wurde. Das eigene Profil
 * zählt nicht mit — die Datenbank lehnt es über eine Prüfregel ab, und ein
 * Fehler daraus wäre hier nur Lärm.
 */
export async function profilAufrufVermerken(
  client: SupabaseClient,
  ichId: string,
  profilId: string
): Promise<void> {
  if (!profilId || profilId === ichId) return;
  const { error } = await client
    .from('profile_views')
    .insert({ profile_id: profilId, viewer_id: ichId });
  // Ein nicht gezählter Aufruf ist ärgerlich, aber kein Grund, dem Nutzer
  // das Profil nicht zu zeigen.
  if (error) console.error('Profilaufruf nicht vermerkt:', error.message);
}

// --------------------------------------------------------- Wortfilter --

/**
 * Enthält der Text ein Wort von der Filterliste?
 *
 * Gibt das gefundene Wort und die Schwere zurück, oder null. Die Liste steht
 * in der Datenbank, damit sie sich ändern lässt, ohne App und Website neu
 * auszurollen.
 *
 * Die Prüfung läuft auf Wortgrenzen. Ohne das würde „Spastik" als Verstoß
 * gelten und ein medizinischer Beitrag ließe sich nicht schreiben.
 */
/*
 * `_ichId` wird nicht gebraucht — der Filter gilt für alle gleich. Der
 * Platzhalter steht trotzdem da, weil jede andere der einundsechzig Aktionen
 * in dieser Datei (client, ichId, …) heißt. Als einzige Ausnahme war das eine
 * Falle: der erste Prüflauf, der sie aufrief, schob ihr die Nutzerkennung als
 * zu prüfenden Text unter und meldete brav „kein Treffer".
 */
export async function wortfilter(
  client: SupabaseClient,
  _ichId: string,
  text: string
): Promise<{ wort: string; schwere: string } | null> {
  if (!text.trim()) return null;

  const { data, error } = await client.from('filter_words').select('wort, schwere');
  if (error) throw error;

  const woerter = (data as { wort: string; schwere: string }[]) || [];
  const klein = text.toLowerCase();

  for (const eintrag of woerter) {
    const muster = new RegExp(
      `(^|[^a-zäöüß])${eintrag.wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zäöüß]|$)`,
      'i'
    );
    if (muster.test(klein)) return eintrag;
  }
  return null;
}

// ------------------------------------------------------- Push-to-Talk --

/**
 * Eine Push-to-Talk-Nachricht an eine Community schicken.
 *
 * Bis zum 01.09.2026 war Push-to-Talk ein Ein/Aus-Schalter in den
 * Einstellungen — geschickt wurde damit nie etwas. Im Handbuch ist es eine
 * Funktion: eine Sprachnachricht an alle Mitglieder, gedacht für
 * Gruppenanrufe und für Momente außergewöhnlich hoher Aktivität.
 */
export async function pttSenden(
  client: SupabaseClient,
  ichId: string,
  communityId: string,
  audioUrl: string,
  dauer: number,
  channelId?: string | null
) {
  const { data, error } = await client
    .from('ptt_messages')
    .insert({
      community_id: communityId,
      channel_id: channelId || null,
      sender_id: ichId,
      audio_url: audioUrl,
      dauer: Math.max(0, Math.round(dauer)),
    })
    .select('id, created_at')
    .single();
  if (error) throw error;
  return data as { id: string; created_at: string };
}

// -------------------------------------------- Livestream: Kommentare ----

/** Einen Kommentar in die Live-Spalte schreiben. */
export async function streamKommentar(
  client: SupabaseClient,
  ichId: string,
  postId: string,
  text: string
) {
  if (!text.trim()) throw new Error('Leerer Kommentar');
  const { data, error } = await client
    .from('stream_comments')
    .insert({ post_id: postId, user_id: ichId, text: text.trim() })
    .select('id, created_at')
    .single();
  if (error) throw error;
  return data as { id: string; created_at: string };
}

/**
 * Spenden — an ein Profil, während eines Streams oder über einen Spendenlink.
 *
 * Der Betrag steht in Cent, damit nichts gerundet wird. Eine echte Zahlung
 * läuft hier nicht: der Spendencode aus den Einstellungen verweist auf
 * Bankkarte oder PayPal, die Buchung passiert dort. Hier wird festgehalten,
 * dass sie stattgefunden hat.
 */
export async function spenden(
  client: SupabaseClient,
  ichId: string,
  empfaengerId: string,
  betragCent: number,
  postId?: string | null,
  nachricht?: string
) {
  if (!Number.isFinite(betragCent) || betragCent <= 0) {
    throw new Error('Der Betrag muss größer als null sein');
  }
  if (empfaengerId === ichId) throw new Error('An sich selbst geht keine Spende');

  const { data, error } = await client
    .from('donations')
    .insert({
      post_id: postId || null,
      empfaenger_id: empfaengerId,
      sender_id: ichId,
      betrag_cent: Math.round(betragCent),
      nachricht: nachricht || '',
    })
    .select('id, created_at')
    .single();
  if (error) throw error;
  return data as { id: string; created_at: string };
}

// ------------------------------------------------------ Standortanfrage --

/** Den Standort von jemandem anfragen — aus dem Privatchat heraus. */
export async function standortAnfragen(
  client: SupabaseClient,
  ichId: string,
  chatId: string,
  zielId: string
) {
  const { data, error } = await client
    .from('location_requests')
    .insert({ chat_id: chatId, sender_id: ichId, ziel_id: zielId })
    .select('id, created_at')
    .single();
  if (error) throw error;
  return data as { id: string; created_at: string };
}

/**
 * Eine Standortanfrage beantworten.
 *
 * `stunden` begrenzt die Freigabe. Ohne Angabe gilt sie ohne Frist — beides
 * steht so im Handbuch („Begrenzter Live-Standort/Live-Standort ohne Frist").
 */
export async function standortAntwort(
  client: SupabaseClient,
  ichId: string,
  anfrageId: string,
  annehmen: boolean,
  stunden?: number
) {
  const { error } = await client
    .from('location_requests')
    .update({
      zustand: annehmen ? 'angenommen' : 'abgelehnt',
      bis_at: annehmen && stunden ? new Date(Date.now() + stunden * 3600_000).toISOString() : null,
    })
    .eq('id', anfrageId)
    .eq('ziel_id', ichId);
  if (error) throw error;
  return annehmen;
}

/**
 * Gibt es eine Community mit diesem Namen schon — irgendwo?
 *
 * Das Handbuch verlangt einen „Filter gegen Erstellung an Communitys, die
 * schon vorhanden sind". Bis zum 01.09.2026 prüfte die App nur die eigenen:
 * wer einer Community nicht beigetreten war, legte sie fröhlich ein zweites
 * Mal an, und beide standen danach nebeneinander in der Suche.
 *
 * Verglichen wird ohne Rücksicht auf Groß- und Kleinschreibung. „Kochen" und
 * „kochen" sind für jeden, der sucht, dieselbe Community.
 */
export async function communityNameFrei(
  client: SupabaseClient,
  name: string
): Promise<boolean> {
  const { data, error } = await client
    .from('communities')
    .select('id')
    .ilike('name', name.trim())
    .limit(1);
  if (error) throw error;
  return ((data ?? []) as unknown[]).length === 0;
}

// ------------------------------------------------------- Anwesenheit --
//
// "Zuletzt online" — bis zum 03.09.2026 gab es dazu keine einzige Angabe in
// der Datenbank. Im Chatkopf stand fest das Wort "Online", bei jedem
// Menschen, zu jeder Zeit.

/**
 * „Ich bin da." Der Zeitpunkt kommt aus der Datenbank, nicht vom Gerät —
 * eine Uhr auf einem Telefon kann falsch gehen, und „zuletzt online in vier
 * Stunden" wäre schwer zu erklären.
 */
export async function hierBinIch(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('hier_bin_ich');
  // Ein nicht vermerkter Besuch ist kein Grund, das zu melden — es lädt die
  // Oberfläche nicht, und jede Meldung eines stillen Fehlers irritiert mehr.
}

/**
 * Wann war diese Person zuletzt da? `null`, wenn sie ihren Status verbirgt —
 * die Leseregel auf `presence` gibt dann keine Zeile heraus. Für den
 * Betrachter sieht das aus wie „war noch nie da", und das ist Absicht: ein
 * „verborgen" wäre selbst die Auskunft, die die Einstellung verhindert.
 */
export async function praesenzLesen(
  client: SupabaseClient,
  profilId: string
): Promise<string | null> {
  if (!profilId) return null;
  const { data } = await client
    .from('presence')
    .select('last_seen')
    .eq('user_id', profilId)
    .maybeSingle();
  return (data as { last_seen?: string } | null)?.last_seen ?? null;
}

/**
 * „Online", „zuletzt online vor 12 Min." oder gar nichts.
 *
 * Dieselben Schwellen wie `praesenzText()` in web/public/app.js. Laufen die
 * beiden auseinander, zeigt dieselbe Person in App und Browser einen anderen
 * Zustand.
 */
export function praesenzText(iso: string | null): string {
  if (!iso) return '';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 3) return 'Online';
  if (min < 60) return `zuletzt online vor ${min} Min.`;
  const std = Math.floor(min / 60);
  if (std < 24) return `zuletzt online vor ${std} Std.`;
  const tage = Math.floor(std / 24);
  if (tage === 1) return 'zuletzt online gestern';
  if (tage < 7) return `zuletzt online vor ${tage} Tagen`;
  return 'zuletzt online vor längerer Zeit';
}

/**
 * Darf ich die Inhalte dieser Person auf mein Gerät holen?
 *
 * Die „Downloadeinstellungen" standen seit dem 01.09.2026 in den
 * Einstellungen und wurden nie gefragt — es gab überhaupt keinen Weg, einen
 * fremden Inhalt zu sichern, also auch nichts zu erlauben.
 *
 * Was das nicht kann: ein Bildschirmfoto verhindern. Wer etwas sehen darf,
 * hat es geladen. Die Einstellung nimmt den Knopf weg, mehr verspricht sie
 * nicht — deshalb steht sie in der Datenbank auch als Funktion und nicht als
 * Regel.
 */
export async function darfHerunterladen(
  client: SupabaseClient,
  inhaberId: string,
  ichId: string
): Promise<boolean> {
  if (!inhaberId || inhaberId === ichId) return true;
  const { data, error } = await client.rpc('darf_herunterladen', {
    inhaber: inhaberId,
    wer: ichId,
  });
  // Im Zweifel nein: ein Knopf, der bei einer Stoerung erscheint, waere
  // genau der Fall, den die Einstellung ausschliessen soll.
  if (error) return false;
  return data === true;
}

/**
 * Wer hat meine Story gesehen?
 *
 * Steht in public.story_views (Schema 2); lesen darf die Liste laut RLS nur,
 * wem die Story gehört. Bis zum 09.09.2026 rechnete das Sheet sie sich
 * stattdessen aus den eigenen Kontakten aus — die Namen waren erfunden und
 * die Zahl stieg mit dem Alter der Story statt mit den Zuschauern.
 *
 * Gegenstück auf der Website: GET /api/stories/:id/ansichten.
 */
export interface StorySeher {
  id: string;
  name: string;
  handle: string;
  zeit: string | null;
}

export async function storyAnsichten(
  client: SupabaseClient,
  storyId: string,
  ichId: string
): Promise<StorySeher[]> {
  const { data, error } = await client
    .from('story_views')
    .select('user_id, viewed_at, profiles!user_id(name, handle)')
    .eq('story_id', storyId)
    .order('viewed_at', { ascending: false });
  if (error || !data) return [];

  return data
    .filter((z: any) => z.user_id !== ichId)
    .map((z: any) => ({
      id: z.user_id as string,
      name: (z.profiles?.name as string) || 'Unbekannt',
      handle: (z.profiles?.handle as string) || '',
      zeit: (z.viewed_at as string) ?? null,
    }));
}

/**
 * Darf ich dieser Person überhaupt schreiben?
 *
 * Der Sichtbarkeitsbereich `dm` — „Nachrichten senden deaktivieren" aus dem
 * Handbuch. Seit Schema 19 lehnt die Datenbank die Nachricht ab; der Chat
 * entstand trotzdem, und in der Liste der angeschriebenen Person stand ein
 * leerer Eintrag. Seit Schema 22 sperrt die Regel schon das Eintragen als
 * Mitglied — diese Funktion ist die Auskunft davor, damit der Knopf gar nicht
 * erst erscheint.
 *
 * Gegenstueck auf der Website: GET /api/dm-erlaubt/:userId.
 */
export async function darfAngeschriebenWerden(
  client: SupabaseClient,
  zielId: string,
  ichId: string
): Promise<boolean> {
  if (!zielId || zielId === ichId) return true;
  const { data, error } = await client.rpc('darf_angeschrieben_werden', {
    inhaber: zielId,
    wer: ichId,
  });
  // Im Zweifel nein — dieselbe Richtung wie oben. Ein Eingabefeld, das bei
  // einer Stoerung aufgeht, fuehrt genau in die abgewiesene Nachricht.
  if (error) return false;
  return data === true;
}

// -------------------------------------------------------- Markierungen --
//
// „Wer darf mich markieren" stand in den Einstellungen, und der Reiter
// „Markiert" stand im Profil. Dazwischen war nichts: keine Tabelle, kein
// Weg, jemanden zu markieren, und folglich ein Reiter, der bei jedem
// Menschen leer war. Zwei Anzeigen, die zusammen so aussahen, als gaebe es
// die Funktion.

/** Die @-Namen aus einem Text, ohne das Zeichen und ohne Doppelte. */
export function erwaehnungen(text: string): string[] {
  const treffer = String(text || '').match(/@[A-Za-z0-9_.]{2,30}/g) || [];
  return [...new Set(treffer.map((t) => t.slice(1).toLowerCase()))];
}

/**
 * Markiert die in der Beschreibung erwähnten Personen.
 *
 * Warum aus dem Text und nicht über eine eigene Auswahl: die @-Markierung
 * gibt es in der Beschreibung längst, sie steht so auch im Handbuch, und ein
 * zweiter Weg zum selben Ziel wäre genau der Fehler, den Henrik am
 * Standort-Blatt beanstandet hat — zwei Orte, dieselbe Sache.
 *
 * Jede Markierung wird einzeln eingetragen. Wer sie nicht zulässt, lehnt sie
 * über die Regel ab; das darf die übrigen nicht mitreißen. Und es wird
 * absichtlich **nicht** gemeldet, wer abgelehnt hat: „X lässt sich nicht
 * markieren" wäre selbst die Auskunft, die die Einstellung verhindern soll.
 *
 * Gibt die Namen zurück, die wirklich angekommen sind.
 */
export async function markierungenSetzen(
  client: SupabaseClient,
  beitragId: string,
  beschreibung: string
): Promise<string[]> {
  const namen = erwaehnungen(beschreibung);
  if (namen.length === 0) return [];

  const { data: profile } = await client
    .from('profiles')
    .select('id, name, handle')
    .in('handle', namen.map((n) => '@' + n));

  const gesetzt: string[] = [];
  for (const p of (profile ?? []) as { id: string; name: string }[]) {
    const { error } = await client
      .from('post_tags')
      .insert({ post_id: beitragId, user_id: p.id });
    if (!error) gesetzt.push(p.name);
  }
  return gesetzt;
}

/**
 * Eine Kachel im Profilraster — für alle drei Reiter dieselbe Form.
 */
export interface Rasterkachel {
  id: string;
  kind: string;
  mediaUrl: string | null;
  thumbnail: string | null;
}

/** Aus einer `posts`-Zeile eine Kachel machen. */
function kachel(b: any): Rasterkachel {
  return {
    id: b.id,
    kind: b.kind,
    mediaUrl: b.media_url ?? null,
    thumbnail: b.thumbnail_url ?? null,
  };
}

/**
 * Die Beiträge einer Person — der erste Reiter im Profil.
 *
 * Bis zum 03.09.2026 zeichnete `UserProfileScreen` hier zwölf feste Kacheln
 * aus einer Konstanten: bei jedem Menschen dieselben zwölf, unabhängig davon,
 * ob er drei Beiträge hatte oder keinen. Darüber stand gleichzeitig die
 * echte Zahl aus `profile_zahlen` — die Anzeige widersprach sich also selbst.
 *
 * `publish_at` in der Zukunft bleibt draußen; sonst zeigte das fremde Profil
 * einen Beitrag, den „später posten" gerade zurückhält.
 */
export async function beitraegeVon(
  client: SupabaseClient,
  profilId: string
): Promise<Rasterkachel[]> {
  const { data, error } = await client
    .from('posts')
    .select('id, kind, media_url, thumbnail_url, created_at')
    .eq('user_id', profilId)
    .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  // Fund 4: Kachelbilder brauchen unterschriebene Adressen (lib/medien.ts).
  return signiereMedien(client, ((data ?? []) as any[]).map(kachel));
}

/**
 * Was eine Person repostet hat — der Reiter „Reposts".
 *
 * Die Repost-Sichtbarkeit steckt nicht hier, sondern als Leseregel auf
 * `reposts` (Schema 20). Wer seine Reposts verbirgt, liefert hier schlicht
 * keine Zeilen — der Reiter ist dann leer, ohne dass die Oberfläche etwas
 * über die Einstellung verrät.
 */
export async function repostsVon(
  client: SupabaseClient,
  profilId: string
): Promise<Rasterkachel[]> {
  const { data, error } = await client
    .from('reposts')
    .select('post_id, created_at, posts!post_id(id, kind, media_url, thumbnail_url)')
    .eq('user_id', profilId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  // Fund 4: Kachelbilder brauchen unterschriebene Adressen (lib/medien.ts).
  return signiereMedien(
    client,
    ((data ?? []) as any[])
      .map((z) => z.posts)
      .filter(Boolean)
      .map(kachel)
  );
}

/** Die Beiträge, in denen jemand markiert wurde — der Reiter „Markiert". */
export async function markierteBeitraege(
  client: SupabaseClient,
  profilId: string
): Promise<Rasterkachel[]> {
  const { data, error } = await client
    .from('post_tags')
    .select('post_id, created_at, posts!post_id(id, kind, media_url, thumbnail_url)')
    .eq('user_id', profilId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  // Fund 4: Kachelbilder brauchen unterschriebene Adressen (lib/medien.ts).
  return signiereMedien(
    client,
    ((data ?? []) as any[])
      .map((z) => z.posts)
      .filter(Boolean)
      .map(kachel)
  );
}

/**
 * Die Beiträge, die man selbst gespeichert hat — der Reiter mit dem
 * Lesezeichen im eigenen Profil.
 *
 * WARUM ES DAS ERST SEIT DEM 18.09.2026 GIBT
 *
 * Das Lesezeichen unter einem Beitrag schreibt seit jeher nach `saves`. Was
 * fehlte, war jede Möglichkeit, dort wieder hineinzusehen: `saves` wurde an
 * genau einer Stelle gelesen — in `ladeBeitraege`, und zwar nur, um zu
 * wissen, welches Lesezeichen im Feed ausgefüllt zu zeichnen ist. Eine Liste
 * der gespeicherten Beiträge gab es weder in der App noch auf der Website.
 *
 * Henrik am 18.09.2026: „Gespeicherte Beiträge werden nicht synchronisiert
 * (unter Videos/Profil kann ich sie nicht sehen)." Synchronisiert waren sie
 * — sie waren nur nirgends abrufbar.
 *
 * Der Prototyp-Frame „VP + Gespeichert" zeigt den Reiter als vierten neben
 * Raster, Repost und @; genau dort steht er jetzt.
 *
 * Nur für einen selbst. Was jemand speichert, geht niemanden sonst etwas an;
 * die Leseregel auf `saves` sieht das genauso, ein fremder Aufruf käme mit
 * leeren Händen zurück.
 */
export async function gespeicherteVon(
  client: SupabaseClient,
  profilId: string
): Promise<Rasterkachel[]> {
  const { data, error } = await client
    .from('saves')
    .select('post_id, created_at, posts!post_id(id, kind, media_url, thumbnail_url)')
    .eq('user_id', profilId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  // Fund 4: Kachelbilder brauchen unterschriebene Adressen (lib/medien.ts).
  return signiereMedien(
    client,
    ((data ?? []) as any[])
      .map((z) => z.posts)
      .filter(Boolean)
      .map(kachel)
  );
}

/** Ein Beitrag, den man selbst geliked hat — für die Liste, nicht fürs Raster. */
export interface GelikterBeitrag {
  id: string;
  kind: string;
  /** Was in der Zeile steht: Titel, sonst Beschreibung, sonst die Art. */
  titel: string;
  /** Wann man ihn geliked hat, als ISO-Zeitpunkt. */
  wann: string;
}

/**
 * Die Beiträge, die man selbst geliked hat.
 *
 * Dasselbe Bild wie bei den gespeicherten: `post_likes` wurde nur gelesen, um
 * das Herz im Feed rot zu färben. Wer wissen wollte, was ihm alles gefallen
 * hat, hatte keinen Weg dorthin. Henrik am 18.09.2026: „Likes … werden nicht
 * synchronisiert (unter Videos/Profil kann ich sie nicht sehen)."
 *
 * WARUM KEIN REITER IM PROFIL
 *
 * Der Prototyp zeigt dort genau vier — Raster, Repost, @ und Gespeichert. Ein
 * fünfter wäre erfunden, und erfunden wird bei All Media nichts. Die Liste
 * steht deshalb in den Einstellungen unter „Videos", direkt neben
 * „Likes-Sichtbarkeit", wo sie thematisch hingehört.
 *
 * Deshalb auch keine Kacheln: der Einstellungsbereich kennt Textzeilen. Ein
 * Raster dort wäre eine neue Darstellungsform, die es im Prototyp nicht gibt.
 *
 * Nur für einen selbst — die Leseregel auf `post_likes` sieht das genauso.
 */
export async function gelikteVon(
  client: SupabaseClient,
  profilId: string
): Promise<GelikterBeitrag[]> {
  const { data, error } = await client
    .from('post_likes')
    .select('post_id, created_at, posts!post_id(id, kind, title, description)')
    .eq('user_id', profilId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const ART: Record<string, string> = { post: 'Foto', reel: 'Video (Hochformat)', clip: 'Video' };

  return ((data ?? []) as any[])
    .filter((z) => z.posts)
    .map((z) => {
      const b = z.posts;
      // Ein Beitrag ohne Titel und ohne Beschreibung ist kein Fehler — dann
      // steht die Art dort. Ein leerer Strich waere die schlechtere Antwort.
      const text = (b.title || b.description || '').trim();
      return {
        id: b.id,
        kind: b.kind,
        titel: text || ART[b.kind] || 'Beitrag',
        wann: z.created_at,
      };
    });
}

/** Ein eigener Kommentar — für die Liste in den Einstellungen. */
export interface EigenerKommentar {
  /** Die Kennung des Kommentars, nicht die des Beitrags. */
  id: string;
  /** Der Beitrag, unter dem er steht — für den Sprung dorthin. */
  beitragId: string;
  kind: string;
  /** Was man geschrieben hat. */
  text: string;
  /** Der Beitrag, unter dem es steht: Titel, sonst Beschreibung, sonst Art. */
  beitrag: string;
  wann: string;
}

/**
 * Die eigenen Kommentare.
 *
 * Henrik am 18.09.2026: „Likes, Kommentare, Reposts, Gespeicherte Beiträge …
 * werden nicht synchronisiert (unter Videos/Profil kann ich sie nicht
 * sehen)." Drei der vier Gattungen haben ihren Ort an diesem Tag bekommen,
 * die Kommentare nicht — sie waren die einzige, für die es nirgends eine
 * Ansicht gab.
 *
 * Wie bei `gelikteVon()` kein fünfter Profilreiter: der Prototyp zeigt dort
 * genau vier ([[Prototyp ist bindend]]). Die Liste steht in den Einstellungen
 * unter „Videos", neben „Wer darf kommentieren".
 *
 * WAS DABEI AUFFIEL
 *
 * Der Testkommentar hing an einem Beitrag, den sein eigener Verfasser nicht
 * lesen durfte — `starter_inhalte()` wählte ihn mit `b.demo and b.user_id <>
 * ziel`, also derselben Bedingung, die am 18.09. schon Merkliste, Repost und
 * Likes leer aussehen ließ. Diese Liste wäre ohne Schema 50 leer geblieben,
 * obwohl die Zeile existiert.
 *
 * Deshalb wird hier auch nichts gefiltert, was nicht gefiltert werden muss:
 * ein Kommentar ohne lesbaren Beitrag fällt heraus (er hat keinen Ort, auf
 * den er zeigen könnte), und genau dafür gibt es jetzt die Gegenprobe in der
 * Datenbank.
 */
export async function kommentierteVon(
  client: SupabaseClient,
  profilId: string
): Promise<EigenerKommentar[]> {
  const { data, error } = await client
    .from('comments')
    .select('id, text, created_at, post_id, posts!post_id(id, kind, title, description)')
    .eq('user_id', profilId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as any[])
    .filter((z) => z.posts)
    .map((z) => ({
      id: z.id,
      beitragId: z.posts.id,
      kind: z.posts.kind,
      text: (z.text || '').trim(),
      beitrag: Kommentar.beitragsName(z.posts),
      wann: z.created_at,
    }));
}

/** Die Zeile, wie sie auch die Website baut — siehe gemeinsam/kommentar.js. */
export function kommentarZeile(k: EigenerKommentar): string {
  return Kommentar.zeile(k);
}

/* ==========================================================================
 *  Sammlungen — Playlists und Highlights
 * ========================================================================== */

/**
 * Eine Sammlung, wie sie im Profil als Kreis erscheint.
 *
 * BEFUND 20.09.2026
 *
 * `profiles.highlights` und `profiles.playlists` waren Textlisten — nur
 * Namen. Es gab keine Zuordnung, welcher Beitrag zu welcher Playlist gehoert
 * und welche Story in welchem Highlight liegt. Deshalb hatte kein Kreis ein
 * Vorschaubild: es gab nichts, wovon es das Vorschaubild gewesen waere. Und
 * Antippen antwortete mit einer Meldung statt mit dem Inhalt.
 *
 * Seit Schema 46 gibt es `sammlungen` und `sammlung_inhalte`.
 */
export interface Sammlung {
  id: string;
  art: 'playlist' | 'highlight';
  name: string;
  /** Wie viele Beitraege beziehungsweise Storys darin liegen. */
  anzahl: number;
  /**
   * Das Bild des zuletzt hinzugefuegten Stuecks — oder null.
   *
   * Null ist ein gueltiger Zustand, keine Panne: eine gerade angelegte
   * Sammlung ist leer. Die Oberflaeche zeigt dann ihr Symbol, wie bisher.
   */
  bild: string | null;
}

/**
 * Die Sammlungen eines Profils, je Gattung.
 *
 * Das Vorschaubild kommt aus derselben Abfrage — eine zweite je Kreis waere
 * bei fuenf Kreisen fuenf Abfragen fuer fuenf Bilder.
 */
export async function sammlungenVon(
  client: SupabaseClient,
  profilId: string,
  art: 'playlist' | 'highlight'
): Promise<Sammlung[]> {
  const { data, error } = await client
    .from('sammlungen')
    .select(
      `id, art, name, created_at,
       sammlung_inhalte (
         created_at,
         posts!post_id (thumbnail_url, media_url),
         stories!story_id (media_url)
       )`
    )
    .eq('user_id', profilId)
    .eq('art', art)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const sammlungen: Sammlung[] = ((data ?? []) as any[]).map((s) => {
    const inhalte = (s.sammlung_inhalte ?? []) as any[];
    // Das zuletzt Hinzugefuegte steht vorn — das ist das Bild, das ein
    // Mensch als "der aktuelle Stand dieser Sammlung" liest.
    const neueste = [...inhalte].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const treffer = neueste.find((i) => i.posts || i.stories);
    const bild = treffer
      ? treffer.posts?.thumbnail_url || treffer.posts?.media_url || treffer.stories?.media_url || null
      : null;
    return { id: s.id, art: s.art, name: s.name, anzahl: inhalte.length, bild };
  });

  // Fund 4: der Medieneimer ist nicht oeffentlich, jede Adresse wird
  // unterschrieben. `signiereMedien` arbeitet auf `mediaUri` — deshalb der
  // Umweg ueber eine Zwischenform statt eines zweiten Unterschreibers.
  const unterschrieben = await signiereMedien(
    client,
    sammlungen.map((s) => ({ id: s.id, mediaUri: s.bild ?? undefined })) as any
  );
  return sammlungen.map((s, i) => ({ ...s, bild: (unterschrieben[i] as any)?.mediaUri ?? null }));
}

/** Was in einer Sammlung liegt — Beitraege bei Playlists, Storys bei Highlights. */
export async function sammlungInhalt(
  client: SupabaseClient,
  sammlungId: string
): Promise<Rasterkachel[]> {
  const { data, error } = await client
    .from('sammlung_inhalte')
    .select(
      `position, created_at,
       posts!post_id (id, kind, media_url, thumbnail_url),
       stories!story_id (id, media_url)`
    )
    .eq('sammlung_id', sammlungId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;

  const stuecke = ((data ?? []) as any[])
    .map((z) =>
      z.posts
        ? kachel(z.posts)
        : z.stories
          ? { id: z.stories.id, kind: 'story', mediaUri: z.stories.media_url }
          : null
    )
    .filter(Boolean) as Rasterkachel[];

  return signiereMedien(client, stuecke);
}

/**
 * Eine Sammlung anlegen.
 *
 * Der Name muss neu sein. Die Datenbank sagt das ohnehin (unique auf
 * Nutzer + Gattung + Name); hier steht es nur, damit die Meldung auf
 * Deutsch ankommt statt als Postgres-Code.
 */
export async function sammlungAnlegen(
  client: SupabaseClient,
  ichId: string,
  art: 'playlist' | 'highlight',
  name: string
): Promise<Sammlung> {
  const sauber = name.trim();
  if (!sauber) throw new Error('Ohne Namen geht das nicht');

  const { data, error } = await client
    .from('sammlungen')
    .insert({ user_id: ichId, art, name: sauber })
    .select('id, art, name')
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new Error(
        art === 'highlight' ? 'Dieses Highlight gibt es schon' : 'Diese Playlist gibt es schon'
      );
    }
    throw error;
  }
  return { id: data.id, art: data.art, name: data.name, anzahl: 0, bild: null };
}

/**
 * Etwas in eine Sammlung legen.
 *
 * Ob Beitrag oder Story richtig ist, entscheidet die Gattung der Sammlung —
 * geprueft im Ausloeser in der Datenbank, nicht hier. Eine zweite Pruefung
 * an dieser Stelle waere eine zweite Wahrheit, und die beiden wuerden
 * auseinanderlaufen.
 */
export async function inSammlung(
  client: SupabaseClient,
  sammlungId: string,
  stueck: { postId?: string; storyId?: string }
): Promise<void> {
  const { error } = await client.from('sammlung_inhalte').insert({
    sammlung_id: sammlungId,
    post_id: stueck.postId ?? null,
    story_id: stueck.storyId ?? null,
  });
  if (error) {
    if (error.code === '23505') throw new Error('Das liegt schon in dieser Sammlung');
    throw error;
  }
}

/**
 * Eine ganze Sammlung loeschen.
 *
 * Der Inhalt faellt per `on delete cascade` mit — die Beitraege und Storys
 * selbst bleiben stehen, es verschwindet nur die Zuordnung.
 */
export async function sammlungLoeschen(
  client: SupabaseClient,
  sammlungId: string
): Promise<void> {
  // Wie in ausSammlung: unter Row Level Security loescht ein abgelehntes
  // DELETE null Zeilen und meldet keinen Fehler. Gezaehlt wird, was weg ist.
  const { data, error } = await client
    .from('sammlungen')
    .delete()
    .eq('id', sammlungId)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Diese Sammlung liess sich nicht loeschen');
}

/** Etwas wieder herausnehmen. */
export async function ausSammlung(
  client: SupabaseClient,
  sammlungId: string,
  stueck: { postId?: string; storyId?: string }
): Promise<void> {
  let frage = client.from('sammlung_inhalte').delete().eq('sammlung_id', sammlungId);
  frage = stueck.postId ? frage.eq('post_id', stueck.postId) : frage.eq('story_id', stueck.storyId!);

  // Bei Row Level Security loescht ein abgelehntes DELETE null Zeilen und
  // meldet keinen Fehler. Deshalb wird zurueckgegeben, was wirklich weg ist.
  const { data, error } = await frage.select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Das liess sich nicht herausnehmen');
}
