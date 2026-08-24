import React, { useEffect, useCallback } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

// Track message read status
export function useReadReceipts(chatId: string, userId: string) {
  const { supabase } = useSupabase();

  const markMessagesAsRead = useCallback(
    async (messageIds: string[]) => {
      if (!supabase || messageIds.length === 0) return;

      try {
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', messageIds)
          .eq('chat_id', chatId);
      } catch (err) {
        console.warn('Failed to mark as read:', err);
      }
    },
    [supabase, chatId],
  );

  const markChatAsRead = useCallback(async () => {
    if (!supabase) return;

    try {
      // Get all unread messages in this chat
      const { data: unreadMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('chat_id', chatId)
        .is('read_at', null)
        .neq('user_id', userId);

      if (unreadMessages && unreadMessages.length > 0) {
        const ids = unreadMessages.map((m) => m.id);
        await markMessagesAsRead(ids);
      }
    } catch (err) {
      console.warn('Failed to mark chat as read:', err);
    }
  }, [supabase, chatId, userId, markMessagesAsRead]);

  return { markMessagesAsRead, markChatAsRead };
}

// Hook to get unread count
export function useUnreadCount(userId: string) {
  const { supabase } = useSupabase();
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    if (!supabase) return;

    // Fetch initial count
    const fetchUnreadCount = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('chat_id', { count: 'exact' })
        .is('read_at', null)
        .neq('user_id', userId);

      if (!error && data) {
        setUnreadCount(data.length);
      }
    };

    fetchUnreadCount();

    // Subscribe to new messages
    const subscription = supabase
      .channel(`unread:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `user_id=neq.${userId}`,
        },
        () => {
          fetchUnreadCount(); // Refresh count on new message
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [supabase, userId]);

  return { unreadCount };
}
