/**
 * All Media — Lesezugriffe auf Supabase
 *
 * Jede Funktion bekommt den Client des angemeldeten Nutzers übergeben. Ohne
 * Anmeldung gibt es keinen Client, dann liefern die Funktionen null und der
 * Aufrufer bleibt bei den Beispieldaten.
 *
 * Die Spaltennamen hier folgen SUPABASE_SCHEMA.sql und SUPABASE_SCHEMA_2.sql.
 * Sie frei zu erfinden führt dazu, dass jede Abfrage still fehlschlägt.
 */

// ============================================================================
// Umformung: Datenbankzeile → Form, die die Oberfläche erwartet
// ============================================================================

function profilZuNutzer(zeile) {
  if (!zeile) return null;
  return {
    id: zeile.id,
    name: zeile.name,
    handle: zeile.handle,
    initials: zeile.initials || '',
    color: zeile.color || '',
    phone: zeile.phone || '',
    privat: Boolean(zeile.privat),
    bio: zeile.bio || '',
    link: zeile.link || '',
    status: zeile.status || 'offline',
  };
}

const PROFIL_SPALTEN = 'id, name, handle, initials, color, phone, privat, bio, link, status';

// ============================================================================
// Laden
// ============================================================================

async function ladeNutzer(client) {
  if (!client) return null;
  const { data, error } = await client.from('profiles').select(PROFIL_SPALTEN).limit(200);
  if (error) throw error;

  const nutzer = {};
  for (const zeile of data || []) nutzer[zeile.id] = profilZuNutzer(zeile);
  return nutzer;
}

async function ladeProfil(client, profilId) {
  if (!client) return null;
  const { data, error } = await client
    .from('profiles')
    .select(PROFIL_SPALTEN)
    .eq('id', profilId)
    .maybeSingle();
  if (error) throw error;
  return profilZuNutzer(data);
}

async function ladeKontakte(client, nutzerId) {
  if (!client) return null;
  const { data, error } = await client
    .from('contacts')
    .select('id, contact_id, status')
    .eq('user_id', nutzerId);
  if (error) throw error;

  return (data || []).map((k) => ({ id: k.contact_id, status: k.status }));
}

/**
 * Chats des Nutzers samt seiner persönlichen Einstellungen (archiviert,
 * stumm, gelesen, Favorit) und der letzten Nachricht als Vorschau.
 */
async function ladeChats(client, nutzerId) {
  if (!client) return null;

  const { data, error } = await client
    .from('chat_members')
    .select(
      'chat_id, is_archived, is_muted, is_read, is_favorite, chats(id, name, is_group, created_at, updated_at)'
    )
    .eq('user_id', nutzerId);
  if (error) throw error;

  const zeilen = (data || []).filter((z) => z.chats);
  if (zeilen.length === 0) return [];

  // Letzte Nachricht je Chat in einer Abfrage holen, statt pro Chat einzeln.
  const ids = zeilen.map((z) => z.chat_id);
  const { data: nachrichten, error: fehlerNachrichten } = await client
    .from('messages')
    .select('id, chat_id, text, sender_id, created_at')
    .in('chat_id', ids)
    .order('created_at', { ascending: false })
    .limit(200);
  if (fehlerNachrichten) throw fehlerNachrichten;

  const letzte = new Map();
  for (const n of nachrichten || []) {
    if (!letzte.has(n.chat_id)) letzte.set(n.chat_id, n);
  }

  return zeilen.map((z) => {
    const vorschau = letzte.get(z.chat_id) || null;
    return {
      id: z.chats.id,
      name: z.chats.name,
      isGroup: Boolean(z.chats.is_group),
      archiviert: Boolean(z.is_archived),
      muted: Boolean(z.is_muted),
      unread: !z.is_read,
      favorit: Boolean(z.is_favorite),
      letzteNachricht: vorschau ? vorschau.text : '',
      zeit: vorschau ? vorschau.created_at : z.chats.updated_at,
    };
  });
}

