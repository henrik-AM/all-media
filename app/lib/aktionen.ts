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
