/**
 * Erweiterte Sync Handlers — ALLE Operationen
 * Diese Datei wird require('./sync-handlers-extended') hinzugefügt zu app.js
 * Enthält Handler für ALLE 50 Endpoints
 */

const supabaseApi = require('./supabase-api');
const { supabase } = require('./supabase');

// ============================================================================
// STORIES
// ============================================================================

async function handleLikeStory(storyId, userId) {
  if (!supabase) return null;
  try {
    const { data: existing } = await supabase
      .from('story_likes')
      .select('id')
      .eq('story_id', storyId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      await supabase.from('story_likes').delete().eq('id', existing.id);
      return { success: true, liked: false };
    } else {
      await supabase.from('story_likes').insert({ story_id: storyId, user_id: userId });
      return { success: true, liked: true };
    }
  } catch (error) {
    console.error('Error liking story:', error);
    return { success: false };
  }
}

async function handleViewStory(storyId, userId) {
  if (!supabase) return null;
  try {
    await supabase.from('story_views').insert({
      story_id: storyId,
      user_id: userId,
      viewed_at: new Date().toISOString(),
    }).onConflict('story_id,user_id').upsert();
    return { success: true };
  } catch (error) {
    console.error('Error marking story viewed:', error);
    return { success: false };
  }
}

// ============================================================================
// COMMENTS
// ============================================================================

async function handleCreateComment(contentId, userId, text, contentType = 'video') {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        content_id: contentId,
        user_id: userId,
        text: text,
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

async function handleLikeComment(commentId, userId) {
  if (!supabase) return null;
  try {
    const { data: existing } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      await supabase.from('comment_likes').delete().eq('id', existing.id);
      return { success: true, liked: false };
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId });
      return { success: true, liked: true };
    }
  } catch (error) {
    console.error('Error liking comment:', error);
    return { success: false };
  }
}

async function handleDeleteComment(commentId, userId) {
  if (!supabase) return null;
  try {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting comment:', error);
    return { success: false };
  }
}

// ============================================================================
// POSTS & VIDEOS
// ============================================================================

async function handleCreatePost(userId, content, images = []) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        content: content,
        images: images,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, post: data };
  } catch (error) {
    console.error('Error creating post:', error);
    return { success: false, error: error.message };
  }
}

async function handleCreateVideo(userId, title, description, videoUrl) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('videos')
      .insert({
        user_id: userId,
        title: title,
        description: description,
        video_url: videoUrl,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, video: data };
  } catch (error) {
    console.error('Error creating video:', error);
    return { success: false, error: error.message };
  }
}

async function handleDeleteContent(contentId, userId, contentType = 'post') {
  if (!supabase) return null;
  try {
    const table = contentType === 'video' ? 'videos' : contentType === 'post' ? 'posts' : null;
    if (!table) return { success: false, error: 'Unknown content type' };

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', contentId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting content:', error);
    return { success: false };
  }
}

async function handleSaveContent(contentId, userId, contentType = 'video') {
  if (!supabase) return null;
  try {
    const { data: existing } = await supabase
      .from('saves')
      .select('id')
      .eq('content_id', contentId)
      .eq('user_id', userId)
      .eq('content_type', contentType)
      .single();

    if (existing) {
      await supabase.from('saves').delete().eq('id', existing.id);
      return { success: true, saved: false };
    } else {
      await supabase.from('saves').insert({
        content_id: contentId,
        user_id: userId,
        content_type: contentType,
      });
      return { success: true, saved: true };
    }
  } catch (error) {
    console.error('Error saving content:', error);
    return { success: false };
  }
}

