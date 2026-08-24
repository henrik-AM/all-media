import { useEffect, useState } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

// Generic Realtime subscription hook for any table
export function useSupabaseSubscription<T>(
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*' = '*',
  filter?: string,
) {
  const { supabase } = useSupabase();
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let subscription: any;

    async function subscribe() {
      try {
        subscription = supabase
          .channel(`${table}_changes`)
          .on(
            'postgres_changes',
            {
              event,
              schema: 'public',
              table,
              filter,
            },
            (payload) => {
              console.log(`[${table}] Realtime update:`, payload);
              // Update local state with new/updated/deleted records
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                setData((prev) => [...prev, payload.new]);
              } else if (payload.eventType === 'DELETE') {
                setData((prev) => prev.filter((item: any) => item.id !== payload.old.id));
              }
            },
          )
          .subscribe();

        setIsLoading(false);
      } catch (err) {
        console.warn('Subscription error:', err);
        setError(err instanceof Error ? err.message : 'Subscription failed');
        setIsLoading(false);
      }
    }

    subscribe();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [supabase, table, event, filter]);

  return { data, isLoading, error };
}

// Hook specifically for chat messages
export function useChatMessages(chatId: string) {
  const { supabase } = useSupabase();
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !chatId) {
      setIsLoading(false);
      return;
    }

    async function fetchMessages() {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });

        if (error) {
          console.warn('Fetch messages error:', error);
        } else {
          setMessages(data || []);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchMessages();

    // Subscribe to new/updated messages in this chat
    const subscription = supabase
      .channel(`chat_${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => [...prev, payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((m) => (m.id === payload.new.id ? payload.new : m))
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [supabase, chatId]);

  return { messages, isLoading };
}
