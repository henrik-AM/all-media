import React, { useEffect, useRef, useCallback } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

export function useTypingIndicator(chatId: string, userId: string) {
  const { supabase } = useSupabase();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sendTypingIndicator = useCallback(async () => {
    if (!supabase || !chatId) return;

    try {
      // Broadcast that user is typing
      await supabase.channel(`chat:${chatId}`).send('broadcast', {
        event: 'user_typing',
        payload: { userId, isTyping: true },
      });

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing indicator after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        supabase.channel(`chat:${chatId}`).send('broadcast', {
          event: 'user_typing',
          payload: { userId, isTyping: false },
        });
      }, 3000);
    } catch (err) {
      console.warn('Typing indicator failed:', err);
    }
  }, [supabase, chatId, userId]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return { sendTypingIndicator };
}

export function useWhoIsTyping(chatId: string) {
  const { supabase } = useSupabase();
  const [typingUsers, setTypingUsers] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!supabase || !chatId) return;

    const subscription = supabase
      .channel(`chat:${chatId}`)
      .on('broadcast', { event: 'user_typing' }, (payload) => {
        const { userId, isTyping } = payload.payload;

        setTypingUsers((prev) => {
          if (isTyping) {
            return prev.includes(userId) ? prev : [...prev, userId];
          } else {
            return prev.filter((id) => id !== userId);
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [supabase, chatId]);

  return { typingUsers };
}
