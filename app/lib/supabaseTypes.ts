// Supabase table schemas (types mirror the database)

export interface SupabaseUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  status?: 'online' | 'away' | 'offline';
  created_at: string;
  updated_at: string;
}

export interface SupabaseContact {
  id: string;
  user_id: string;
  contact_id: string;
  status: 'friend' | 'pending' | 'blocked';
  created_at: string;
}

export interface SupabaseChat {
  id: string;
  user_ids: string[]; // Array of user IDs in chat
  type: 'direct' | 'group';
  name?: string; // Group name
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface SupabaseMessage {
  id: string;
  chat_id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: 'image' | 'video' | 'audio';
  created_at: string;
  read_at?: string;
}

export interface SupabaseStory {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  created_at: string;
  expires_at: string; // Stories expire after 24h
}

export interface SupabaseGroup {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  created_by: string;
  members: string[]; // User IDs
  created_at: string;
  updated_at: string;
}
