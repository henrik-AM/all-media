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
    let loeschen = client.from(tabelle).delete();
    for (const [spalte, wert] of Object.entries(schluessel)) loeschen = loeschen.eq(spalte, wert);
    const { error } = await loeschen;
    if (error) throw error;
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
  vorschau = 'Beitrag geteilt'
): Promise<string[]> {
  if (empfaenger.length === 0) throw new Error('Bitte mindestens eine Person auswählen');

  const gesendet: string[] = [];
  for (const zielId of empfaenger) {
    const chatId = await chatMit(client, ichId, zielId);
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
}

/**
 * Eine Nachricht senden.
 *
 * Der ChatDetailScreen schrieb bisher selbst in `messages` — an zwei Stellen,
 * jede mit einer eigenen Spaltenliste. Hier steht es einmal, gleichlautend
 * mit handleSendMessage.
 */
export async function nachrichtSenden(
  client: SupabaseClient,
  ichId: string,
  chatId: string,
  text: string,
  anhang: Anhang = {}
): Promise<{ id: string; created_at: string }> {
  const { data, error } = await client
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: ichId,
      text,
      media_url: anhang.url || null,
      media_type: anhang.typ || null,
      place_id: anhang.standortId || null,
      contact_user_id: anhang.kontaktId || null,
    })
    .select('id, created_at')
    .single();
  if (error) throw error;

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

/** Eine Nachricht als gelesen vermerken. */
export async function nachrichtGelesen(
  client: SupabaseClient,
  _ichId: string,
  nachrichtId: string
) {
  const { error } = await client
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', nachrichtId);
  if (error) throw error;
  return true;
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

/** Eine Kontaktanfrage annehmen — danach ist der Chat frei benutzbar. */
export async function anfrageAnnehmen(client: SupabaseClient, ichId: string, zielId: string) {
  const { error } = await client
    .from('contacts')
    .update({ status: 'friend' })
    .eq('user_id', ichId)
    .eq('contact_id', zielId);
  if (error) throw error;
  return true;
}

// --------------------------------------------------------------- Storys --

/** Eine eigene Story anlegen. Gibt die Kennung aus der Datenbank zurueck. */
export async function storyAnlegen(
  client: SupabaseClient,
  ichId: string,
  felder: { mediaUrl?: string | null; mediaTyp?: string; text?: string } = {}
): Promise<string> {
  const { data, error } = await client
    .from('stories')
    .insert({
      user_id: ichId,
      media_url: felder.mediaUrl || null,
      media_type: felder.mediaTyp || 'image',
      caption: felder.text || '',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Herz an einer Story. */
export function storyLike(client: SupabaseClient, ichId: string, storyId: string) {
  return umschalten(client, 'story_likes', { story_id: storyId, user_id: ichId });
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
  await nachrichtSenden(client, ichId, chatId, text);
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
 * Eine Nachricht in einem Community-Kanal.
 *
 * Kanaele haben eine eigene Tabelle. Der ChatDetailScreen las von dort
 * (ladeKanalNachrichten), schrieb aber nach `messages` — was man in einem
 * Unterthema schrieb, war beim naechsten Oeffnen spurlos weg.
 */
export async function kanalNachricht(
  client: SupabaseClient,
  ichId: string,
  kanalId: string,
  text: string
): Promise<{ id: string; created_at: string }> {
  const { data, error } = await client
    .from('community_channel_messages')
    .insert({ channel_id: kanalId, sender_id: ichId, text })
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
