/**
 * All Media — Inhalte aus Supabase.
 *
 * Das ist die einzige Stelle, an der die App Inhalte herholt. Es gibt keine
 * Beispieldaten mehr, aus denen sie ersatzweise lesen könnte: bis zum
 * 31.08.2026 lasen sechsundzwanzig Dateien aus `app/mocks/index.ts`, während
 * die Website ihre eigene Kopie derselben Daten im Server hatte. Zwei
 * Bestände, die auseinander liefen — genau das sollte hier aufhören.
 *
 * Die Website hat ihre Fassung in web/server/supabase-api.js. Beide fragen
 * dasselbe ab und formen es gleich um; app/test/_gleichstand.js vergleicht
 * das Ergebnis beider Seiten und schlägt an, wenn sie abweichen.
 *
 * Die Spaltennamen folgen SUPABASE_SCHEMA.sql bis SUPABASE_SCHEMA_6. Sie frei
 * zu erfinden führt dazu, dass jede Abfrage still fehlschlägt.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Chat,
  Clip,
  Comment,
  Community,
  Contact,
  FriendPin,
  Hashtag,
  Insight,
  InsightStreak,
  Message,
  Mitteilung,
  Place,
  Post,
  Profile,
  Sichtbarkeit,
  Sound,
  Spende,
  Story,
  Umfrage,
  User,
  Video,
} from '../types';

/** Die Oberfläche erkennt einen selbst an der Kennung „me". */
export const ICH = 'me';

const PROFIL_SPALTEN =
  'id, name, handle, initials, color, phone, privat, about, bio, link, status,' +
  ' highlights, playlists, spende, live, followers_basis, following_basis, beitraege_basis';

const BEITRAG_SPALTEN =
  'id, user_id, kind, format, title, description, location, music, media_url,' +
  ' thumbnail_url, duration, tags, views, zuschauer, untertitel, kapitel,' +
  ' likes_basis, shares_basis, comments_basis, created_at,' +
  ' post_likes(count), comments(count), shares(count)';

// ============================================================================
// Zeit
// ============================================================================

/**
 * Aus „vor wie langer Zeit" wird der Text, den der Prototyp zeigt.
 *
 * Gespeichert ist immer der Zeitpunkt, nie der Text. Sonst stünde in einem
 * halben Jahr noch „vor 2 Tagen" an einem uralten Beitrag.
 */
export function zeitText(zeitpunkt?: string | null): string {
  if (!zeitpunkt) return '';
  const minuten = Math.max(0, Math.floor((Date.now() - new Date(zeitpunkt).getTime()) / 60000));
  if (minuten < 1) return 'gerade eben';
  if (minuten < 60) return `vor ${minuten} min`;
  const stunden = Math.floor(minuten / 60);
  if (stunden < 24) return `vor ${stunden} h`;
  const tage = Math.floor(stunden / 24);
  if (tage === 1) return 'vor 1 Tag';
  if (tage < 7) return `vor ${tage} Tagen`;
  const wochen = Math.floor(tage / 7);
  if (wochen < 5) return `vor ${wochen} W`;
  return `vor ${Math.floor(tage / 30)} M`;
}

