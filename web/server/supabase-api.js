/**
 * All Media — Supabase API
 *
 * Diese Datei stellt alle API-Endpoints mit echten Supabase-Daten bereit.
 * Sie ersetzt die Mock-Daten aus app.js mit Abfragen der echten Datenbank.
 *
 * Struktur:
 * 1. Helper-Funktionen für häufige Queries
 * 2. Datenlader (profiles, chats, messages, etc.)
 * 3. Express Route Handler
 */

const { supabase, isConfigured } = require('./supabase');

// ============================================================================
// HELPER: Authentifizierung
// ============================================================================

/**
 * Holt den aktuellen User aus der Session
 * Für jetzt: nehmen wir "me" als aktuellen User (wie in Mock-Daten)
 */
async function getCurrentUser() {
  // TODO: Wenn echte Auth implementiert: hier den User aus der Session holen
  // Für jetzt: Mock-User "me" (wie in den bisherigen Mock-Daten)

  if (!supabase) return null;

  try {
    // Versuche den aktuellen User aus Supabase Auth zu holen
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    // Falls keine Session: nutze Mock-User
    console.warn('No auth session, using mock user');
    return null;
  }
}

/**
 * Holt ein User-Profil als User-Objekt (wie in Mock-Daten)
 */
async function getProfileAsUser(profileId) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, handle, bio, link, status, created_at, updated_at')
      .eq('id', profileId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    // Format wie Mock-Daten
    return {
      id: data.id,
      name: data.name,
      handle: data.handle,
      bio: data.bio || '',
      link: data.link || '',
      status: data.status || 'offline',
    };
  } catch (error) {
    console.error('Error fetching profile as user:', error);
    return null;
  }
}

// ============================================================================
// LOADER: Alle Daten für /api/bootstrap
// ============================================================================

/**
 * Lädt alle Users (Profile) aus Supabase
 */
async function loadUsers() {
  if (!supabase) return {};

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, handle, bio, link, status');

    if (error) throw error;

    // Konvertiere zu Mock-Format
    const users = {};
    data?.forEach(profile => {
      users[profile.id] = {
        id: profile.id,
        name: profile.name,
        handle: profile.handle,
        bio: profile.bio || '',
        link: profile.link || '',
        status: profile.status || 'offline',
      };
    });

    return users;
  } catch (error) {
    console.error('Error loading users:', error);
    return {};
  }
}

/**
 * Lädt alle Kontakte des aktuellen Users
 */
async function loadContacts(userId) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('contact_id, status')
      .eq('user_id', userId);

    if (error) throw error;

    return (data || []).map(c => ({
      id: c.contact_id,
      status: c.status,
    }));
  } catch (error) {
    console.error('Error loading contacts:', error);
    return [];
  }
}

/**
 * Lädt alle Chats für einen User
 */
async function loadChats(userId) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('chat_members')
      .select('chats(id, name, is_group, created_at, updated_at)')
      .eq('user_id', userId);

    if (error) throw error;

    return (data || [])
      .map(m => m.chats)
      .filter(Boolean)
      .map(chat => ({
        id: chat.id,
        name: chat.name,
        isGroup: chat.is_group,
      }));
  } catch (error) {
    console.error('Error loading chats:', error);
    return [];
  }
}

/**
 * Lädt die neuesten Nachrichten aus einem Chat (für Vorschau)
 */
async function loadChatPreview(chatId) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, created_at, sender_id, profiles(name)')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    console.error('Error loading chat preview:', error);
    return null;
  }
}

/**
 * Lädt Stories für den aktuellen User
 */
async function loadStories(userId) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('stories')
      .select('id, user_id, created_at, viewed_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data || []).map(story => ({
      id: story.id,
      userId: story.user_id,
      viewed: !!story.viewed_at,
    }));
  } catch (error) {
    console.error('Error loading stories:', error);
    return [];
  }
}

/**
 * Lädt Videos für den Feed
 */
async function loadVideos() {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('videos')
      .select('id, user_id, title, description, likes, comments, shares, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data || []).map(video => ({
      id: video.id,
      userId: video.user_id,
      title: video.title,
      description: video.description,
      likes: video.likes || 0,
      comments: video.comments || 0,
      shares: video.shares || 0,
    }));
  } catch (error) {
    console.error('Error loading videos:', error);
    return [];
  }
}

// ============================================================================
// MAIN: /api/bootstrap mit Supabase
// ============================================================================

async function bootstrapData() {
  if (!isConfigured()) {
    return null; // Fallback zu Mock-Daten in app.js
  }

  try {
    // Aktueller User
    const currentUser = await getCurrentUser();
    const userId = currentUser?.id || 'me'; // Fallback: Mock-User "me"

    // Alle Daten parallel laden
    const [users, contacts, chats, stories, videos] = await Promise.all([
      loadUsers(),
      loadContacts(userId),
      loadChats(userId),
      loadStories(userId),
      loadVideos(),
    ]);

    return {
      users,
      contacts,
      chats,
      stories,
      videos,
      currentUserId: userId,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error bootstrapping Supabase data:', error);
    return null; // Fallback zu Mock-Daten
  }
}

// ============================================================================
// MUTATION: Schreib-Operationen
// ============================================================================

/**
 * Speichert eine neue Nachricht
 */
async function sendMessage(chatId, senderId, content) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: senderId,
        content: content,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
  }
}

/**
 * Markiert eine Nachricht als gelesen
 */
async function markMessageAsRead(messageId, readAt = true) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('messages')
      .update({ read_at: readAt ? new Date().toISOString() : null })
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error marking message as read:', error);
    return null;
  }
}

/**
 * Aktualisiert ein Benutzerprofil
 */
async function updateProfile(userId, updates) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating profile:', error);
    return null;
  }
}

module.exports = {
  bootstrapData,
  getCurrentUser,
  getProfileAsUser,
  loadUsers,
  loadContacts,
  loadChats,
  loadStories,
  loadVideos,
  sendMessage,
  markMessageAsRead,
  updateProfile,
};