async function handleShareContent(contentId, recipients, contentType = 'video') {
  if (!supabase) return null;
  try {
    const shares = recipients.map(userId => ({
      content_id: contentId,
      shared_by: 'me',
      shared_to: userId,
      content_type: contentType,
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('shares').insert(shares);
    if (error) throw error;

    return { success: true, shared: recipients.length };
  } catch (error) {
    console.error('Error sharing content:', error);
    return { success: false };
  }
}

async function handleRepostContent(contentId, userId, contentType = 'video') {
  if (!supabase) return null;
  try {
    const { data: existing } = await supabase
      .from('reposts')
      .select('id')
      .eq('content_id', contentId)
      .eq('user_id', userId)
      .eq('content_type', contentType)
      .single();

    if (existing) {
      await supabase.from('reposts').delete().eq('id', existing.id);
      return { success: true, reposted: false };
    } else {
      await supabase.from('reposts').insert({
        content_id: contentId,
        user_id: userId,
        content_type: contentType,
        created_at: new Date().toISOString(),
      });
      return { success: true, reposted: true };
    }
  } catch (error) {
    console.error('Error reposting content:', error);
    return { success: false };
  }
}

// ============================================================================
// COMMUNITIES
// ============================================================================

async function handleCreateCommunity(userId, name, description, isPrivate = false) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('communities')
      .insert({
        creator_id: userId,
        name: name,
        description: description,
        is_private: isPrivate,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, community: data };
  } catch (error) {
    console.error('Error creating community:', error);
    return { success: false, error: error.message };
  }
}

async function handleJoinCommunity(communityId, userId) {
  if (!supabase) return null;
  try {
    const { data: existing } = await supabase
      .from('community_members')
      .select('id')
      .eq('community_id', communityId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      await supabase.from('community_members').delete().eq('id', existing.id);
      return { success: true, joined: false };
    } else {
      await supabase.from('community_members').insert({
        community_id: communityId,
        user_id: userId,
        joined_at: new Date().toISOString(),
      });
      return { success: true, joined: true };
    }
  } catch (error) {
    console.error('Error joining community:', error);
    return { success: false };
  }
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

async function handleMarkNotificationRead(notificationId, userId) {
  if (!supabase) return null;
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error marking notification read:', error);
    return { success: false };
  }
}

async function handleMarkAllNotificationsRead(userId, area) {
  if (!supabase) return null;
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('area', area);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    return { success: false };
  }
}

// ============================================================================
// REPORTING & BLOCKING
// ============================================================================

async function handleReportContent(contentId, userId, reason, contentType = 'video') {
  if (!supabase) return null;
  try {
    const { error } = await supabase
      .from('reports')
      .insert({
        content_id: contentId,
        reported_by: userId,
        reason: reason,
        content_type: contentType,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error reporting content:', error);
    return { success: false };
  }
}

async function handleBlockUser(userId, blockId) {
  if (!supabase) return null;
  try {
    const { data: existing } = await supabase
      .from('blocks')
      .select('id')
      .eq('user_id', userId)
      .eq('blocked_user_id', blockId)
      .single();

    if (existing) {
      await supabase.from('blocks').delete().eq('id', existing.id);
      return { success: true, blocked: false };
    } else {
      await supabase.from('blocks').insert({
        user_id: userId,
        blocked_user_id: blockId,
        created_at: new Date().toISOString(),
      });
      return { success: true, blocked: true };
    }
  } catch (error) {
    console.error('Error blocking user:', error);
    return { success: false };
  }
}

async function handleMuteUser(userId, muteId) {
  if (!supabase) return null;
  try {
    const { data: existing } = await supabase
      .from('mutes')
      .select('id')
      .eq('user_id', userId)
      .eq('muted_user_id', muteId)
      .single();

    if (existing) {
      await supabase.from('mutes').delete().eq('id', existing.id);
      return { success: true, muted: false };
    } else {
      await supabase.from('mutes').insert({
        user_id: userId,
        muted_user_id: muteId,
        created_at: new Date().toISOString(),
      });
      return { success: true, muted: true };
    }
  } catch (error) {
    console.error('Error muting user:', error);
    return { success: false };
  }
}

// ============================================================================
// OTHER ACTIONS
// ============================================================================

async function handleMarkChatFavorite(chatId, userId) {
  if (!supabase) return null;
  try {
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      await supabase.from('favorites').delete().eq('id', existing.id);
      return { success: true, favorite: false };
    } else {
      await supabase.from('favorites').insert({
        chat_id: chatId,
        user_id: userId,
      });
      return { success: true, favorite: true };
    }
  } catch (error) {
    console.error('Error marking favorite:', error);
    return { success: false };
  }
}

async function handleAcceptContactRequest(contactRequestId, userId) {
  if (!supabase) return null;
  try {
    const { error } = await supabase
      .from('contacts')
      .update({ status: 'friend' })
      .eq('id', contactRequestId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error accepting contact request:', error);
    return { success: false };
  }
}

module.exports = {
  handleLikeStory,
  handleViewStory,
  handleCreateComment,
  handleLikeComment,
  handleDeleteComment,
  handleCreatePost,
  handleCreateVideo,
  handleDeleteContent,
  handleSaveContent,
  handleShareContent,
  handleRepostContent,
  handleCreateCommunity,
  handleJoinCommunity,
  handleMarkNotificationRead,
  handleMarkAllNotificationsRead,
  handleReportContent,
  handleBlockUser,
  handleMuteUser,
  handleMarkChatFavorite,
  handleAcceptContactRequest,
};