/** Uhrzeit für die Chatliste: heute „14:32", gestern „Gestern", davor „Mo". */
export function chatZeit(zeitpunkt?: string | null): string {
  if (!zeitpunkt) return '';
  const d = new Date(zeitpunkt);
  const jetzt = new Date();
  const tageZurueck = Math.floor((jetzt.getTime() - d.getTime()) / 86400000);
  if (d.toDateString() === jetzt.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  if (tageZurueck < 2) return 'Gestern';
  if (tageZurueck < 7) return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()];
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

// ============================================================================
// Menschen
// ============================================================================

/*
 * "spende" steht als JSON in einer Textspalte — so schreibt es der Server
 * (web/server/sync-handlers.js). Beim Lesen muss daraus wieder ein Objekt
 * werden, sonst greift die Oberflaeche auf spende.titel eines Strings zu.
 *
 * Ein kaputter Eintrag darf nicht den ganzen Ladevorgang mitnehmen: dann
 * lieber nichts als ein Absturz beim Aufbau des Profils.
 */
function jsonOderNull(wert: unknown): any {
  if (!wert) return null;
  if (typeof wert === 'object') return wert;
  try {
    return JSON.parse(String(wert));
  } catch {
    return null;
  }
}

export interface PersonZahlen {
  followers: number;
  following: number;
  beitraege: number;
}

export async function ladeNutzer(
  client: SupabaseClient,
  ichId: string
): Promise<{ users: Record<string, User>; profile: Record<string, Profile> }> {
  const [{ data, error }, { data: zahlen }] = await Promise.all([
    client.from('profiles').select(PROFIL_SPALTEN).limit(500),
    client.from('profile_zahlen').select('id, followers, following, beitraege'),
  ]);
  if (error) throw error;

  const zahlenNach = new Map((zahlen ?? []).map((z: any) => [z.id, z]));
  const users: Record<string, User> = {};
  const profile: Record<string, Profile> = {};

  for (const zeile of (data ?? []) as any[]) {
    const schluessel = zeile.id === ichId ? ICH : zeile.id;
    const z = zahlenNach.get(zeile.id);

    users[schluessel] = {
      id: schluessel,
      name: zeile.name,
      handle: zeile.handle,
      status: zeile.status ?? 'offline',
      about: zeile.about ?? '',
      phone: zeile.phone ?? undefined,
      color: zeile.color ?? undefined,
    };

    profile[schluessel] = {
      userId: schluessel,
      bio: zeile.bio ?? '',
      link: zeile.link ?? '',
      spende: jsonOderNull(zeile.spende),
      posts: Number(z?.beitraege ?? zeile.beitraege_basis ?? 0),
      followers: Number(z?.followers ?? zeile.followers_basis ?? 0),
      following: Number(z?.following ?? zeile.following_basis ?? 0),
      isFollowing: false, // wird unten aus `follows` gefüllt
      highlights: zeile.highlights ?? [],
      playlists: zeile.playlists ?? [],
    };
  }

  return { users, profile };
}

export async function ladeGefolgt(client: SupabaseClient, ichId: string): Promise<string[]> {
  const { data, error } = await client.from('follows').select('followee_id').eq('follower_id', ichId);
  if (error) throw error;
  return (data ?? []).map((f: any) => f.followee_id);
}

/**
 * Wer folgt dieser Person — und wem folgt sie?
 *
 * Bis zum 02.09.2026 stand in `FollowersScreen` und `FollowingScreen` eine
 * feste Liste im Code: u1 bis u5 als Follower, u2 bis u6 als Gefolgte, bei
 * jeder Person dieselben. Auf der Website war es das Gegenstück davon —
 * `openFollowerList` las `state.users.followers`, eine Eigenschaft, die
 * niemand je gesetzt hat, und zeigte deshalb immer „Noch niemand". Die Zahl
 * über der Liste kam aus `profile_zahlen` und war echt; nur die Namen
 * darunter hatten damit nichts zu tun.
 *
 * `follows` ist für alle Angemeldeten lesbar, die Liste braucht also keinen
 * Umweg. Die eigene Kennung kommt als `ICH` zurück, weil die Bildschirme
 * ihre Nutzer unter diesem Schlüssel führen.
 */
export async function ladeFolgeListe(
  client: SupabaseClient,
  ichId: string,
  userId: string,
  art: 'follower' | 'gefolgt'
): Promise<string[]> {
  const ziel = userId === ICH ? ichId : userId;
  const [gesucht, gegeben] =
    art === 'follower' ? ['follower_id', 'followee_id'] : ['followee_id', 'follower_id'];

  const { data, error } = await client.from('follows').select(gesucht).eq(gegeben, ziel);
  if (error) throw error;

  return (data ?? []).map((f: any) => (f[gesucht] === ichId ? ICH : f[gesucht]));
}

export async function ladeKontakte(client: SupabaseClient, ichId: string): Promise<Contact[]> {
  const { data, error } = await client
    .from('contacts')
    .select('contact_id, status, is_favorite, profiles!contacts_contact_id_fkey(name, about, phone)')
    .eq('user_id', ichId);
  if (error) throw error;

  return (data ?? []).map((k: any) => ({
    id: k.contact_id,
    name: k.profiles?.name ?? '',
    status: k.status,
    about: k.profiles?.about ?? '',
    phone: k.profiles?.phone ?? undefined,
  }));
}

/**
 * Blockiert, stummgeschaltet, markierte Nachrichten, Lieblingskontakte.
 *
 * Vier Listen, die bisher nur im Arbeitsspeicher lagen und nach jedem
 * Neustart wieder leer waren — und die die Website gar nicht kannte.
 */
export async function ladeEigeneListen(client: SupabaseClient, ichId: string) {
  const [{ data: blocks }, { data: mutes }, { data: sterne }, { data: kontakte }] =
    await Promise.all([
      client.from('blocks').select('blocked_user_id').eq('user_id', ichId),
      client.from('mutes').select('muted_user_id').eq('user_id', ichId),
      client.from('message_stars').select('message_id').eq('user_id', ichId),
      client.from('contacts').select('contact_id').eq('user_id', ichId).eq('is_favorite', true),
    ]);

  return {
    blockiert: (blocks ?? []).map((b: any) => b.blocked_user_id) as string[],
    stummgeschaltet: (mutes ?? []).map((m: any) => m.muted_user_id) as string[],
    markierte: (sterne ?? []).map((s: any) => s.message_id) as string[],
    favoriten: (kontakte ?? []).map((k: any) => k.contact_id) as string[],
  };
}

export async function ladeKartenpunkte(client: SupabaseClient): Promise<FriendPin[]> {
  const { data, error } = await client.from('friend_pins').select('user_id, x, y, place, updated_at');
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.user_id,
    x: Number(p.x),
    y: Number(p.y),
    place: p.place ?? '',
    when: zeitText(p.updated_at),
  }));
}

// ============================================================================
// Chats
// ============================================================================

export async function ladeChats(
  client: SupabaseClient,
  ichId: string,
  bereich: 'messenger' | 'community' = 'messenger'
): Promise<Chat[]> {
  const { data, error } = await client
    .from('chat_members')
    .select(
      'chat_id, is_archived, is_muted, is_read, is_favorite, is_locked, notifications_off, geleert_bis,' +
        ' chats(id, name, is_group, bereich, created_at, updated_at)'
    )
    .eq('user_id', ichId);
  if (error) throw error;

  const zeilen = (data ?? []).filter(
    (z: any) => z.chats && (z.chats.bereich ?? 'messenger') === bereich
  );
  if (zeilen.length === 0) return [];

  const ids = zeilen.map((z: any) => z.chat_id);

  // Letzte Nachricht und Mitglieder in zwei Abfragen statt in zweien pro Chat.
  const [{ data: nachrichten, error: fN }, { data: mitglieder, error: fM }, { data: kontakte, error: fK }] =
    await Promise.all([
      client
        .from('messages')
        .select('id, chat_id, text, sender_id, media_type, created_at')
        .in('chat_id', ids)
        .order('created_at', { ascending: false })
        .limit(500),
      client.from('chat_members').select('chat_id, user_id').in('chat_id', ids),
      // Offene Kontaktanfragen sperren das Eingabefeld bis zur Annahme.
      // Gleiche Regel wie in web/server/supabase-api.js.
      client.from('contacts').select('contact_id, status').eq('user_id', ichId),
    ]);
  if (fN) throw fN;
  if (fM) throw fM;
  if (fK) throw fK;

  const offeneAnfrage = new Set(
    ((kontakte ?? []) as any[]).filter((k) => k.status === 'pending').map((k) => k.contact_id)
  );

  // Ein geleerter Chat zeigt auch in der Liste keine Vorschau von vorher.
  // Gleiche Regel wie in web/server/supabase-api.js.
  const strichNach = new Map<string, string | null>(
    (zeilen as any[]).map((z) => [z.chat_id, z.geleert_bis ?? null])
  );

  const letzte = new Map<string, any>();
  for (const n of (nachrichten ?? []) as any[]) {
    const strich = strichNach.get(n.chat_id);
    if (strich && new Date(n.created_at) <= new Date(strich)) continue;
    if (!letzte.has(n.chat_id)) letzte.set(n.chat_id, n);
  }
  const mitgliederNach = new Map<string, string[]>();
  for (const m of (mitglieder ?? []) as any[]) {
    if (!mitgliederNach.has(m.chat_id)) mitgliederNach.set(m.chat_id, []);
    mitgliederNach.get(m.chat_id)!.push(m.user_id);
  }

  return zeilen
    .map((z: any): Chat & { zeitpunkt?: string; archiviert?: boolean } => {
      const vorschau = letzte.get(z.chat_id);
      const andere = (mitgliederNach.get(z.chat_id) ?? []).filter((u) => u !== ichId);
      // Bei einem Zweiergespräch ist das Gegenüber die eine andere Person.
      const gegenueber = z.chats.is_group ? undefined : andere[0];
      return {
        id: z.chats.id,
        name: z.chats.name,
        userId: gegenueber,
        requestState: gegenueber && offeneAnfrage.has(gegenueber) ? 'pending' : 'accepted',
        isGroup: Boolean(z.chats.is_group),
        memberIds: z.chats.is_group ? andere : undefined,
        preview: vorschau?.text ?? '',
        previewMedia: vorschau?.media_type ?? undefined,
        time: chatZeit(vorschau?.created_at ?? z.chats.updated_at),
        unreadCount: z.is_read ? 0 : 1,
        muted: Boolean(z.is_muted),
        archiviert: Boolean(z.is_archived),
        favorit: Boolean(z.is_favorite),
        zeitpunkt: vorschau?.created_at ?? z.chats.updated_at,
      };
    })
    .sort(
      (a, b) => new Date(b.zeitpunkt ?? 0).getTime() - new Date(a.zeitpunkt ?? 0).getTime()
    );
}

