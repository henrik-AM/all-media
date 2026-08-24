import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSupabase } from '../contexts/SupabaseContext';

export interface PresenceState {
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: string;
}

export function usePresence(userId: string) {
  const { supabase } = useSupabase();
  const [status, setStatus] = useState<'online' | 'away' | 'offline'>('offline');
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!supabase || !userId) return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const newStatus = nextAppState === 'active' ? 'online' : 'away';
      setStatus(newStatus);

      try {
        // Update user status in database
        await supabase.from('users').update({ status: newStatus }).eq('id', userId);

        // Optionally, broadcast presence to Realtime subscribers
        supabase.channel(`user_presence:${userId}`).send('broadcast', {
          event: 'presence_change',
          payload: { userId, status: newStatus, timestamp: new Date().toISOString() },
        });
      } catch (err) {
        console.warn('Failed to update presence:', err);
      }

      setAppState(nextAppState);
    };

    // Initialize as online
    handleAppStateChange('active');

    return () => {
      // Mark as offline on unmount
      if (supabase) {
        supabase.from('users').update({ status: 'offline' }).eq('id', userId).catch(() => {});
      }
    };
  }, [supabase, userId]);

  return { status };
}

// Hook to subscribe to a contact's presence
export function useContactPresence(contactId: string) {
  const { supabase } = useSupabase();
  const [status, setStatus] = useState<'online' | 'away' | 'offline'>('offline');

  useEffect(() => {
    if (!supabase || !contactId) return;

    // Fetch initial status
    supabase
      .from('users')
      .select('status, updated_at')
      .eq('id', contactId)
      .single()
      .then(({ data }) => {
        if (data?.status) {
          setStatus(data.status);
        }
      });

    // Subscribe to presence changes
    const subscription = supabase
      .channel(`user_presence:${contactId}`)
      .on('broadcast', { event: 'presence_change' }, (payload) => {
        setStatus(payload.payload.status);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [supabase, contactId]);

  return { status };
}