async function ladeNachrichten(client, chatId) {
  if (!client) return null;
  const { data, error } = await client
    .from('messages')
    .select('id, chat_id, sender_id, text, media_url, media_type, created_at, read_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;

  return (data || []).map((n) => ({
    id: n.id,
    chatId: n.chat_id,
    userId: n.sender_id,
    text: n.text,
    mediaUrl: n.media_url,
    mediaType: n.media_type,
    zeit: n.created_at,
    gelesen: Boolean(n.read_at),
  }));
}

/**
 * Aktuelle Storys. „viewed" ist keine Spalte in stories — ob jemand eine
 * Story gesehen hat, steht in story_views.
 */
async function ladeStorys(client, nutzerId) {
  if (!client) return null;

  const { data, error } = await client
    .from('stories')
    .select('id, user_id, media_url, media_type, caption, created_at, expires_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  const storys = data || [];
  if (storys.length === 0) return [];

  const { data: gesehen, error: fehlerGesehen } = await client
    .from('story_views')
    .select('story_id')
    .eq('user_id', nutzerId)
    .in('story_id', storys.map((s) => s.id));
  if (fehlerGesehen) throw fehlerGesehen;

  const gesehenIds = new Set((gesehen || []).map((g) => g.story_id));

  return storys.map((s) => ({
    id: s.id,
    userId: s.user_id,
    mediaUrl: s.media_url,
    mediaType: s.media_type,
    caption: s.caption || '',
    zeit: s.created_at,
    viewed: gesehenIds.has(s.id),
  }));
}

/**
 * Beiträge. Es gibt keine eigene Tabelle „videos" — ein Video ist ein Beitrag
 * mit kind = 'reel' oder 'clip'. Die Zähler für Likes und Kommentare stehen
 * ebenfalls nicht als Spalte in posts, sie werden mitgezählt.
 */
async function ladeBeitraege(client, { arten = null, limit = 50 } = {}) {
  if (!client) return null;

  let abfrage = client
    .from('posts')
    .select(
      'id, user_id, kind, title, description, location, music, media_url, thumbnail_url, duration, created_at,' +
        ' post_likes(count), comments(count)'
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (arten && arten.length > 0) abfrage = abfrage.in('kind', arten);

  const { data, error } = await abfrage;
  if (error) throw error;

  return (data || []).map((b) => ({
    id: b.id,
    userId: b.user_id,
    art: b.kind,
    title: b.title || '',
    beschreibung: b.description || '',
    ort: b.location || '',
    musik: b.music || '',
    mediaUrl: b.media_url,
    thumbnail: b.thumbnail_url,
    dauer: b.duration,
    zeit: b.created_at,
    likes: b.post_likes?.[0]?.count ?? 0,
    kommentare: b.comments?.[0]?.count ?? 0,
  }));
}

async function ladeVideos(client) {
  return ladeBeitraege(client, { arten: ['reel', 'clip'] });
}

async function ladeKommentare(client, beitragId) {
  if (!client) return null;
  const { data, error } = await client
    .from('comments')
    .select('id, post_id, user_id, text, created_at, comment_likes(count)')
    .eq('post_id', beitragId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;

  return (data || []).map((k) => ({
    id: k.id,
    beitragId: k.post_id,
    userId: k.user_id,
    text: k.text,
    zeit: k.created_at,
    likes: k.comment_likes?.[0]?.count ?? 0,
  }));
}

async function ladeBenachrichtigungen(client, nutzerId, bereich = null) {
  if (!client) return null;
  let abfrage = client
    .from('notifications')
    .select('id, actor_id, art, bereich, target_type, target_id, text, read_at, created_at')
    .eq('user_id', nutzerId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (bereich) abfrage = abfrage.eq('bereich', bereich);

  const { data, error } = await abfrage;
  if (error) throw error;

  return (data || []).map((b) => ({
    id: b.id,
    userId: b.actor_id,
    art: b.art,
    bereich: b.bereich,
    zielTyp: b.target_type,
    zielId: b.target_id,
    text: b.text || '',
    gelesen: Boolean(b.read_at),
    zeit: b.created_at,
  }));
}

async function ladeCommunities(client) {
  if (!client) return null;
  const { data, error } = await client
    .from('communities')
    .select('id, name, topic, visibility, created_by, created_at, community_members(count)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  return (data || []).map((c) => ({
    id: c.id,
    name: c.name,
    thema: c.topic || '',
    privat: c.visibility === 'private',
    erstelltVon: c.created_by,
    mitglieder: c.community_members?.[0]?.count ?? 0,
    zeit: c.created_at,
  }));
}

// ============================================================================
// Startdaten für /api/bootstrap
// ============================================================================

/**
 * Lädt alles, was die Oberfläche beim Start braucht. Gibt null zurück, wenn
 * niemand angemeldet ist oder die Datenbank nicht antwortet — dann nutzt
 * app.js die Beispieldaten.
 */
async function bootstrapData(client, nutzerId) {
  if (!client || !nutzerId) return null;

  try {
    const [nutzer, kontakte, chats, storys, beitraege, benachrichtigungen, communities] =
      await Promise.all([
        ladeNutzer(client),
        ladeKontakte(client, nutzerId),
        ladeChats(client, nutzerId),
        ladeStorys(client, nutzerId),
        ladeBeitraege(client, { limit: 100 }),
        ladeBenachrichtigungen(client, nutzerId),
        ladeCommunities(client),
      ]);

    return {
      users: nutzer,
      contacts: kontakte,
      chats,
      stories: storys,
      posts: beitraege.filter((b) => b.art === 'post'),
      videos: beitraege.filter((b) => b.art === 'reel' || b.art === 'clip'),
      notifications: benachrichtigungen,
      communities,
      currentUserId: nutzerId,
      quelle: 'supabase',
      timestamp: new Date().toISOString(),
    };
  } catch (fehler) {
    console.error('Startdaten aus Supabase fehlgeschlagen:', fehler.message);
    return null;
  }
}

module.exports = {
  profilZuNutzer,
  ladeNutzer,
  ladeProfil,
  ladeKontakte,
  ladeChats,
  ladeNachrichten,
  ladeStorys,
  ladeBeitraege,
  ladeVideos,
  ladeKommentare,
  ladeBenachrichtigungen,
  ladeCommunities,
  bootstrapData,
};