export async function ladeNachrichten(
  client: SupabaseClient,
  chatId: string,
  ichId: string
): Promise<Message[]> {
  // Wer den Chat geleert hat, sieht nichts von vorher — siehe
  // handleClearChat() in web/server/sync-handlers.js.
  const { data: mitgliedschaft } = await client
    .from('chat_members')
    .select('geleert_bis')
    .eq('chat_id', chatId)
    .eq('user_id', ichId)
    .maybeSingle();
  const strich = (mitgliedschaft as any)?.geleert_bis ?? null;

  let abfrage = client
    .from('messages')
    .select(
      'id, chat_id, sender_id, text, media_url, media_type, created_at, read_at,' +
        ' reply_to, quote_of, forwarded_from, edited_at, deleted_at, file_name, file_size,' +
        ' shared_post_id, posts(id, kind, title, description, profiles!posts_user_id_fkey(name)),' +
        ' place_id, places(id, name, adresse, koordinaten, x, y),' +
        ' contact_user_id, profiles!messages_contact_user_id_fkey(id, name, handle)'
    )
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (strich) abfrage = abfrage.gt('created_at', strich);

  const { data, error } = await abfrage;
  if (error) throw error;

  const zeilen = (data ?? []) as any[];

  /*
   * Bezug, Reaktionen und Namen in einem Zug nachladen.
   *
   * Die naheliegende Fassung waere, je Nachricht mit Bezug eine weitere
   * Abfrage zu stellen. Bei einem Chat mit vielen Antworten waeren das
   * hunderte — der Chat braeuchte Sekunden zum Oeffnen. Deshalb einmal alles
   * auf einmal.
   */
  const bezugIds = [
    ...new Set(
      zeilen.flatMap((n) => [n.reply_to, n.quote_of]).filter(Boolean) as string[]
    ),
  ];
  const bezugZeilen: any[] = [];
  if (bezugIds.length) {
    const { data: gefunden } = await client
      .from('messages')
      .select('id, text, sender_id')
      .in('id', bezugIds);
    bezugZeilen.push(...((gefunden ?? []) as any[]));
  }

  const reaktionen = new Map<string, { userId: string; emoji: string }[]>();
  if (zeilen.length) {
    const { data: reakZeilen } = await client
      .from('message_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', zeilen.map((n) => n.id));
    for (const r of (reakZeilen ?? []) as any[]) {
      const liste = reaktionen.get(r.message_id) ?? [];
      liste.push({ userId: r.user_id === ichId ? ICH : r.user_id, emoji: r.emoji });
      reaktionen.set(r.message_id, liste);
    }
  }

  /*
   * Die Namen fuer beides — Bezugszeilen und Weiterleitungen — in einer
   * einzigen Abfrage. Ein Join ueber den Fremdschluesselnamen waere kuerzer,
   * bricht aber still, sobald der Schluessel anders heisst als vermutet: die
   * Abfrage schlaegt fehl und der Chat sieht aus, als haette er keine
   * Nachrichten. Diese Fassung kann das nicht.
   */
  const weiterIds = zeilen.map((n) => n.forwarded_from).filter(Boolean) as string[];
  const namenIds = [...new Set([...weiterIds, ...bezugZeilen.map((b) => b.sender_id)])];
  const namen = new Map<string, string>();
  if (namenIds.length) {
    const { data: profile } = await client.from('profiles').select('id, name').in('id', namenIds);
    for (const p of (profile ?? []) as any[]) namen.set(p.id, p.name);
  }

  const bezug = new Map<string, { text: string; autor: string }>();
  for (const b of bezugZeilen) {
    bezug.set(b.id, {
      text: b.text ?? '',
      autor: b.sender_id === ichId ? 'Du' : namen.get(b.sender_id) ?? '',
    });
  }

  return zeilen.map((n: any) => ({
    id: n.id,
    chatId: n.chat_id,
    senderId: n.sender_id === ichId ? ICH : n.sender_id,
    text: n.text,
    time: chatZeit(n.created_at),
    media: n.media_type ?? undefined,
    read: Boolean(n.read_at),
    // Die Karte im Chat für einen geteilten Beitrag. Gleiche Regel wie in
    // web/server/supabase-api.js.
    geteilt: n.posts
      ? {
          id: n.posts.id,
          art: n.posts.kind === 'post' ? ('post' as const) : ('video' as const),
          autor: n.posts.profiles?.name ?? '',
          titel: n.posts.title || n.posts.description || '',
        }
      : undefined,
    // Angehängter Standort und Kontakt — gleiche Regel wie in
    // web/server/supabase-api.js.
    standort: n.places
      ? {
          name: n.places.name,
          adresse: n.places.adresse ?? '',
          koordinaten: n.places.koordinaten ?? '',
          x: Number(n.places.x ?? 50),
          y: Number(n.places.y ?? 50),
        }
      : undefined,
    kontakt: n.profiles
      ? { id: n.profiles.id, name: n.profiles.name, handle: n.profiles.handle }
      : undefined,
    // Die Werkzeuge aus dem Handbuch — siehe Message in types/index.ts.
    antwortAuf: n.reply_to && bezug.has(n.reply_to)
      ? { id: n.reply_to, ...bezug.get(n.reply_to)! }
      : undefined,
    zitat: n.quote_of && bezug.has(n.quote_of)
      ? { id: n.quote_of, ...bezug.get(n.quote_of)! }
      : undefined,
    weitergeleitetVon: n.forwarded_from ? namen.get(n.forwarded_from) : undefined,
    bearbeitet: Boolean(n.edited_at),
    zurueckgenommen: Boolean(n.deleted_at),
    reaktionen: reaktionen.get(n.id),
    datei: n.file_name ? { name: n.file_name, groesse: Number(n.file_size ?? 0) } : undefined,
  }));
}

