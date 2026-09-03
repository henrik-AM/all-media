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

/**
 * Folgen ist nicht dasselbe wie ein Kontakt.
 *
 * Vorher schrieb dieser Handler in `contacts` — wer jemandem folgte, landete
 * dadurch in dessen Kontaktliste, und wer entfolgte, flog aus den Kontakten
 * heraus. Ein Kontakt ist aber jemand aus dem Telefonbuch; folgen kann man
 * auch einer Person, die man nie getroffen hat. Seit SUPABASE_SCHEMA_5.sql
 * gibt es dafür `follows`.
 */
const handleFollowUser = handler('Folgen', async (client, nutzerId, zielId) => {
  if (zielId === nutzerId) return { ok: false, fehler: 'Sich selbst folgen geht nicht' };
  const gesetzt = await umschalten(client, 'follows', {
    follower_id: nutzerId,
    followee_id: zielId,
  });
  return { ok: true, folgt: gesetzt };
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
/*
 * Eine Einstellung am Chat setzen — oder umschalten, wenn kein Wert kommt.
 *
 * `wert` stand hier auf `true` als Vorgabe. Damit war jeder Umschalter eine
 * Einbahnstraße: sperren ging, entsperren nicht; stummschalten ging,
 * lautstellen nicht. Der Kommentar unten beschrieb das Umschalten seit jeher
 * richtig — die Vorgabe kam nie dort an.
 */
const handleChatAction = handler(
  'Chat-Einstellung',
  async (client, nutzerId, chatId, was, wert) => {
    const spalten = {
      archiv: 'is_archived',
      archived: 'is_archived',
      stumm: 'is_muted',
      muted: 'is_muted',
      gelesen: 'is_read',
      read: 'is_read',
      favorit: 'is_favorite',
      sperren: 'is_locked',
      mitteilungen: 'notifications_off',
    };
    const spalte = spalten[was];
    if (!spalte) return { ok: false, fehler: `Unbekannte Einstellung: ${was}` };

    // Ohne ausdrücklichen Wert wird umgeschaltet. Das ist der Normalfall: die
    // Oberfläche weiß den alten Zustand nicht sicher, wenn zwei Geräte
    // gleichzeitig offen sind.
    let neu = wert;
    if (wert === undefined || wert === null) {
      const { data } = await client
        .from('chat_members')
        .select(spalte)
        .eq('chat_id', chatId)
        .eq('user_id', nutzerId)
        .maybeSingle();
      neu = !data?.[spalte];
    }

    const daten = { [spalte]: neu };
    if (spalte === 'is_read' && neu) daten.last_read_at = new Date().toISOString();

    const { error } = await client
      .from('chat_members')
      .update(daten)
      .eq('chat_id', chatId)
      .eq('user_id', nutzerId);
    if (error) throw error;
    return { ok: true, [spalte]: neu, wert: neu };
  }
);

/**
 * Chat verlassen.
 *
 * Gelöscht wird die eigene Mitgliedschaft, nicht der Chat. Der Chat selbst
 * gehört auch der anderen Person — ihn zu entfernen würde ihr den Verlauf
 * unter den Füßen wegziehen. Bleibt niemand übrig, räumt die Datenbank ihn
 * über die Fremdschlüssel selbst ab.
 */
const handleLeaveChat = handler('Chat löschen', async (client, nutzerId, chatId) => {
  const { error } = await client
    .from('chat_members')
    .delete()
    .eq('chat_id', chatId)
    .eq('user_id', nutzerId);
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
   * gab es bis zum 01.09.2026 gar keine Regel zum Loeschen — hier stand
   * seither { ok: true } fuer einen Chat, der geblieben ist. Behoben in
   * SUPABASE_SCHEMA_9_loeschen.sql; die Kontrolle bleibt.
   */
  const { count: meine } = await client
    .from('chat_members')
    .select('*', { count: 'exact', head: true })
    .eq('chat_id', chatId)
    .eq('user_id', nutzerId);
  if (meine > 0) {
    return { ok: false, fehler: 'Der Chat liess sich nicht verlassen — die Datenbank hat es abgelehnt' };
  }

  if (!count) await client.from('chats').delete().eq('id', chatId);

  return { ok: true };
});

/**
 * Chat leeren: die Unterhaltung bleibt, der Verlauf ist für mich weg.
 *
 * Zwei Schritte, und beide sind nötig:
 *
 *   1. Die eigenen Nachrichten werden wirklich gelöscht. Sie gehören mir.
 *   2. Für alles andere wird ein Strich gezogen — `geleert_bis`. Was davor
 *      liegt, blende ich aus.
 *
 * Fremde Zeilen zu löschen steht niemandem zu, und die Regeln der Datenbank
 * lassen es auch nicht zu. Bis zum 01.09.2026 blieb es deshalb beim ersten
 * Schritt: der Chat war danach nicht leer, sondern einseitig ausgedünnt —
 * die Nachrichten des Gegenübers standen weiter da.
 */
const handleClearChat = handler('Chat leeren', async (client, nutzerId, chatId) => {
  const { error } = await client
    .from('messages')
    .delete()
    .eq('chat_id', chatId)
    .eq('sender_id', nutzerId);
  if (error) throw error;

  const { error: fehlerStrich } = await client
    .from('chat_members')
    .update({ geleert_bis: new Date().toISOString() })
    .eq('chat_id', chatId)
    .eq('user_id', nutzerId);
  if (fehlerStrich) throw fehlerStrich;

  return { ok: true };
});

/** Eine Nachricht mit einem Stern markieren. Der Stern gehört nur mir. */
const handleStarMessage = handler('Nachricht markieren', async (client, nutzerId, nachrichtId) => {
  const gesetzt = await umschalten(client, 'message_stars', {
    message_id: nachrichtId,
    user_id: nutzerId,
  });
  return { ok: true, stern: gesetzt };
});

/** Gruppe anlegen und alle Mitglieder eintragen. */
const handleCreateGroup = handler(
  'Gruppe anlegen',
  async (client, nutzerId, name, mitglieder = [], bereich = 'messenger') => {
    const { data, error } = await client
      .from('chats')
      .insert({ name, is_group: true, bereich, created_by: nutzerId })
      .select()
      .single();
    if (error) throw error;

    const alle = [...new Set([nutzerId, ...mitglieder])];
    const { error: fehlerM } = await client
      .from('chat_members')
      .insert(alle.map((id) => ({ chat_id: data.id, user_id: id })));
    if (fehlerM) throw fehlerM;

    return { ok: true, chat: data, mitglieder: alle.length };
  }
);

/**
 * Den Chat mit einer Person finden — oder ihn anlegen.
 *
 * Zwei Personen sollen genau einen gemeinsamen Zweierchat haben. Ohne diese
 * Prüfung entstünde bei jedem Teilen ein neuer, und der Verlauf zerfiele in
 * Bruchstücke.
 */
async function chatMit(client, nutzerId, zielId, bereich = 'messenger') {
  const { data: meine, error } = await client
    .from('chat_members')
    .select('chat_id, chats(id, is_group, bereich)')
    .eq('user_id', nutzerId);
  if (error) throw error;

  const zweier = (meine || []).filter((m) => m.chats && !m.chats.is_group && (m.chats.bereich || 'messenger') === bereich);
  if (zweier.length > 0) {
    const { data: andere } = await client
      .from('chat_members')
      .select('chat_id, user_id')
      .in('chat_id', zweier.map((z) => z.chat_id))
      .eq('user_id', zielId);
    if (andere && andere.length > 0) return andere[0].chat_id;
  }

  const { data: person } = await client.from('profiles').select('name').eq('id', zielId).maybeSingle();
  const { data: neu, error: fehlerNeu } = await client
    .from('chats')
    .insert({ name: person?.name || 'Chat', is_group: false, bereich, created_by: nutzerId })
    .select()
    .single();
  if (fehlerNeu) throw fehlerNeu;

  /*
   * Die Mitglieder gehoeren zum Chat. Schlaegt das fehl, entsteht ein Chat,
   * in dem niemand drin ist: er taucht in keiner Liste auf, nimmt aber jede
   * Nachricht an, die dann nie jemand sieht. Deshalb wird der Fehler nicht
   * verschluckt, und der halbe Chat wieder weggeraeumt.
   */
  const { error: fehlerMitglieder } = await client.from('chat_members').insert([
    { chat_id: neu.id, user_id: nutzerId },
    { chat_id: neu.id, user_id: zielId },
  ]);
  if (fehlerMitglieder) {
    await client.from('chats').delete().eq('id', neu.id);
    throw fehlerMitglieder;
  }
  return neu.id;
}

const handleChatMit = handler('Chat finden', async (client, nutzerId, zielId, bereich) => {
  const id = await chatMit(client, nutzerId, zielId, bereich);
  return { ok: true, chatId: id };
});

/**
 * Person zu einem Benutzernamen oder einer Telefonnummer nachschlagen.
 *
 * Henrik wollte nicht mehr an den Benutzernamen gebunden sein — es geht auch
 * über die Nummer. Die Suche läuft in der Datenbank, damit sie in der App und
 * auf der Website dasselbe findet.
 */
function nurZiffern(eingabe) {
  let z = String(eingabe).replace(/[^\d+]/g, '').replace(/^\+/, '00');
  if (z.startsWith('00')) z = z.slice(2);
  else if (z.startsWith('0')) z = '49' + z.slice(1);
  return z;
}

function istNummer(eingabe) {
  return /^[+\d][\d\s/()-]{4,}$/.test(String(eingabe).trim());
}

const handleFindPerson = handler('Person suchen', async (client, nutzerId, eingabe) => {
  const roh = String(eingabe || '').trim();
  if (!roh) return { ok: false, fehler: 'Nichts eingegeben' };

  const spalten = 'id, name, handle, initials, color, phone, privat, about';

  if (istNummer(roh)) {
    const gesucht = nurZiffern(roh);
    const { data, error } = await client.from('profiles').select(spalten).not('phone', 'is', null);
    if (error) throw error;
    const treffer = (data || []).find((p) => p.id !== nutzerId && nurZiffern(p.phone) === gesucht);
    return { ok: true, person: treffer || null, warNummer: true };
  }

  const name = roh.replace(/^@/, '').toLowerCase();
  const { data, error } = await client
    .from('profiles')
    .select(spalten)
    .or(`handle.eq.@${name},name.ilike.${name}`)
    .neq('id', nutzerId)
    .limit(1);
  if (error) throw error;
  return { ok: true, person: (data || [])[0] || null, warNummer: false };
});

/**
 * Kontakt hinzufügen.
 *
 * Bei einem privaten Profil bleibt die Anfrage offen, bis die Person sie
 * annimmt. Ein öffentliches Profil nimmt sofort an — dort wäre ein Warten auf
 * eine Freigabe, die niemand geben muss, nur eine Hürde ohne Zweck.
 */
const handleAddContact = handler(
  'Kontakt hinzufügen',
  async (client, nutzerId, zielId, privat, nachricht = '') => {
    const { count } = await client
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', nutzerId)
      .eq('contact_id', zielId);
    if (count > 0) return { ok: false, fehler: 'schon-vorhanden' };

    const status = privat ? 'pending' : 'friend';
    const { error } = await client
      .from('contacts')
      .insert({ user_id: nutzerId, contact_id: zielId, status });
    if (error && error.code !== '23505') throw error;

    const chatId = await chatMit(client, nutzerId, zielId);
    if (nachricht.trim()) {
      const { error: fehlerNachricht } = await client
        .from('messages')
        .insert({ chat_id: chatId, sender_id: nutzerId, text: nachricht.trim() });
      if (fehlerNachricht) throw fehlerNachricht;
    }

    return { ok: true, status, chatId };
  }
);

/** Anfrage annehmen — danach ist der Chat frei benutzbar. */
const handleAcceptRequest = handler('Anfrage annehmen', async (client, nutzerId, zielId) => {
  const { error } = await client
    .from('contacts')
    .update({ status: 'friend' })
    .eq('user_id', nutzerId)
    .eq('contact_id', zielId);
  if (error) throw error;
  return { ok: true };
});

/** Kontakt als Favorit merken. */
const handleContactFavorite = handler('Kontakt-Favorit', async (client, nutzerId, zielId) => {
  const { data } = await client
    .from('contacts')
    .select('is_favorite')
    .eq('user_id', nutzerId)
    .eq('contact_id', zielId)
    .maybeSingle();
  if (!data) return { ok: false, fehler: 'Diese Person steht nicht in deinen Kontakten' };

  const neu = !data.is_favorite;
  const { error } = await client
    .from('contacts')
    .update({ is_favorite: neu })
    .eq('user_id', nutzerId)
    .eq('contact_id', zielId);
  if (error) throw error;
  return { ok: true, favorit: neu };
});

/** „Benachrichtige mich über neue Beiträge dieser Person." */
const handleNotifyPost = handler('Beitragshinweis', async (client, nutzerId, beitragId) => {
  const gesetzt = await umschalten(client, 'post_notify', {
    post_id: beitragId,
    user_id: nutzerId,
  });
  return { ok: true, notify: gesetzt };
});

/** Einen Beitrag an mehrere Personen schicken: als Nachricht in ihren Chat. */
const handleShareToChats = handler(
  'An Kontakte schicken',
  async (client, nutzerId, beitragId, empfaenger = [], vorschau = 'Beitrag geteilt') => {
    if (empfaenger.length === 0) return { ok: false, fehler: 'Bitte mindestens eine Person auswählen' };

    const gesendet = [];
    for (const zielId of empfaenger) {
      const chatId = await chatMit(client, nutzerId, zielId);
      // Welcher Beitrag geteilt wurde, gehoert an die Nachricht. Sonst steht
      // im Chat nur der Satz "Beitrag geteilt" und niemand kommt von dort aus
      // zum Beitrag — im Prototyp ist das eine Karte, die ihn oeffnet.
      const { error: fehlerNachricht } = await client
        .from('messages')
        .insert({ chat_id: chatId, sender_id: nutzerId, text: vorschau, shared_post_id: beitragId });
      if (fehlerNachricht) throw fehlerNachricht;
      gesendet.push(zielId);
    }

    /*
     * Der Eintrag in shares ist die gezaehlte Weiterleitung. Ging er still
     * verloren, meldete die Oberflaeche "An Bob gesendet" und die Zahl unter
     * dem Beitrag blieb trotzdem stehen — ohne dass irgendwo etwas stand.
     */
    const { error: fehlerZaehler } = await client.from('shares').insert(
      gesendet.map((id) => ({ post_id: beitragId, shared_by: nutzerId, shared_to: id }))
    );
    if (fehlerZaehler) throw fehlerZaehler;

    return { ok: true, gesendet };
  }
);

/** Antwort auf eine Story landet im normalen Chat mit dieser Person. */
const handleStoryReply = handler('Story beantworten', async (client, nutzerId, storyId, text) => {
  const { data: story, error } = await client
    .from('stories')
    .select('id, user_id')
    .eq('id', storyId)
    .maybeSingle();
  if (error) throw error;
  if (!story) return { ok: false, fehler: 'Diese Story gibt es nicht mehr' };

  const chatId = await chatMit(client, nutzerId, story.user_id);
  const { data: nachricht, error: fehlerN } = await client
    .from('messages')
    .insert({ chat_id: chatId, sender_id: nutzerId, text })
    .select()
    .single();
  if (fehlerN) throw fehlerN;

  return { ok: true, chatId, nachricht };
});

/** Neues Unterthema in einer Community. */
const handleCreateChannel = handler(
  'Unterthema anlegen',
  async (client, nutzerId, communityId, name) => {
    const slug =
      'ch-' + name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '');

    const { count } = await client
      .from('community_channels')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', communityId)
      .ilike('name', name);
    if (count > 0) return { ok: false, fehler: 'Dieses Unterthema gibt es schon' };

    const { data, error } = await client
      .from('community_channels')
      .insert({ community_id: communityId, slug, name })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, kanal: data };
  }
);

