import { useState, useCallback, useMemo } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

export function useSearchChats(chats: any[]) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return chats;

    const lowerQuery = query.toLowerCase();
    return chats.filter(
      (chat) =>
        (chat.name?.toLowerCase().includes(lowerQuery) ||
          chat.lastMessage?.text.toLowerCase().includes(lowerQuery)) ??
        false,
    );
  }, [chats, query]);

  return { query, setQuery, results };
}

export function useSearchContacts(contacts: any[]) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return contacts;

    const lowerQuery = query.toLowerCase();
    return contacts.filter(
      (contact) =>
        contact.name?.toLowerCase().includes(lowerQuery) ||
        contact.email?.toLowerCase().includes(lowerQuery) ||
        contact.phone?.includes(query),
    );
  }, [contacts, query]);

  return { query, setQuery, results };
}

// Search messages in Supabase
export function useSearchMessages(chatId: string) {
  const { supabase } = useSupabase();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(
    async (searchTerm: string) => {
      setQuery(searchTerm);
      if (!searchTerm.trim()) {
        setResults([]);
        return;
      }

      if (!supabase) return;

      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .ilike('content', `%${searchTerm}%`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data) {
          setResults(data);
        }
      } catch (err) {
        console.warn('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    },
    [supabase, chatId],
  );

  return { query, results, isSearching, handleSearch };
}

// Search users (for adding contacts)
export function useSearchUsers(currentUserId: string) {
  const { supabase } = useSupabase();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(
    async (searchTerm: string) => {
      setQuery(searchTerm);
      if (!searchTerm.trim()) {
        setResults([]);
        return;
      }

      if (!supabase) return;

      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .neq('id', currentUserId)
          .or(`display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
          .limit(20);

        if (!error && data) {
          setResults(data);
        }
      } catch (err) {
        console.warn('User search failed:', err);
      } finally {
        setIsSearching(false);
      }
    },
    [supabase, currentUserId],
  );

  return { query, results, isSearching, handleSearch };
}

// Search groups
export function useSearchGroups() {
  const { supabase } = useSupabase();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(
    async (searchTerm: string) => {
      setQuery(searchTerm);
      if (!searchTerm.trim()) {
        setResults([]);
        return;
      }

      if (!supabase) return;

      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('groups')
          .select('*')
          .ilike('name', `%${searchTerm}%`)
          .limit(20);

        if (!error && data) {
          setResults(data);
        }
      } catch (err) {
        console.warn('Group search failed:', err);
      } finally {
        setIsSearching(false);
      }
    },
    [supabase],
  );

  return { query, results, isSearching, handleSearch };
}