// ============================================================================
// Storys
// ============================================================================

export async function ladeStorys(client: SupabaseClient, ichId: string): Promise<Story[]> {
  const { data, error } = await client
    .from('stories')
    .select('id, user_id, media_url, media_type, caption, created_at, profiles!stories_user_id_fkey(name)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  const storys = (data ?? []) as any[];
  if (storys.length === 0) return [];

  const [{ data: gesehen }, { data: gemocht }] = await Promise.all([
    client.from('story_views').select('story_id').eq('user_id', ichId),
    client.from('story_likes').select('story_id').eq('user_id', ichId),
  ]);
  const gesehenIds = new Set((gesehen ?? []).map((g: any) => g.story_id));
  const gemochtIds = new Set((gemocht ?? []).map((g: any) => g.story_id));

  const liste: Story[] = storys.map((s) => ({
    id: s.id,
    userId: s.user_id === ichId ? ICH : s.user_id,
    // Die eigene Kachel heisst "Deine Story", nicht wie man selbst heisst —
    // so steht es im Prototypen. Siehe web/server/supabase-api.js.
    name: s.user_id === ichId ? 'Deine Story' : (s.profiles?.name ?? '').split(' ')[0],
    own: s.user_id === ichId,
    viewed: gesehenIds.has(s.id),
    liked: gemochtIds.has(s.id),
    caption: s.caption ?? '',
    mediaUri: s.media_url ?? undefined,
  }));

  /*
   * Links steht immer die eigene Kachel — auch ohne eigene Story. Dann traegt
   * sie ein Plus und oeffnet die Kamera. Storys leben 24 Stunden; ohne diese
   * Kachel waere der Weg zur Kamera danach weg.
   * Gleiche Regel wie in web/server/supabase-api.js.
   */
  const eigene = liste.filter((s) => s.own);
  const fremde = liste.filter((s) => !s.own);

  if (eigene.length === 0) {
    eigene.push({
      id: 'eigene',
      userId: ICH,
      name: 'Deine Story',
      own: true,
      viewed: false,
      liked: false,
      caption: '',
      mediaUri: undefined,
    } as Story);
  }

  return [...eigene, ...fremde];
}

// ============================================================================
// Beiträge, Videos, Clips
// ============================================================================

interface RohBeitrag {
  id: string;
  userId: string;
  kind: 'post' | 'reel' | 'clip';
  format: 'standard' | '360' | 'live';
  title: string;
  description: string;
  location: string;
  music: string;
  duration: string;
  tags: string[];
  views: number;
  zuschauer?: number;
  untertitel: boolean;
  kapitel: { bei: number; titel: string }[];
  age: string;
  likes: number;
  comments: number;
  shares: number;
  liked: boolean;
  saved: boolean;
  reposted: boolean;
  notify: boolean;
  mediaUri?: string;
  standbild?: string;
}

/**
 * Ein Video ist kein eigener Tabelleneintrag, sondern ein Beitrag mit
 * kind = 'reel' (Hochformat) oder 'clip' (Querformat).
 *
 * Likes und Kommentare werden gezählt, nicht gespeichert — auf einem Sockel,
 * der die Zahl aus den Beispielinhalten trägt. Ein neu angelegter Beitrag hat
 * Sockel 0, dort ist jede Zahl vollständig echt.
 */
export async function ladeBeitraege(
  client: SupabaseClient,
  ichId: string
): Promise<{ posts: Post[]; videos: Video[]; clips: Clip[] }> {
  const { data, error } = await client
    .from('posts')
    .select(BEITRAG_SPALTEN)
    /*
     * "Spaeter posten": ein Beitrag mit einem Zeitpunkt in der Zukunft ist
     * angelegt, aber noch nicht sichtbar. Ohne diesen Filter erschiene er
     * sofort — und die ganze Einstellung waere wirkungslos.
     */
    .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;

  const zeilen = (data ?? []) as any[];
  const ids = zeilen.map((b) => b.id);

  const leer = { data: [] as any[] };
  const [{ data: likes }, { data: gespeichert }, { data: geteilt }, { data: hinweise }] =
    ids.length === 0
      ? [leer, leer, leer, leer]
      : await Promise.all([
          client.from('post_likes').select('post_id').eq('user_id', ichId).in('post_id', ids),
          client.from('saves').select('post_id').eq('user_id', ichId).in('post_id', ids),
          client.from('reposts').select('post_id').eq('user_id', ichId).in('post_id', ids),
          client.from('post_notify').select('post_id').eq('user_id', ichId).in('post_id', ids),
        ]);

  const gemocht = new Set((likes ?? []).map((l: any) => l.post_id));
  const gemerkt = new Set((gespeichert ?? []).map((s: any) => s.post_id));
  const repostet = new Set((geteilt ?? []).map((r: any) => r.post_id));
  const benachrichtigt = new Set((hinweise ?? []).map((h: any) => h.post_id));

  const roh: RohBeitrag[] = zeilen.map((b) => ({
    id: b.id,
    userId: b.user_id === ichId ? ICH : b.user_id,
    kind: b.kind,
    format: b.format ?? 'standard',
    title: b.title ?? '',
    description: b.description ?? '',
    location: b.location ?? '',
    music: b.music ?? '',
    duration: b.duration ?? '',
    tags: b.tags ?? [],
    views: Number(b.views ?? 0),
    zuschauer: b.zuschauer ?? undefined,
    untertitel: Boolean(b.untertitel),
    kapitel: b.kapitel ?? [],
    age: zeitText(b.created_at),
    likes: Number(b.likes_basis ?? 0) + (b.post_likes?.[0]?.count ?? 0),
    comments: Number(b.comments_basis ?? 0) + (b.comments?.[0]?.count ?? 0),
    // Gezaehlt wie Likes und Kommentare: Sockel plus die wirklich
    // eingetragenen Weiterleitungen. Vorher stand hier nur der Sockel —
    // wer in der App etwas teilte, sah die Zahl nie steigen, waehrend sie
    // auf der Website hochging (web/server/supabase-api.js zaehlt beides).
    shares: Number(b.shares_basis ?? 0) + (b.shares?.[0]?.count ?? 0),
    liked: gemocht.has(b.id),
    saved: gemerkt.has(b.id),
    reposted: repostet.has(b.id),
    notify: benachrichtigt.has(b.id),
    mediaUri: b.media_url ?? undefined,
    standbild: b.thumbnail_url ?? undefined,
  }));

  return {
    posts: roh
      .filter((b) => b.kind === 'post')
      .map((b) => ({
        id: b.id,
        userId: b.userId,
        location: b.location,
        music: b.music,
        description: b.description,
        likedBy: '',
        likes: b.likes,
        comments: b.comments,
        liked: b.liked,
        saved: b.saved,
        following: false, // kommt aus `gefolgt`, nicht vom Beitrag
        notify: b.notify,
        reposts: b.shares,
        reposted: b.reposted,
        mediaUri: b.mediaUri,
        standbild: b.standbild,
        tags: b.tags,
      })),
    videos: roh
      .filter((b) => b.kind === 'reel')
      .map((b) => ({
        id: b.id,
        userId: b.userId,
        description: b.description,
        location: b.location,
        music: b.music,
        likes: b.likes,
        comments: b.comments,
        shares: b.shares,
        liked: b.liked,
        saved: b.saved,
        reposted: b.reposted,
        notify: b.notify,
        mediaUri: b.mediaUri,
        standbild: b.standbild,
        tags: b.tags,
      })),
    clips: roh
      .filter((b) => b.kind === 'clip')
      .map((b) => ({
        id: b.id,
        userId: b.userId,
        title: b.title || b.description,
        duration: b.duration,
        views: b.views,
        age: b.age,
        art: b.format,
        zuschauer: b.zuschauer,
        kapitel: b.kapitel.length > 0 ? b.kapitel : undefined,
        untertitel: b.untertitel,
        location: b.location,
        music: b.music,
        tags: b.tags,
        description: b.description,
        likes: b.likes,
        comments: b.comments,
        liked: b.liked,
        saved: b.saved,
        reposted: b.reposted,
        mediaUri: b.mediaUri,
        standbild: b.standbild,
      })),
  };
}

export async function ladeKommentare(
  client: SupabaseClient,
  ichId: string,
  beitragId: string
): Promise<Comment[]> {
  const { data, error } = await client
    .from('comments')
    .select('id, post_id, user_id, text, created_at, comment_likes(count)')
    .eq('post_id', beitragId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;

  const ids = (data ?? []).map((k: any) => k.id);
  const { data: eigene } =
    ids.length === 0
      ? { data: [] as any[] }
      : await client.from('comment_likes').select('comment_id').eq('user_id', ichId).in('comment_id', ids);
  const gemocht = new Set((eigene ?? []).map((l: any) => l.comment_id));

  return (data ?? []).map((k: any) => ({
    id: k.id,
    userId: k.user_id === ichId ? ICH : k.user_id,
    text: k.text,
    time: chatZeit(k.created_at),
    likes: k.comment_likes?.[0]?.count ?? 0,
    liked: gemocht.has(k.id),
  }));
}

// ============================================================================
// Communitys
// ============================================================================

export async function ladeCommunities(client: SupabaseClient, ichId: string): Promise<Community[]> {
  const { data, error } = await client
    .from('communities')
    .select(
      'id, name, topic, bio, link, visibility, created_by, mitglieder_basis, created_at,' +
        ' community_members(count), community_channels(id, slug, name, topics, position)'
    )
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;

  const { data: meine } = await client
    .from('community_members')
    .select('community_id, is_muted')
    .eq('user_id', ichId);
  const beigetreten = new Set((meine ?? []).map((m: any) => m.community_id));
  // Stumm ist eine Eigenschaft der Mitgliedschaft, nicht der Community.
  const stumme = new Set((meine ?? []).filter((m: any) => m.is_muted).map((m: any) => m.community_id));

  return (data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    topic: c.topic ?? '',
    bio: c.bio ?? '',
    link: c.link ?? '',
    visibility: c.visibility,
    members: Number(c.mitglieder_basis ?? 0) + (c.community_members?.[0]?.count ?? 0),
    joined: beigetreten.has(c.id),
    stumm: stumme.has(c.id),
    unreadCount: 0,
    // Eine selbst angelegte Community lässt sich nicht verlassen — sie stünde
    // sonst ohne Besitzer da.
    eigen: c.created_by === ichId,
    unterthemen: (c.community_channels ?? [])
      .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
      .map((k: any) => ({ id: k.id, name: k.name, themen: k.topics ?? [] })),
  }));
}