const handleSendChannelMessage = handler(
  'Im Kanal schreiben',
  async (client, nutzerId, kanalId, text) => {
    const { data, error } = await client
      .from('community_channel_messages')
      .insert({ channel_id: kanalId, sender_id: nutzerId, text })
      .select()
      .single();
    if (error) throw error;
    return { ok: true, nachricht: data };
  }
);

/**
 * Highlights, Playlists, Spendenziel und Livestream.
 *
 * Alle vier hängen am eigenen Profil. Sie lagen bisher ausschließlich im
 * Arbeitsspeicher des Servers und waren nach jedem Neustart weg.
 */
const handleProfilListe = handler(
  'Sammlung anlegen',
  async (client, nutzerId, spalte, name) => {
    if (!['highlights', 'playlists'].includes(spalte)) {
      return { ok: false, fehler: 'Unbekannte Sammlung' };
    }
    const { data } = await client.from('profiles').select(spalte).eq('id', nutzerId).maybeSingle();
    const bestand = data?.[spalte] || [];
    if (bestand.includes(name)) {
      return { ok: false, fehler: spalte === 'highlights' ? 'Dieses Highlight gibt es schon' : 'Diese Playlist gibt es schon' };
    }
    const neu = [...bestand, name];
    const { error } = await client.from('profiles').update({ [spalte]: neu }).eq('id', nutzerId);
    if (error) throw error;
    return { ok: true, [spalte]: neu };
  }
);

