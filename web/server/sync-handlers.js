/**
 * All Media — Schreibzugriffe auf Supabase
 *
 * Jeder Handler bekommt als erstes den Client des angemeldeten Nutzers und
 * dessen ID. Ohne Anmeldung gibt es keinen Client; dann liefert der Handler
 * null und der Aufrufer in app.js bleibt bei den Beispieldaten.
 *
 * Rückgabe:
 *   null                        — nicht angemeldet, nichts versucht
 *   { ok: true, ... }           — hat geklappt
 *   { ok: false, fehler: '…' }  — hat nicht geklappt, mit Grund
 *
 * Die Tabellen- und Spaltennamen folgen SUPABASE_SCHEMA.sql und
 * SUPABASE_SCHEMA_2.sql. Es gibt bewusst keine Tabellen „videos" und „likes":
 * Videos sind Beiträge mit kind = 'reel'/'clip', Likes stehen in post_likes.
 */

// Ein Umschalter (Like, Gespeichert, Repost …): Zeile da → weg, sonst → hin.
async function umschalten(client, tabelle, schluessel) {
  let abfrage = client.from(tabelle).select('*', { count: 'exact', head: true });
  for (const [spalte, wert] of Object.entries(schluessel)) abfrage = abfrage.eq(spalte, wert);

  const { count, error: fehlerLesen } = await abfrage;
  if (fehlerLesen) throw fehlerLesen;

  if (count > 0) {
    let loeschen = client.from(tabelle).delete();
    for (const [spalte, wert] of Object.entries(schluessel)) loeschen = loeschen.eq(spalte, wert);
    const { error } = await loeschen;
    if (error) throw error;
    return false;
  }

  const { error } = await client.from(tabelle).insert(schluessel);
  // 23505 = Zeile gab es schon (zwei Klicks gleichzeitig). Kein Fehlerfall.
  if (error && error.code !== '23505') throw error;
  return true;
}

// Nimmt jedem Handler das immer gleiche try/catch ab.
function handler(name, fn) {
  return async (client, ...rest) => {
    if (!client) return null;
    try {
      return await fn(client, ...rest);
    } catch (fehler) {
      console.error(`${name} fehlgeschlagen:`, fehler.message);
      return { ok: false, fehler: fehler.message };
    }
  };
}

// ---------------------------------------------------------------- Profil --

const handleUpdateProfile = handler('Profil ändern', async (client, nutzerId, aenderungen) => {
  const erlaubt = ['name', 'handle', 'bio', 'link', 'status', 'initials', 'color', 'phone', 'privat'];
  const daten = {};
  for (const feld of erlaubt) {
    if (aenderungen[feld] !== undefined) daten[feld] = aenderungen[feld];
  }
  if (Object.keys(daten).length === 0) return { ok: false, fehler: 'Nichts zu ändern' };

  daten.updated_at = new Date().toISOString();

  const { data, error } = await client
    .from('profiles')
    .update(daten)
    .eq('id', nutzerId)
    .select()
    .single();
  if (error) throw error;
  return { ok: true, profil: data };
});

// -------------------------------------------------------------- Kontakte --

const handleFollowUser = handler('Kontakt folgen', async (client, nutzerId, zielId) => {
  const { count, error: fehlerLesen } = await client
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', nutzerId)
    .eq('contact_id', zielId);
  if (fehlerLesen) throw fehlerLesen;

  if (count > 0) {
    const { error } = await client
      .from('contacts')
      .delete()
      .eq('user_id', nutzerId)
      .eq('contact_id', zielId);
    if (error) throw error;
    return { ok: true, folgt: false };
  }

  const { error } = await client
    .from('contacts')
    .insert({ user_id: nutzerId, contact_id: zielId, status: 'friend' });
  if (error && error.code !== '23505') throw error;
  return { ok: true, folgt: true };
});

const handleAcceptContactRequest = handler(
  'Kontaktanfrage annehmen',
  async (client, nutzerId, anfrageId) => {
    const { error } = await client
      .from('contacts')
      .update({ status: 'friend' })
      .eq('id', anfrageId)
      .eq('user_id', nutzerId);
    if (error) throw error;
    return { ok: true };
  }
);

// ----------------------------------------------------------------- Chats --

/**
 * Archiviert, stumm, gelesen und Favorit hängen an chat_members — also pro
 * Mitglied. Sonst würde Annas Archivieren auch Bobs Liste verändern.
 */