export async function ladeKanalNachrichten(
  client: SupabaseClient,
  ichId: string,
  kanalId: string
): Promise<Message[]> {
  const { data, error } = await client
    .from('community_channel_messages')
    .select('id, channel_id, sender_id, text, created_at')
    .eq('channel_id', kanalId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;

  return (data ?? []).map((m: any) => ({
    id: m.id,
    chatId: m.channel_id,
    senderId: m.sender_id === ichId ? ICH : m.sender_id,
    text: m.text,
    time: chatZeit(m.created_at),
  }));
}

// ============================================================================
// Suche: Hashtags, Sounds, Standorte
// ============================================================================

export async function ladeHashtags(client: SupabaseClient): Promise<Hashtag[]> {
  const { data, error } = await client
    .from('hashtags_mit_anzahl')
    .select('tag, beitraege')
    .order('beitraege', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((h: any) => ({ tag: h.tag, posts: Number(h.beitraege) }));
}

export async function ladeSounds(client: SupabaseClient): Promise<Sound[]> {
  const { data, error } = await client
    .from('sounds')
    .select('id, title, artist, uses, dauer, lyrics')
    .order('uses', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((s: any) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    uses: Number(s.uses ?? 0),
    dauer: s.dauer ?? '',
    // null heißt instrumental. Die Seite sagt das dann auch, statt
    // „Instrumental" als Liedzeile auszugeben.
    lyrics: s.lyrics,
  }));
}

export async function ladeStandorte(client: SupabaseClient): Promise<Place[]> {
  const { data, error } = await client
    .from('places')
    .select('id, name, ort, adresse, koordinaten, x, y, beitraege_basis');
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    ort: p.ort ?? '',
    adresse: p.adresse ?? '',
    koordinaten: p.koordinaten ?? '',
    x: Number(p.x),
    y: Number(p.y),
    posts: Number(p.beitraege_basis ?? 0),
  }));
}

// ============================================================================
// Mitteilungen
// ============================================================================

