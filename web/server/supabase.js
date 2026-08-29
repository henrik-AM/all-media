// Supabase-Client für den Server
// Verbindet die Website mit der gleichen Datenbank wie die App

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Supabase nicht konfiguriert — nutze Mock-Daten');
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

/**
 * Lädt alle Benutzerprofile aus Supabase
 */
async function getAllProfiles() {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(100);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return [];
  }
}

/**
 * Lädt ein einzelnes Profil
 */
async function getProfile(userId) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // 404 ist ok
    return data || null;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
}

/**
 * Lädt alle Chats für einen Benutzer
 */
async function getUserChats(userId) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('chat_members')
      .select('chats(*)')
      .eq('user_id', userId);

    if (error) throw error;
    return data?.map(m => m.chats).filter(Boolean) || [];
  } catch (error) {
    console.error('Error fetching chats:', error);
    return [];
  }
}

/**
 * Lädt Kontakte eines Benutzers
 */
async function getUserContacts(userId) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('profiles:contact_id(*)')
      .eq('user_id', userId)
      .eq('status', 'friend');

    if (error) throw error;
    return data?.map(c => c.profiles).filter(Boolean) || [];
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return [];
  }
}

/**
 * Lädt Nachrichten aus einem Chat
 */
async function getChatMessages(chatId) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(name, handle, initials, color)')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

/**
 * Überprüft ob Supabase konfiguriert ist
 */
function isConfigured() {
  return supabase !== null;
}

module.exports = {
  supabase,
  getAllProfiles,
  getProfile,
  getUserChats,
  getUserContacts,
  getChatMessages,
  isConfigured,
};