const handleChatAction = handler(
  'Chat-Einstellung',
  async (client, nutzerId, chatId, was, wert = true) => {
    const spalten = {
      archiv: 'is_archived',
      archived: 'is_archived',
      stumm: 'is_muted',
      muted: 'is_muted',
      gelesen: 'is_read',
      read: 'is_read',
      favorit: 'is_favorite',
    };
    const spalte = spalten[was];
    if (!spalte) return { ok: false, fehler: `Unbekannte Einstellung: ${was}` };

    const daten = { [spalte]: wert };
    if (spalte === 'is_read' && wert) daten.last_read_at = new Date().toISOString();

    const { error } = await client
      .from('chat_members')
      .update(daten)
      .eq('chat_id', chatId)
      .eq('user_id', nutzerId);
    if (error) throw error;
    return { ok: true, [spalte]: wert };
  }
);

const handleSendMessage = handler(
  'Nachricht senden',
  async (client, nutzerId, chatId, text, medien = {}) => {
    const { data, error } = await client
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: nutzerId,
        text: text,
        media_url: medien.url || null,
        media_type: medien.typ || null,
      })
      .select()
      .single();
    if (error) throw error;

    // Damit der Chat in der Liste nach oben rutscht.
    await client.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);

    return { ok: true, nachricht: data };
  }
);

const handleMarkMessageAsRead = handler('Nachricht gelesen', async (client, nutzerId, nachrichtId) => {
  const { error } = await client
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', nachrichtId);
  if (error) throw error;
  return { ok: true };
});

// --------------------------------------------------------------- Beiträge --

const handleCreatePost = handler('Beitrag anlegen', async (client, nutzerId, felder = {}) => {
  const { data, error } = await client
    .from('posts')
    .insert({
      user_id: nutzerId,
      kind: felder.art || 'post',
      title: felder.titel || '',
      description: felder.beschreibung || '',
      location: felder.ort || '',
      music: felder.musik || '',
      media_url: felder.mediaUrl || null,
      thumbnail_url: felder.thumbnail || null,
      duration: felder.dauer || null,
    })
    .select()
    .single();
  if (error) throw error;
  return { ok: true, beitrag: data };
});

// Ein Video ist ein Beitrag mit kind = 'reel'.
const handleCreateVideo = (client, nutzerId, felder = {}) =>
  handleCreatePost(client, nutzerId, { ...felder, art: felder.art || 'reel' });

const handleDeleteContent = handler('Inhalt löschen', async (client, nutzerId, id, art = 'post') => {
  const tabelle = art === 'comment' ? 'comments' : art === 'story' ? 'stories' : 'posts';
  const { error } = await client.from(tabelle).delete().eq('id', id).eq('user_id', nutzerId);
  if (error) throw error;
  return { ok: true };
});

const handleLikeContent = handler('Like', async (client, nutzerId, beitragId) => {
  const gesetzt = await umschalten(client, 'post_likes', {
    post_id: beitragId,
    user_id: nutzerId,
  });
  return { ok: true, geliked: gesetzt };
});

const handleSaveContent = handler('Speichern', async (client, nutzerId, beitragId) => {
  const gesetzt = await umschalten(client, 'saves', { post_id: beitragId, user_id: nutzerId });
  return { ok: true, gespeichert: gesetzt };
});

const handleRepostContent = handler('Repost', async (client, nutzerId, beitragId) => {
  const gesetzt = await umschalten(client, 'reposts', { post_id: beitragId, user_id: nutzerId });
  return { ok: true, geteilt: gesetzt };
});

const handleShareContent = handler(
  'Teilen',
  async (client, nutzerId, beitragId, empfaenger = []) => {
    if (empfaenger.length === 0) return { ok: false, fehler: 'Keine Empfänger' };

    const zeilen = empfaenger.map((id) => ({
      post_id: beitragId,
      shared_by: nutzerId,
      shared_to: id,
    }));
    const { error } = await client.from('shares').insert(zeilen);
    if (error) throw error;
    return { ok: true, anzahl: empfaenger.length };
  }
);

// ------------------------------------------------------------ Kommentare --

const handleCreateComment = handler(
  'Kommentar anlegen',
  async (client, nutzerId, beitragId, text) => {
    const { data, error } = await client
      .from('comments')
      .insert({ post_id: beitragId, user_id: nutzerId, text })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, kommentar: data };
  }
);

const handleLikeComment = handler('Kommentar-Like', async (client, nutzerId, kommentarId) => {
  const gesetzt = await umschalten(client, 'comment_likes', {
    comment_id: kommentarId,
    user_id: nutzerId,
  });
  return { ok: true, geliked: gesetzt };
});

const handleDeleteComment = handler('Kommentar löschen', async (client, nutzerId, kommentarId) => {
  const { error } = await client
    .from('comments')
    .delete()
    .eq('id', kommentarId)
    .eq('user_id', nutzerId);
  if (error) throw error;
  return { ok: true };
});

// ---------------------------------------------------------------- Storys --