export async function ladeMitteilungen(
  client: SupabaseClient,
  ichId: string
): Promise<Mitteilung[]> {
  const { data, error } = await client
    .from('notifications')
    .select('id, actor_id, art, bereich, target_type, target_id, text, read_at, created_at')
    .eq('user_id', ichId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  return (data ?? []).map((b: any) => ({
    id: b.id,
    bereich: b.bereich,
    art: b.art,
    userId: b.actor_id,
    ziel: { art: b.target_type, id: b.target_id },
    minuten: Math.max(0, Math.floor((Date.now() - new Date(b.created_at).getTime()) / 60000)),
    gelesen: Boolean(b.read_at),
  }));
}

// ============================================================================
// Alles auf einmal
// ============================================================================

export interface AlleDaten {
  users: Record<string, User>;
  profile: Record<string, Profile>;
  contacts: Contact[];
  chats: Chat[];
  archivierteChats: Chat[];
  communityChats: Chat[];
  stories: Story[];
  posts: Post[];
  videos: Video[];
  clips: Clip[];
  communities: Community[];
  hashtags: Hashtag[];
  sounds: Sound[];
  places: Place[];
  friendPins: FriendPin[];
  mitteilungen: Mitteilung[];
  gefolgt: string[];
  blockiert: string[];
  stummgeschaltet: string[];
  markierte: string[];
  favoriten: string[];
  /** Eigenes Profil, fertig für die Bearbeitungsmaske. */
  eigenesProfil: { name: string; bio: string; link: string };
  highlights: string[];
  playlists: string[];
  /** Die eigene Spendenaktion — null, solange keine läuft. */
  spende: Spende | null;

  /*
   * Insight Time und was dazugehört. Nicht zu verwechseln mit den
   * „Insights" im Einstellungsmenü — das ist Statistik zum eigenen Profil.
   */
  insights: Insight[];
  /** Tage in Folge, je Person. */
  insightStreaks: Record<string, InsightStreak>;
  /** Die feste Empfängerliste für Insights. */
  insightZiele: string[];
  /** Sichtbarkeitsstufen je Bereich, mit Ausnahmelisten. */
  sichtbarkeit: Record<string, Sichtbarkeit>;

  ichId: string;
  geladen: string;
}

/**
 * Lädt alles, was die App beim Start braucht — in einem Rutsch statt in
 * fünfzehn nacheinander. Auf einem Handy im Mobilfunknetz ist das der
 * Unterschied zwischen einer und acht Sekunden.
 */
export async function ladeAlles(client: SupabaseClient, ichId: string): Promise<AlleDaten> {
  const [
    { users, profile },
    contacts,
    chats,
    communityChats,
    stories,
    beitraege,
    communities,
    hashtags,
    sounds,
    places,
    friendPins,
    mitteilungen,
    gefolgt,
    eigeneListen,
    insights,
    insightStreaks,
    insightZiele,
    sichtbarkeit,
  ] = await Promise.all([
    ladeNutzer(client, ichId),
    ladeKontakte(client, ichId),
    ladeChats(client, ichId, 'messenger'),
    ladeChats(client, ichId, 'community'),
    ladeStorys(client, ichId),
    ladeBeitraege(client, ichId),
    ladeCommunities(client, ichId),
    ladeHashtags(client),
    ladeSounds(client),
    ladeStandorte(client),
    ladeKartenpunkte(client),
    ladeMitteilungen(client, ichId),
    ladeGefolgt(client, ichId),
    ladeEigeneListen(client, ichId),
    ladeInsights(client, ichId),
    ladeInsightStreaks(client, ichId),
    ladeInsightZiele(client, ichId),
    ladeSichtbarkeit(client, ichId),
  ]);

  // „Folge ich?" gehört an die Person, nicht an den einzelnen Beitrag. Vorher
  // hing es am Beitrag: wer im Feed auf „Folgen" tippte, änderte damit nur
  // diesen einen — ein zweiter Beitrag derselben Person zeigte weiter
  // „Folgen".
  const folgeIch = new Set(gefolgt);
  for (const p of Object.values(profile)) p.isFollowing = folgeIch.has(p.userId);
  for (const p of beitraege.posts) p.following = folgeIch.has(p.userId);

  const alleChats = chats as (Chat & { archiviert?: boolean })[];

  return {
    users,
    profile,
    contacts,
    chats: alleChats.filter((c) => !c.archiviert),
    archivierteChats: alleChats.filter((c) => c.archiviert),
    communityChats,
    stories,
    posts: beitraege.posts,
    videos: beitraege.videos,
    clips: beitraege.clips,
    communities,
    hashtags,
    sounds,
    places,
    friendPins,
    mitteilungen,
    gefolgt,
    ...eigeneListen,
    eigenesProfil: {
      name: users[ICH]?.name ?? '',
      bio: profile[ICH]?.bio ?? '',
      link: profile[ICH]?.link ?? '',
    },
    highlights: profile[ICH]?.highlights ?? [],
    playlists: profile[ICH]?.playlists ?? [],
    spende: (profile[ICH] as { spende?: Spende | null } | undefined)?.spende ?? null,
    insights,
    insightStreaks,
    insightZiele,
    sichtbarkeit,
    ichId,
    geladen: new Date().toISOString(),
  };
}

// ============================================================================
// Was das Handbuch verlangt — nachgetragen am 01.09.2026
// ============================================================================

/**
 * Die eigenen Insight Times.
 *
 * Gibt je Person die Tage in Folge zurück und dazu, wer heute schon gesendet
 * hat. Das zweite braucht die Chatliste, um die Zahl grau zu zeigen, solange
 * der Tag noch nicht vollständig ist — sonst sieht eine Kette, die gleich
 * reißt, genauso aus wie eine sichere.
 */
export async function ladeInsightStreaks(
  client: SupabaseClient,
  ichId: string
): Promise<Record<string, InsightStreak>> {
  const { data, error } = await client
    .from('insight_streaks')
    .select('user_a, user_b, tage, letzter_tag, a_gesendet, b_gesendet')
    .or(`user_a.eq.${ichId},user_b.eq.${ichId}`);
  if (error) throw error;

  const heute = new Date().toISOString().slice(0, 10);
  const raus: Record<string, InsightStreak> = {};

  for (const z of (data ?? []) as any[]) {
    const ichBinA = z.user_a === ichId;
    const partner = ichBinA ? z.user_b : z.user_a;
    const meins = ichBinA ? z.a_gesendet : z.b_gesendet;
    const seins = ichBinA ? z.b_gesendet : z.a_gesendet;

    /*
     * Eine Kette, deren letzter vollständiger Tag vor gestern lag, ist
     * gerissen — auch wenn in der Zeile noch eine Zahl steht. Die Datenbank
     * setzt sie erst beim nächsten Senden zurück; bis dahin würde die Liste
     * eine Zahl zeigen, die es nicht mehr gibt.
     */
    const gestern = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const lebt = z.letzter_tag === heute || z.letzter_tag === gestern;

    raus[partner] = {
      userId: partner,
      tage: lebt ? z.tage ?? 0 : 0,
      heuteGesendet: meins === heute,
      heuteEmpfangen: seins === heute,
    };
  }
  return raus;
}

/** Die feste Empfängerliste für Insights. */
export async function ladeInsightZiele(
  client: SupabaseClient,
  ichId: string
): Promise<string[]> {
  const { data, error } = await client
    .from('insight_targets')
    .select('target_id')
    .eq('user_id', ichId);
  if (error) throw error;
  return ((data ?? []) as any[]).map((z) => z.target_id);
}

/**
 * Empfangene Insights, die noch offen sind.
 *
 * Abgelaufene und bei Einmalansicht schon geöffnete bleiben draußen — sie
 * wären nur eine Zeile, die beim Antippen nichts zeigt.
 */
export async function ladeInsights(
  client: SupabaseClient,
  ichId: string
): Promise<Insight[]> {
  const { data, error } = await client
    .from('insight_recipients')
    .select(
      'insight_id, gesehen_at,' +
        ' insights(id, sender_id, media_url, media_type, filter, dauer, einmal, gespeichert, ablauf_at, created_at)'
    )
    .eq('user_id', ichId)
    .order('insight_id', { ascending: false })
    .limit(200);
  if (error) throw error;

  const jetzt = Date.now();
  return ((data ?? []) as any[])
    .filter((z) => z.insights)
    .filter((z) => !z.insights.ablauf_at || new Date(z.insights.ablauf_at).getTime() > jetzt)
    .filter((z) => !(z.insights.einmal && z.gesehen_at))
    .map((z) => ({
      id: z.insights.id,
      senderId: z.insights.sender_id === ichId ? ICH : z.insights.sender_id,
      mediaUrl: z.insights.media_url,
      mediaTyp: z.insights.media_type,
      filter: z.insights.filter ?? '',
      dauer: z.insights.dauer ?? 0,
      einmal: z.insights.einmal,
      gespeichert: z.insights.gespeichert,
      zeit: zeitText(z.insights.created_at),
      gesehen: Boolean(z.gesehen_at),
    }));
}

/**
 * Die Umfragen zu einer Reihe von Trägern — Beiträge, Storys oder Kanäle.
 *
 * Stimmen und eigene Wahl kommen mit, weil eine Umfrage ohne beides nur eine
 * Liste von Sätzen ist.
 */
export async function ladeUmfragen(
  client: SupabaseClient,
  ichId: string,
  art: 'post' | 'story' | 'channel',
  traegerIds: string[]
): Promise<Record<string, Umfrage>> {
  if (!traegerIds.length) return {};

  const { data, error } = await client
    .from('polls')
    /*
     * "!poll_id" ist noetig, nicht Zierde. poll_votes zeigt auf polls UND auf
     * poll_options; PostgREST liest daraus einen zweiten, indirekten Weg
     * zwischen den beiden Tabellen und weigert sich dann mit "more than one
     * relationship was found". Der Hinweis nennt die Spalte, ueber die
     * verbunden werden soll — die Spalte und nicht den Namen des Fremd-
     * schluessels, denn ein umbenannter Constraint waere hier ein stiller
     * Ausfall aller Umfragen.
     */
    .select('id, traeger_id, frage, mehrfach, ende_at, poll_options!poll_id(id, text, position)')
    .eq('traeger_art', art)
    .in('traeger_id', traegerIds);
  if (error) throw error;

  const umfragen = (data ?? []) as any[];
  if (!umfragen.length) return {};

  const { data: stimmen } = await client
    .from('poll_votes')
    .select('poll_id, option_id, user_id')
    .in('poll_id', umfragen.map((u) => u.id));

  const proOption = new Map<string, number>();
  const eigene = new Set<string>();
  for (const s of ((stimmen ?? []) as any[])) {
    proOption.set(s.option_id, (proOption.get(s.option_id) ?? 0) + 1);
    if (s.user_id === ichId) eigene.add(s.option_id);
  }

  const raus: Record<string, Umfrage> = {};
  for (const u of umfragen) {
    const antworten = (u.poll_options ?? [])
      .slice()
      .sort((a: any, b: any) => a.position - b.position)
      .map((o: any) => ({
        id: o.id,
        text: o.text,
        stimmen: proOption.get(o.id) ?? 0,
        gewaehlt: eigene.has(o.id),
      }));

    raus[u.traeger_id] = {
      id: u.id,
      frage: u.frage,
      mehrfach: u.mehrfach,
      endeAt: u.ende_at,
      beendet: Boolean(u.ende_at && new Date(u.ende_at) < new Date()),
      antworten,
      gesamt: antworten.reduce((s: number, a: any) => s + a.stimmen, 0),
    };
  }
  return raus;
}

/**
 * Die eigenen Sichtbarkeitsstufen samt Ausnahmelisten.
 *
 * Fehlt ein Bereich, gilt „alle" — so verhalten sich Bestandskonten wie
 * vorher, statt nach dem Einspielen plötzlich alles zu verbergen.
 */
export async function ladeSichtbarkeit(
  client: SupabaseClient,
  ichId: string
): Promise<Record<string, Sichtbarkeit>> {
  const [{ data: stufen }, { data: ausnahmen }] = await Promise.all([
    client.from('visibility_settings').select('bereich, stufe').eq('user_id', ichId),
    client.from('visibility_exceptions').select('bereich, target_id').eq('user_id', ichId),
  ]);

  const raus: Record<string, Sichtbarkeit> = {};
  for (const s of ((stufen ?? []) as any[])) {
    raus[s.bereich] = { stufe: s.stufe, ausnahmen: [] };
  }
  for (const a of ((ausnahmen ?? []) as any[])) {
    if (!raus[a.bereich]) raus[a.bereich] = { stufe: 'alle', ausnahmen: [] };
    raus[a.bereich].ausnahmen.push(a.target_id);
  }
  return raus;
}

/**
 * Die „Insights" aus den Einstellungen — Statistik zum eigenen Content.
 *
 * Nicht zu verwechseln mit einem *Insight* (Foto an ausgewaehlte Personen).
 * Das Handbuch nennt beides so; hier ist die Statistik gemeint: Aufrufe und
 * Reichweite, nur fuer einen selbst sichtbar.
 *
 * Bis zum 02.09.2026 standen hier in App und Website dieselben vier
 * erfundenen Zahlen im Code — 340 Follower, 1.284 Aufrufe, 46 neue Follower.
 * Sie standen unter einer Ueberschrift, die Auskunft verspricht, und waren
 * bei jedem Konto gleich. Jetzt kommt jede der vier aus der Datenbank.
 *
 * „Neue Follower (30 Tage)" liest `follows.created_at`; die Aufrufe sind die
 * Summe ueber die eigenen Beitraege. Ein Zeitfenster gibt es dort nicht —
 * `posts.views` ist ein Zaehlerstand, kein Verlauf. Deshalb heisst die Zeile
 * „Aufrufe gesamt" und nicht mehr „Aufrufe (30 Tage)": lieber eine ehrliche
 * Zahl als eine, die einen Zeitraum behauptet, den niemand misst.
 */
export interface Statistik {
  beitraege: number;
  follower: number;
  /** Summe der Aufrufe über alle eigenen Beiträge. Ein Zählerstand. */
  aufrufe: number;
  follower30: number;
  follower7: number;
  /** Wie oft das eigene Profil aufgerufen wurde — mit Verlauf. */
  profilaufrufe: number;
  profilaufrufe30: number;
  profilaufrufe7: number;
  /** Wie viele verschiedene Menschen in dreißig Tagen. */
  besucher30: number;
}

export async function ladeStatistik(
  client: SupabaseClient,
  ichId: string
): Promise<Statistik> {
  const { data, error } = await client
    .from('profil_statistik')
    .select('*')
    .eq('id', ichId)
    .maybeSingle();
  if (error) throw error;

  const z = (wert: unknown) => Number(wert ?? 0);
  return {
    beitraege: z((data as any)?.beitraege),
    follower: z((data as any)?.follower),
    aufrufe: z((data as any)?.aufrufe_beitraege),
    follower30: z((data as any)?.follower_30),
    follower7: z((data as any)?.follower_7),
    profilaufrufe: z((data as any)?.profilaufrufe),
    profilaufrufe30: z((data as any)?.profilaufrufe_30),
    profilaufrufe7: z((data as any)?.profilaufrufe_7),
    besucher30: z((data as any)?.besucher_30),
  };
}

/**
 * Schalter und Auswahlen aus den Einstellungen.
 *
 * Bis zum 03.09.2026 lagen sie im Bildschirmzustand — neun Schalter und
 * achtzehn Auswahlen, weg beim nächsten Start. Im Code stand sogar der
 * Grund: „dauerhaft speichern kann erst das Backend". Das gibt es jetzt.
 *
 * Zurück kommt nur, was wirklich gesetzt wurde. Was fehlt, gilt als
 * Auslieferungszustand — sonst müsste jede neue Einstellung erst für alle
 * bestehenden Konten nachgetragen werden.
 */
export async function ladeEinstellungen(
  client: SupabaseClient,
  ichId: string
): Promise<Record<string, string>> {
  const { data, error } = await client
    .from('user_settings')
    .select('schluessel, wert')
    .eq('user_id', ichId);
  if (error) throw error;

  const raus: Record<string, string> = {};
  for (const zeile of (data ?? []) as any[]) raus[zeile.schluessel] = zeile.wert;
  return raus;
}

/** Der eigene Bann-Verlauf — mit Grund, wie das Handbuch es verlangt. */
export async function ladeBanne(client: SupabaseClient, ichId: string) {
  const { data, error } = await client
    .from('profile_bans')
    .select('id, bereich, grund, ausloeser, von_at, bis_at, aufgehoben')
    .eq('user_id', ichId)
    .order('von_at', { ascending: false });
  if (error) throw error;

  const jetzt = Date.now();
  return ((data ?? []) as any[]).map((b) => ({
    id: b.id,
    bereich: b.bereich as string,
    grund: b.grund as string,
    ausloeser: (b.ausloeser ?? '') as string,
    von: zeitText(b.von_at),
    bis: b.bis_at ? zeitText(b.bis_at) : null,
    laeuft:
      !b.aufgehoben && (!b.bis_at || new Date(b.bis_at).getTime() > jetzt),
  }));
}

/** Die Live-Kommentarspalte zu einem Stream. */
export async function ladeStreamKommentare(client: SupabaseClient, postId: string) {
  const { data, error } = await client
    .from('stream_comments')
    .select('id, user_id, text, created_at, profiles(id, name)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;

  return ((data ?? []) as any[]).map((k) => ({
    id: k.id,
    userId: k.user_id,
    name: k.profiles?.name ?? '',
    text: k.text,
    zeit: chatZeit(k.created_at),
  }));
}

/** Push-to-Talk-Nachrichten einer Community, neueste zuerst. */
export async function ladePtt(client: SupabaseClient, communityId: string) {
  const { data, error } = await client
    .from('ptt_messages')
    .select('id, sender_id, audio_url, dauer, created_at, channel_id, profiles(id, name)')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  return ((data ?? []) as any[]).map((p) => ({
    id: p.id,
    userId: p.sender_id,
    name: p.profiles?.name ?? '',
    audioUrl: p.audio_url,
    dauer: p.dauer ?? 0,
    kanalId: p.channel_id,
    zeit: chatZeit(p.created_at),
  }));
}

/** Offene Standortanfragen in einem Chat. */
export async function ladeStandortanfragen(client: SupabaseClient, chatId: string) {
  const { data, error } = await client
    .from('location_requests')
    .select('id, sender_id, ziel_id, zustand, bis_at, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;

  return ((data ?? []) as any[]).map((a) => ({
    id: a.id,
    senderId: a.sender_id,
    zielId: a.ziel_id,
    zustand: a.zustand as 'offen' | 'angenommen' | 'abgelehnt',
    bis: a.bis_at,
    zeit: chatZeit(a.created_at),
  }));
}

/**
 * Was zu einem Stream gespendet wurde, in Cent.
 *
 * Nur die eigene Seite sieht etwas: die Regeln der Datenbank lassen eine
 * Spende nur den beiden Beteiligten sehen. Für den Sendenden ist das die
 * volle Summe, für einen Zuschauer nur das, was er selbst gegeben hat — und
 * genau so soll es sein.
 */
export async function ladeSpendenSumme(
  client: SupabaseClient,
  postId: string
): Promise<number> {
  const { data, error } = await client
    .from('donations')
    .select('betrag_cent')
    .eq('post_id', postId);
  if (error) throw error;
  return ((data ?? []) as { betrag_cent: number }[]).reduce((s, z) => s + z.betrag_cent, 0);
}