const handleSpende = handler('Spendenziel', async (client, nutzerId, spende) => {
  const { error } = await client
    .from('profiles')
    .update({ spende: spende ? JSON.stringify(spende) : null })
    .eq('id', nutzerId);
  if (error) throw error;
  return { ok: true, spende };
});

const handleLivestream = handler('Livestream', async (client, nutzerId, live) => {
  const { error } = await client.from('profiles').update({ live: live || null }).eq('id', nutzerId);
  if (error) throw error;
  return { ok: true, live: Boolean(live) };
});

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
        // Ein angehaengter Standort oder Kontakt ist ein Bezug, kein Satz:
        // die Oberflaeche baut daraus die Karte mit Nadel beziehungsweise
        // mit Avatar. Ohne ihn stand im Chat nur "Standort: Zugspitze".
        place_id: medien.standortId || null,
        contact_user_id: medien.kontaktId || null,
        // Bezug und Dateiangaben — Handbuch-Abgleich 01.09.2026. Eine Antwort
        // zeigt den Bezug nur an, ein Zitat nimmt den Text mit; deshalb zwei
        // Spalten und nicht eine.
        reply_to: medien.antwortAuf || null,
        quote_of: medien.zitatVon || null,
        file_name: medien.dateiName || null,
        file_size: medien.dateiGroesse || null,
      })
      .select()
      .single();
    if (error) throw error;

    // Damit der Chat in der Liste nach oben rutscht. Klappt das nicht, ist
    // die Nachricht trotzdem angekommen — die Liste steht nur in der alten
    // Reihenfolge. Das ist kein Grund, das Senden scheitern zu lassen, aber
    // auch keins, es zu verschweigen.
    const { error: fehlerReihenfolge } = await client
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);
    if (fehlerReihenfolge) {
      console.warn('Chat konnte nicht nach oben sortiert werden:', fehlerReihenfolge.message);
    }

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
      // „Später posten": ein Zeitpunkt in der Zukunft hält den Beitrag
      // zurück, bis er erreicht ist (ladeBeitraege filtert danach).
      publish_at: felder.geplantAb || null,
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
  /*
   * ignoreDuplicates ist hier kein Feinschliff, sondern notwendig.
   *
   * Ein upsert wird bei einer schon vorhandenen Zeile zu einem UPDATE — und
   * für UPDATE gibt es auf story_views gar keine Regel (SUPABASE_SCHEMA_2.sql
   * kennt nur SELECT und INSERT). Die Datenbank wies das ab:
   *
   *   new row violates row-level security policy (USING expression)
   *   for table "story_views"
   *
   * Sichtbar wurde das erst im iOS-Simulator: jede zweite Betrachtung
   * derselben Story lief in diesen Fehler, und der Ring blieb bunt. Kein
   * Prüflauf gegen die Website hat es gezeigt.
   *
   * Mit ignoreDuplicates wird daraus ein ON CONFLICT DO NOTHING. Richtig so:
   * „gesehen" ist ein Fakt, der sich nicht ändert — der Zeitpunkt der ersten
   * Betrachtung ist der interessante, nicht der der letzten.
   */
  const { error } = await client
    .from('story_views')
    .upsert(
      { story_id: storyId, user_id: nutzerId },
      { onConflict: 'story_id,user_id', ignoreDuplicates: true }
    );
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

    /*
     * Wer eine Community anlegt, ist ihr erstes Mitglied. Ohne diese Zeile
     * legt man eine Community an, in der man selbst nicht drin ist — sie
     * steht dann unter "Erstellt", aber nicht unter "Meine".
     */
    const { error: fehlerMitglied } = await client
      .from('community_members')
      .insert({ community_id: data.id, user_id: nutzerId });
    if (fehlerMitglied) {
      await client.from('communities').delete().eq('id', data.id);
      throw fehlerMitglied;
    }

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

