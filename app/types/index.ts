export type PresenceStatus = 'online' | 'away' | 'offline';
export type ContactStatus = 'friend' | 'pending' | 'blocked';
export type MediaType = 'image' | 'video' | 'audio';

export interface User {
  id: string;
  name: string;
  handle: string;
  status: PresenceStatus;
  about?: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  time: string;
  media?: MediaType;
  read?: boolean;
}

export interface Chat {
  id: string;
  name: string;
  /** Undefined for group chats. */
  userId?: string;
  isGroup: boolean;
  memberIds?: string[];
  preview: string;
  previewMedia?: MediaType;
  time: string;
  unreadCount: number;
  muted?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  status: ContactStatus;
  about: string;
}

export interface Story {
  id: string;
  userId: string;
  name: string;
  viewed: boolean;
  own?: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: User;
}
