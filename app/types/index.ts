// User
export interface User {
  id: string;
  name: string;
  handle: string;
  avatar?: string;
  status?: 'online' | 'offline' | 'idle';
}

// Chat
export interface Chat {
  id: string;
  participantIds: string[];
  lastMessage?: Message;
  updatedAt: Date;
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;
  unreadCount?: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: Date;
  read: boolean;
  type?: 'text' | 'image' | 'video';
}

// Contact
export interface Contact {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;
  status: 'friend' | 'pending' | 'blocked';
  addedAt?: Date;
}

// Auth
export interface AuthUser {
  id: string;
  email: string;
  phone?: string;
  profile: User;
  contacts: Contact[];
}