const handleCreateStory = handler('Story anlegen', async (client, nutzerId, felder = {}) => {
  const { data, error } = await client
    .from('stories')
    .insert({
      user_id: nutzerId,
      media_url: felder.mediaUrl || null,
      media_type: felder.mediaTyp || 'image',
      caption: felder.text || '',
    })
    .select()
    .single();
  if (error) throw error;
  return { ok: true, story: data };
});

const handleLikeStory = handler('Story-Like', async (client, nutzerId, storyId) => {
  const gesetzt = await umschalten(client, 'story_likes', {
    story_id: storyId,
    user_id: nutzerId,
  });
  return { ok: true, geliked: gesetzt };
});

const handleViewStory = handler('Story gesehen', async (client, nutzerId, storyId) => {
  const { error } = await client
    .from('story_views')
    .upsert({ story_id: storyId, user_id: nutzerId }, { onConflict: 'story_id,user_id' });
  if (error) throw error;
  return { ok: true };
});

// ----------------------------------------------------------- Communities --

const handleCreateCommunity = handler(
  'Community anlegen',
  async (client, nutzerId, name, thema = '', privat = false) => {
    const { data, error } = await client
      .from('communities')
      .insert({
        name,
        topic: thema,
        visibility: privat ? 'private' : 'public',
        created_by: nutzerId,
      })
      .select()
      .single();
    if (error) throw error;

    // Wer eine Community anlegt, ist ihr erstes Mitglied.
    await client.from('community_members').insert({ community_id: data.id, user_id: nutzerId });

    return { ok: true, community: data };
  }
);

const handleJoinCommunity = handler('Community beitreten', async (client, nutzerId, communityId) => {
  const gesetzt = await umschalten(client, 'community_members', {
    community_id: communityId,
    user_id: nutzerId,
  });
  return { ok: true, mitglied: gesetzt };
});

// ------------------------------------------------- Melden, Blocken, Stumm --

const handleReportContent = handler(
  'Melden',
  async (client, nutzerId, zielId, grund, zielTyp = 'post') => {
    const { error } = await client
      .from('reports')
      .insert({ reported_by: nutzerId, target_type: zielTyp, target_id: zielId, reason: grund || '' });
    if (error) throw error;
    return { ok: true };
  }
);

const handleBlockUser = handler('Blockieren', async (client, nutzerId, zielId) => {
  const gesetzt = await umschalten(client, 'blocks', {
    user_id: nutzerId,
    blocked_user_id: zielId,
  });
  return { ok: true, blockiert: gesetzt };
});

const handleMuteUser = handler('Stummschalten', async (client, nutzerId, zielId) => {
  const gesetzt = await umschalten(client, 'mutes', { user_id: nutzerId, muted_user_id: zielId });
  return { ok: true, stumm: gesetzt };
});

// -------------------------------------------------------- Benachrichtigungen --

const handleMarkNotificationRead = handler(
  'Benachrichtigung gelesen',
  async (client, nutzerId, id) => {
    const { error } = await client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', nutzerId);
    if (error) throw error;
    return { ok: true };
  }
);

const handleMarkAllNotificationsRead = handler(
  'Alle Benachrichtigungen gelesen',
  async (client, nutzerId, bereich = null) => {
    let abfrage = client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', nutzerId)
      .is('read_at', null);
    if (bereich) abfrage = abfrage.eq('bereich', bereich);

    const { error } = await abfrage;
    if (error) throw error;
    return { ok: true };
  }
);

const handleMarkChatFavorite = handler('Chat-Favorit', async (client, nutzerId, chatId) => {
  const { data, error: fehlerLesen } = await client
    .from('chat_members')
    .select('is_favorite')
    .eq('chat_id', chatId)
    .eq('user_id', nutzerId)
    .maybeSingle();
  if (fehlerLesen) throw fehlerLesen;

  const neu = !data?.is_favorite;
  const { error } = await client
    .from('chat_members')
    .update({ is_favorite: neu })
    .eq('chat_id', chatId)
    .eq('user_id', nutzerId);
  if (error) throw error;
  return { ok: true, favorit: neu };
});

module.exports = {
  handleUpdateProfile,
  handleFollowUser,
  handleAcceptContactRequest,
  handleChatAction,
  handleSendMessage,
  handleMarkMessageAsRead,
  handleCreatePost,
  handleCreateVideo,
  handleDeleteContent,
  handleLikeContent,
  handleSaveContent,
  handleRepostContent,
  handleShareContent,
  handleCreateComment,
  handleLikeComment,
  handleDeleteComment,
  handleCreateStory,
  handleLikeStory,
  handleViewStory,
  handleCreateCommunity,
  handleJoinCommunity,
  handleReportContent,
  handleBlockUser,
  handleMuteUser,
  handleMarkNotificationRead,
  handleMarkAllNotificationsRead,
  handleMarkChatFavorite,
};
