/**
 * Sync Handlers — Bidirektionale Operationen zwischen Website und Supabase
 *
 * Diese Datei stellt Handler für alle schreibenden Operationen bereit,
 * die auf BEIDEN Plattformen (Expo + Website) gleich sein müssen.
 */

const supabaseApi = require('./supabase-api');
const { supabase } = require('./supabase');

/**
 * Sendet eine Nachricht (Messenger)
 */
async function handleSendMessage(chatId, senderId, content) {
  if (!supabase) return null;

  try {
    const result = await supabaseApi.sendMessage(chatId, senderId, content);
    return { success: !!result, message: result };
  } catch (error) {
    console.error('Error sending message:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Markiert eine Nachricht als gelesen
 */
async function handleMarkMessageAsRead(messageId) {
  if (!supabase) return null;

  try {
    const result = await supabaseApi.markMessageAsRead(messageId, true);
    return { success: !!result };
  } catch (error) {
    console.error('Error marking as read:', error);
    return { success: false };
  }
}

/**
 * Aktualisiert ein Profil (gleich wie in Expo App)
 */
async function handleUpdateProfile(userId, updates) {
  if (!supabase) return null;

  try {
    const result = await supabaseApi.updateProfile(userId, updates);
    return { success: !!result, profile: result };
  } catch (error) {
    console.error('Error updating profile:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Like/Unlike für Videos/Posts
 */
async function handleLikeContent(contentId, userId, contentType = 'video') {
  if (!supabase) return null;

  try {
    const { data: existing, error: checkError } = await supabase
      .from('likes')
      .select('id')
      .eq('content_id', contentId)
      .eq('user_id', userId)
      .eq('content_type', contentType)
      .single();

    if (existing) {
      // Unlike: delete
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('id', existing.id);

      if (error) throw error;
      return { success: true, liked: false };
    } else {
      // Like: insert
      const { error } = await supabase
        .from('likes')
        .insert({
          content_id: contentId,
          user_id: userId,
          content_type: contentType,
        });

      if (error && error.code !== '23505') throw error; // 23505 = unique violation (already exists)
      return { success: true, liked: true };
    }
  } catch (error) {
    console.error('Error handling like:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Follow/Unfollow eines Users
 */
async function handleFollowUser(userId, targetUserId) {
  if (!supabase) return null;

  try {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('contact_id', targetUserId)
      .single();

    if (existing) {
      // Unfollow: delete
      await supabase
        .from('contacts')
        .delete()
        .eq('id', existing.id);

      return { success: true, followed: false };
    } else {
      // Follow: insert
      const { error } = await supabase
        .from('contacts')
        .insert({
          user_id: userId,
          contact_id: targetUserId,
          status: 'friend',
        });

      if (error && error.code !== '23505') throw error;
      return { success: true, followed: true };
    }
  } catch (error) {
    console.error('Error handling follow:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aktualisiert Chat-Status (archiviert, stummgeschaltet, gelesen)
 */
async function handleChatAction(chatId, userId, action, value = true) {
  if (!supabase) return null;

  try {
    const updates = {};

    if (action === 'archived') updates.is_archived = value;
    if (action === 'muted') updates.is_muted = value;
    if (action === 'read') updates.is_read = value;

    if (Object.keys(updates).length === 0) {
      return { success: false, error: 'Unknown action' };
    }

    const { error } = await supabase
      .from('chat_members')
      .update(updates)
      .eq('chat_id', chatId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error handling chat action:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Erstellt einen Story
 */
async function handleCreateStory(userId, mediaUrl, caption = '') {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('stories')
      .insert({
        user_id: userId,
        media_url: mediaUrl,
        caption: caption,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, story: data };
  } catch (error) {
    console.error('Error creating story:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Markiert einen Story als angesehen
 */
async function handleViewStory(storyId, userId) {
  if (!supabase) return null;

  try {
    const { error } = await supabase
      .from('story_views')
      .insert({
        story_id: storyId,
        user_id: userId,
        viewed_at: new Date().toISOString(),
      });

    if (error && error.code !== '23505') throw error;
    return { success: true };
  } catch (error) {
    console.error('Error marking story as viewed:', error);
    return { success: false };
  }
}

/**
 * Kommentiert auf einen Post/Video
 */
async function handleCreateComment(contentId, userId, comment, contentType = 'video') {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        content_id: contentId,
        user_id: userId,
        comment: comment,
        content_type: contentType,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, comment: data };
  } catch (error) {
    console.error('Error creating comment:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  handleSendMessage,
  handleMarkMessageAsRead,
  handleUpdateProfile,
  handleLikeContent,
  handleFollowUser,
  handleChatAction,
  handleCreateStory,
  handleViewStory,
  handleCreateComment,
};