/**
 * Eine Community stummschalten oder wieder hoerbar machen.
 *
 * Gegenstueck zu communityStumm() in app/lib/aktionen.ts. Kein umschalten():
 * stumm ist eine Spalte der Mitgliedschaft, keine eigene Zeile.
 */
const handleCommunityStumm = handler(
  'Community stummschalten',
  async (client, nutzerId, communityId) => {
    const { data: zeile, error: fehlerLesen } = await client
      .from('community_members')
      .select('is_muted')
      .eq('community_id', communityId)
      .eq('user_id', nutzerId)
      .maybeSingle();
    if (fehlerLesen) throw fehlerLesen;
    if (!zeile) return { ok: false, error: 'Du bist in dieser Community nicht Mitglied.' };

    const neu = !zeile.is_muted;
    const { error } = await client
      .from('community_members')
      .update({ is_muted: neu })
      .eq('community_id', communityId)
      .eq('user_id', nutzerId);
    if (error) throw error;
    return { ok: true, stumm: neu };
  }
);

/**
 * Eine Einstellung setzen.
 *
 * Gegenstueck zu einstellungSetzen() in app/lib/aktionen.ts — inklusive der
 * beiden Sonderfaelle, die ueber die Liste hinaus Bedeutung haben.
 */
const handleEinstellung = handler(
  'Einstellung',
  async (client, nutzerId, schluessel, wert) => {
    const name = String(schluessel || '').trim();
    if (!name || name.length > 60) return { ok: false, error: 'Unbekannte Einstellung' };
    const inhalt = String(wert ?? '');

    const { error } = await client
      .from('user_settings')
      .upsert(
        { user_id: nutzerId, schluessel: name, wert: inhalt, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,schluessel' }
      );
    if (error) throw error;

    if (name === 'videoPrivate' || name === 'commPrivate') {
      const { error: fehler } = await client
        .from('profiles')
        .update({ privat: inhalt === 'an' })
        .eq('id', nutzerId);
      if (fehler) throw fehler;
    }

    return { ok: true, schluessel: name, wert: inhalt };
  }
);

/**
 * Einen fremden Profilaufruf vermerken.
 *
 * Gegenstueck zu profilAufrufVermerken() in app/lib/aktionen.ts. Das eigene
 * Profil zaehlt nicht — die Datenbank lehnt es ueber eine Pruefregel ab.
 */
const handleProfilAufruf = handler(
  'Profilaufruf',
  async (client, nutzerId, profilId) => {
    if (!profilId || profilId === nutzerId || profilId === 'me') return { ok: true, gezaehlt: false };
    const { error } = await client
      .from('profile_views')
      .insert({ profile_id: profilId, viewer_id: nutzerId });
    if (error) {
      // Ein nicht gezaehlter Aufruf ist aergerlich, aber kein Grund, dem
      // Nutzer das Profil nicht zu zeigen.
      console.error('Profilaufruf nicht vermerkt:', error.message);
      return { ok: true, gezaehlt: false };
    }
    return { ok: true, gezaehlt: true };
  }
);

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


// ===========================================================================
//  Was das Handbuch verlangt — nachgetragen am 01.09.2026
//
//  Die Gegenstücke in der App stehen in app/lib/aktionen.ts unter derselben
//  Überschrift. Gleiche Tabellen, gleiche Spalten, gleiche Regeln — wer hier
//  etwas ändert, muss dort nachsehen.
// ===========================================================================

// ------------------------------------------------------------- Insights --
//
//  Zur Begriffsklärung: ein *Insight* ist ein Foto oder Video, das an
//  ausgewählte Personen geht — das Snapchat-Äquivalent. Die *Insight Time*
//  zählt die Tage in Folge, an denen sich beide Seiten gegenseitig einen
//  geschickt haben. Die „Insights" im Einstellungsmenü sind etwas anderes:
//  Statistik zum eigenen Profil.

const handleInsightSenden = handler(
  'Insight senden',
  async (client, nutzerId, empfaenger, felder = {}) => {
    if (!Array.isArray(empfaenger) || !empfaenger.length) {
      return { ok: false, fehler: 'Ohne Empfänger geht kein Insight raus' };
    }

    const ablauf = felder.loeschtNachStunden
      ? new Date(Date.now() + felder.loeschtNachStunden * 3600000).toISOString()
      : null;

    const { data, error } = await client
      .from('insights')
      .insert({
        sender_id: nutzerId,
        media_url: felder.mediaUrl,
        media_type: felder.mediaTyp || 'image',
        filter: felder.filter || '',
        dauer: felder.dauer || 0,
        einmal: felder.einmal !== false,
        ablauf_at: ablauf,
        gespeichert: Boolean(felder.gespeichert),
      })
      .select('id')
      .single();
    if (error) throw error;

    const { error: fehlerEmpfaenger } = await client
      .from('insight_recipients')
      .insert(empfaenger.map((user_id) => ({ insight_id: data.id, user_id })));
    if (fehlerEmpfaenger) throw fehlerEmpfaenger;

    // Die Kette rechnet die Datenbank aus, damit die Regel nicht zweimal
    // dasteht. Scheitert sie, ist der Insight trotzdem angekommen.
    const streaks = {};
    for (const partner of empfaenger) {
      const { data: tage, error: fehlerStreak } = await client.rpc(
        'insight_streak_fortschreiben',
        { partner }
      );
      if (fehlerStreak) {
        console.warn('Insight Time nicht fortgeschrieben:', fehlerStreak.message);
        continue;
      }
      streaks[partner] = tage || 0;
    }

    return { ok: true, id: data.id, streaks };
  }
);

const handleInsightGesehen = handler('Insight ansehen', async (client, nutzerId, insightId) => {
  const { error } = await client
    .from('insight_recipients')
    .update({ gesehen_at: new Date().toISOString() })
    .eq('insight_id', insightId)
    .eq('user_id', nutzerId);
  if (error) throw error;
  return { ok: true };
});

const handleInsightSpeichern = handler(
  'Insight behalten',
  async (client, nutzerId, insightId, behalten) => {
    const { error } = await client
      .from('insights')
      .update({ gespeichert: Boolean(behalten) })
      .eq('id', insightId)
      .eq('sender_id', nutzerId);
    if (error) throw error;
    return { ok: true, gespeichert: Boolean(behalten) };
  }
);

/*
 * „Insights wiederholen" aus dem Handbuch. Es wird bewusst ein neuer Insight
 * angelegt und nicht die Empfängerliste des alten erweitert — sonst bekäme
 * jemand eine Aufnahme, deren Einmalansicht ein anderer schon verbraucht hat.
 */
const handleInsightWiederholen = handler(
  'Insight wiederholen',
  async (client, nutzerId, insightId, empfaenger) => {
    const { data, error } = await client
      .from('insights')
      .select('media_url, media_type, filter, dauer, einmal')
      .eq('id', insightId)
      .eq('sender_id', nutzerId)
      .single();
    if (error) throw error;

    return handleInsightSenden(client, nutzerId, empfaenger, {
      mediaUrl: data.media_url,
      mediaTyp: data.media_type,
      filter: data.filter,
      dauer: data.dauer,
      einmal: data.einmal,
    });
  }
);

const handleInsightZiel = handler('Empfängerliste', async (client, nutzerId, zielId) => {
  const drin = await umschalten(client, 'insight_targets', {
    user_id: nutzerId,
    target_id: zielId,
  });
  return { ok: true, drin };
});

// ------------------------------------------------ Nachrichten-Werkzeuge --

const handleNachrichtBearbeiten = handler(
  'Nachricht bearbeiten',
  async (client, nutzerId, nachrichtId, text) => {
    const { error } = await client
      .from('messages')
      .update({ text, edited_at: new Date().toISOString() })
      .eq('id', nachrichtId)
      .eq('sender_id', nutzerId);
    if (error) throw error;
    return { ok: true };
  }
);

/*
 * Zurücknehmen heißt: die Zeile bleibt stehen und bekommt deleted_at. Würde
 * sie gelöscht, verlören Antworten und Zitate ihren Bezug.
 */
const handleNachrichtZuruecknehmen = handler(
  'Nachricht zurücknehmen',
  async (client, nutzerId, nachrichtId) => {
    const { error } = await client
      .from('messages')
      .update({ deleted_at: new Date().toISOString(), text: '' })
      .eq('id', nachrichtId)
      .eq('sender_id', nutzerId);
    if (error) throw error;
    return { ok: true };
  }
);

const handleNachrichtWeiterleiten = handler(
  'Weiterleiten',
  async (client, nutzerId, nachrichtId, chatIds) => {
    if (!Array.isArray(chatIds) || !chatIds.length) {
      return { ok: false, fehler: 'Kein Ziel gewählt' };
    }

    const { data, error } = await client
      .from('messages')
      .select('text, media_url, media_type, file_name, file_size, sender_id')
      .eq('id', nachrichtId)
      .single();
    if (error) throw error;

    const { error: fehler } = await client.from('messages').insert(
      chatIds.map((chat_id) => ({
        chat_id,
        sender_id: nutzerId,
        text: data.text,
        media_url: data.media_url,
        media_type: data.media_type,
        file_name: data.file_name,
        file_size: data.file_size,
        forwarded_from: data.sender_id,
      }))
    );
    if (fehler) throw fehler;

    await client
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .in('id', chatIds);

    return { ok: true, anzahl: chatIds.length };
  }
);

/*
 * Eine Person hat je Nachricht genau eine Reaktion. Dasselbe Emoji noch
 * einmal nimmt es weg, ein anderes ersetzt das alte.
 */
const handleNachrichtReaktion = handler(
  'Reaktion',
  async (client, nutzerId, nachrichtId, emoji) => {
    const { data, error } = await client
      .from('message_reactions')
      .select('emoji')
      .eq('message_id', nachrichtId)
      .eq('user_id', nutzerId)
      .maybeSingle();
    if (error) throw error;

    if (data && data.emoji === emoji) {
      const { error: fehler } = await client
        .from('message_reactions')
        .delete()
        .eq('message_id', nachrichtId)
        .eq('user_id', nutzerId);
      if (fehler) throw fehler;
      return { ok: true, emoji: null };
    }

    const { error: fehler } = await client
      .from('message_reactions')
      .upsert({ message_id: nachrichtId, user_id: nutzerId, emoji });
    if (fehler) throw fehler;
    return { ok: true, emoji };
  }
);

// -------------------------------------------------------------- Umfragen --

const handleUmfrageAnlegen = handler(
  'Umfrage anlegen',
  async (client, nutzerId, traegerArt, traegerId, felder = {}) => {
    const antworten = (felder.antworten || []).map((t) => String(t).trim()).filter(Boolean);
    if (!felder.frage || !String(felder.frage).trim()) {
      return { ok: false, fehler: 'Die Frage fehlt' };
    }
    if (antworten.length < 2) {
      return { ok: false, fehler: 'Eine Umfrage braucht mindestens zwei Antworten' };
    }

    const { data, error } = await client
      .from('polls')
      .insert({
        user_id: nutzerId,
        traeger_art: traegerArt,
        traeger_id: traegerId,
        frage: String(felder.frage).trim(),
        mehrfach: Boolean(felder.mehrfach),
        ende_at: felder.endetNachStunden
          ? new Date(Date.now() + felder.endetNachStunden * 3600000).toISOString()
          : null,
      })
      .select('id')
      .single();
    if (error) throw error;

    const { error: fehler } = await client
      .from('poll_options')
      .insert(antworten.map((text, position) => ({ poll_id: data.id, text, position })));
    if (fehler) throw fehler;

    return { ok: true, id: data.id };
  }
);

const handleUmfrageStimmen = handler(
  'Abstimmen',
  async (client, nutzerId, pollId, optionId) => {
    const { data, error } = await client
      .from('polls')
      .select('mehrfach, ende_at')
      .eq('id', pollId)
      .single();
    if (error) throw error;

    if (data.ende_at && new Date(data.ende_at) < new Date()) {
      return { ok: false, fehler: 'Diese Umfrage ist beendet' };
    }

    // Bei einfacher Wahl ersetzt die neue Stimme die alte — sonst wäre die
    // Summe größer als die Zahl der Teilnehmer.
    if (!data.mehrfach) {
      const { error: fehlerAlt } = await client
        .from('poll_votes')
        .delete()
        .eq('poll_id', pollId)
        .eq('user_id', nutzerId)
        .neq('option_id', optionId);
      if (fehlerAlt) throw fehlerAlt;
    }

    const gewaehlt = await umschalten(client, 'poll_votes', {
      poll_id: pollId,
      option_id: optionId,
      user_id: nutzerId,
    });
    return { ok: true, gewaehlt };
  }
);

// ---------------------------------------------------- Sichtbarkeit (4x) --
//
//  Vier Stufen, nicht drei: Niemand · Niemand bis auf … · Alle bis auf … ·
//  Alle. Die beiden mittleren brauchen je eine Ausnahmeliste. Bis zum
//  01.09.2026 stand hier überall nur „Alle / Meine Kontakte / Niemand", und
//  „Alle bis auf meinen Chef" ließ sich nicht ausdrücken.

const STUFEN = ['niemand', 'niemand_bis_auf', 'alle_bis_auf', 'alle'];
const BEREICHE = [
  'standort',
  'story',
  'repost',
  'onlinestatus',
  'ptt',
  'likes',
  'download',
  'dm',
];

const handleSichtbarkeit = handler(
  'Sichtbarkeit setzen',
  async (client, nutzerId, bereich, stufe) => {
    if (!BEREICHE.includes(bereich)) return { ok: false, fehler: 'Unbekannter Bereich' };
    if (!STUFEN.includes(stufe)) return { ok: false, fehler: 'Unbekannte Stufe' };

    const { error } = await client
      .from('visibility_settings')
      .upsert(
        { user_id: nutzerId, bereich, stufe, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,bereich' }
      );
    if (error) throw error;
    return { ok: true, stufe };
  }
);

const handleSichtbarkeitAusnahme = handler(
  'Ausnahme',
  async (client, nutzerId, bereich, zielId) => {
    if (!BEREICHE.includes(bereich)) return { ok: false, fehler: 'Unbekannter Bereich' };
    const drin = await umschalten(client, 'visibility_exceptions', {
      user_id: nutzerId,
      bereich,
      target_id: zielId,
    });
    return { ok: true, drin };
  }
);

// ------------------------------------------------------- Altersschutz --
//
//  Unter 16 nur mit Zustimmung eines Erziehungsberechtigten, und der muss
//  selbst einen All-Media-Account besitzen. Deshalb ein Nutzername und keine
//  E-Mail-Adresse — eine Adresse kann jeder erfinden.

const handleAltersangabe = handler(
  'Altersangabe',
  async (client, nutzerId, geburtsdatum, guardianHandle) => {
    const geboren = new Date(geburtsdatum);
    if (Number.isNaN(geboren.getTime())) {
      return { ok: false, fehler: 'Das Geburtsdatum ist ungültig' };
    }

    const jetzt = new Date();
    let alter = jetzt.getFullYear() - geboren.getFullYear();
    const monat = jetzt.getMonth() - geboren.getMonth();
    if (monat < 0 || (monat === 0 && jetzt.getDate() < geboren.getDate())) alter--;

    if (alter < 0 || alter > 120) {
      return { ok: false, fehler: 'Das Geburtsdatum ist unglaubwürdig' };
    }

    const brauchtFreigabe = alter < 16;
    let guardianId = null;

    if (brauchtFreigabe) {
      if (!guardianHandle) {
        return {
          ok: false,
          fehler: 'Unter 16 braucht es einen Erziehungsberechtigten mit eigenem All-Media-Konto',
        };
      }
      const { data, error } = await client
        .from('profiles')
        .select('id')
        .eq('handle', String(guardianHandle).replace(/^@/, ''))
        .maybeSingle();
      if (error) throw error;
      if (!data) return { ok: false, fehler: 'Zu diesem Nutzernamen gibt es kein All-Media-Konto' };
      if (data.id === nutzerId) return { ok: false, fehler: 'Das eigene Konto geht nicht' };
      guardianId = data.id;
    }

    const { error } = await client
      .from('profiles')
      .update({
        geburtsdatum,
        guardian_id: guardianId,
        guardian_status: brauchtFreigabe ? 'angefragt' : 'keiner',
      })
      .eq('id', nutzerId);
    if (error) throw error;

    return { ok: true, alter, brauchtFreigabe, guardian: guardianId };
  }
);

const handleFreigabe = handler(
  'Freigabe',
  async (client, nutzerId, kindId, zustimmen) => {
    const { error } = await client
      .from('profiles')
      .update({ guardian_status: zustimmen ? 'bestaetigt' : 'abgelehnt' })
      .eq('id', kindId)
      .eq('guardian_id', nutzerId);
    if (error) throw error;
    return { ok: true, zustimmen: Boolean(zustimmen) };
  }
);

// --------------------------------------------------------- Wortfilter --
//
//  Die Liste steht in der Datenbank, damit sie sich ändern lässt, ohne App
//  und Website neu auszurollen. Die Prüfung läuft auf Wortgrenzen: sonst
//  gälte „Spastik" als Verstoß und ein medizinischer Beitrag ließe sich
//  nicht schreiben.

const handleWortfilter = handler('Wortfilter', async (client, _nutzerId, text) => {
  if (!text || !String(text).trim()) return { ok: true, treffer: null };

  const { data, error } = await client.from('filter_words').select('wort, schwere');
  if (error) throw error;

  const klein = String(text).toLowerCase();
  for (const eintrag of data || []) {
    const muster = new RegExp(
      `(^|[^a-zäöüß])${eintrag.wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zäöüß]|$)`,
      'i'
    );
    if (muster.test(klein)) return { ok: true, treffer: eintrag };
  }
  return { ok: true, treffer: null };
});

// ------------------------------------------------------- Push-to-Talk --
//
//  Bis zum 01.09.2026 war das ein Ein/Aus-Schalter in den Einstellungen —
//  geschickt wurde damit nie etwas. Im Handbuch ist es eine Funktion: eine
//  Sprachnachricht an alle Mitglieder einer Community.

const handlePtt = handler(
  'Push-to-Talk',
  async (client, nutzerId, communityId, audioUrl, dauer, channelId) => {
    const { data, error } = await client
      .from('ptt_messages')
      .insert({
        community_id: communityId,
        channel_id: channelId || null,
        sender_id: nutzerId,
        audio_url: audioUrl,
        dauer: Math.max(0, Math.round(Number(dauer) || 0)),
      })
      .select('id, created_at')
      .single();
    if (error) throw error;
    return { ok: true, id: data.id, zeit: data.created_at };
  }
);

// ------------------------------------------- Livestream: Kommentare, Spenden

const handleStreamKommentar = handler(
  'Streamkommentar',
  async (client, nutzerId, postId, text) => {
    if (!text || !String(text).trim()) return { ok: false, fehler: 'Leerer Kommentar' };
    const { data, error } = await client
      .from('stream_comments')
      .insert({ post_id: postId, user_id: nutzerId, text: String(text).trim() })
      .select('id, created_at')
      .single();
    if (error) throw error;
    return { ok: true, id: data.id, zeit: data.created_at };
  }
);

/*
 * Der Betrag steht in Cent, damit nichts gerundet wird. Eine echte Zahlung
 * läuft hier nicht: der Spendencode verweist auf Bankkarte oder PayPal, die
 * Buchung passiert dort. Hier wird festgehalten, dass sie stattfand.
 */
const handleSpende2 = handler(
  'Spende',
  async (client, nutzerId, empfaengerId, betragCent, postId, nachricht) => {
    const betrag = Math.round(Number(betragCent));
    if (!Number.isFinite(betrag) || betrag <= 0) {
      return { ok: false, fehler: 'Der Betrag muss größer als null sein' };
    }
    if (empfaengerId === nutzerId) return { ok: false, fehler: 'An sich selbst geht keine Spende' };

    const { data, error } = await client
      .from('donations')
      .insert({
        post_id: postId || null,
        empfaenger_id: empfaengerId,
        sender_id: nutzerId,
        betrag_cent: betrag,
        nachricht: nachricht || '',
      })
      .select('id, created_at')
      .single();
    if (error) throw error;
    return { ok: true, id: data.id };
  }
);

// ------------------------------------------------------ Standortanfrage --

const handleStandortAnfrage = handler(
  'Standortanfrage',
  async (client, nutzerId, chatId, zielId) => {
    const { data, error } = await client
      .from('location_requests')
      .insert({ chat_id: chatId, sender_id: nutzerId, ziel_id: zielId })
      .select('id, created_at')
      .single();
    if (error) throw error;
    return { ok: true, id: data.id };
  }
);

/*
 * `stunden` begrenzt die Freigabe. Ohne Angabe gilt sie ohne Frist — beides
 * steht so im Handbuch.
 */
const handleStandortAntwort = handler(
  'Standortantwort',
  async (client, nutzerId, anfrageId, annehmen, stunden) => {
    const { error } = await client
      .from('location_requests')
      .update({
        zustand: annehmen ? 'angenommen' : 'abgelehnt',
        bis_at:
          annehmen && stunden
            ? new Date(Date.now() + Number(stunden) * 3600000).toISOString()
            : null,
      })
      .eq('id', anfrageId)
      .eq('ziel_id', nutzerId);
    if (error) throw error;
    return { ok: true, angenommen: Boolean(annehmen) };
  }
);


module.exports = {
  handleUpdateProfile,
  handleFollowUser,
  handleAcceptContactRequest,
  handleChatAction,
  handleLeaveChat,
  handleClearChat,
  handleStarMessage,
  handleCreateGroup,
  handleChatMit,
  handleFindPerson,
  handleAddContact,
  handleAcceptRequest,
  handleContactFavorite,
  handleNotifyPost,
  handleShareToChats,
  handleStoryReply,
  handleCreateChannel,
  handleSendChannelMessage,
  handleProfilListe,
  handleSpende,
  handleLivestream,
  istNummer,
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
  handleCommunityStumm,
  handleEinstellung,
  handleProfilAufruf,
  handleReportContent,
  handleBlockUser,
  handleMuteUser,
  handleMarkNotificationRead,
  handleMarkAllNotificationsRead,
  handleMarkChatFavorite,

  // Handbuch-Abgleich 01.09.2026
  handleInsightSenden,
  handleInsightGesehen,
  handleInsightSpeichern,
  handleInsightWiederholen,
  handleInsightZiel,
  handleNachrichtBearbeiten,
  handleNachrichtZuruecknehmen,
  handleNachrichtWeiterleiten,
  handleNachrichtReaktion,
  handleUmfrageAnlegen,
  handleUmfrageStimmen,
  handleSichtbarkeit,
  handleSichtbarkeitAusnahme,
  handleAltersangabe,
  handleFreigabe,
  handleWortfilter,
  handlePtt,
  handleStreamKommentar,
  handleSpende2,
  handleStandortAnfrage,
  handleStandortAntwort,
};
