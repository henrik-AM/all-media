export type PresenceStatus = 'online' | 'away' | 'offline';
export type ContactStatus = 'friend' | 'pending' | 'blocked';
export type MediaType = 'image' | 'video' | 'audio';

export interface User {
  id: string;
  name: string;
  handle: string;
  status: PresenceStatus;
  about?: string;
  /** Fuer das Finden ueber die Telefonnummer statt ueber den Benutzernamen. */
  phone?: string;
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
  /**
   * 'pending' = Kontaktanfrage laeuft noch. Bis zur Annahme ist genau eine
   * Nachricht erlaubt, danach ist das Eingabefeld gesperrt.
   */
  requestState?: 'pending' | 'accepted';
}

export interface Contact {
  id: string;
  name: string;
  status: ContactStatus;
  about: string;
  phone?: string;
}

export interface Profile {
  userId: string;
  bio: string;
  link: string;
  posts: number;
  followers: number;
  following: number;
  isFollowing: boolean;
  highlights: string[];
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  time: string;
  likes: number;
  liked: boolean;
}

export interface Post {
  id: string;
  userId: string;
  location: string;
  music: string;
  description: string;
  likedBy: string;
  likes: number;
  comments: number;
  liked: boolean;
  saved: boolean;
  following: boolean;
  notify: boolean;
  /** Wie oft der Beitrag geteilt wurde, und ob man selbst dabei ist. */
  reposts: number;
  reposted: boolean;
}

export interface Video {
  id: string;
  userId: string;
  description: string;
  location: string;
  music: string;
  likes: number;
  comments: number;
  shares: number;
  liked: boolean;
  saved: boolean;
  reposted: boolean;
}

export interface Community {
  id: string;
  name: string;
  topic: string;
  members: number;
  visibility: 'public' | 'private';
  joined: boolean;
  unreadCount: number;
}

export interface Story {
  id: string;
  userId: string;
  name: string;
  viewed: boolean;
  own?: boolean;
  liked?: boolean;
  caption?: string;
  /**
   * Bei der eigenen Story: die aufgenommene Datei. Solange leer, fuehrt ein
   * Tippen zur Kamera; sobald gefuellt, oeffnet sich der Betrachter.
   */
  mediaUri?: string;
  /** Wann sie aufgenommen wurde - fuer "vor 3 Min." im Betrachter. */
  aufgenommen?: number;
}

/** Querformat-Video aus dem Prototyp-Frame "Videos - Querformat". */
export interface Clip {
  id: string;
  userId: string;
  title: string;
  duration: string;
  views: number;
  age: string;
}

/** Eintrag der Friend-Map. x/y sind Prozentwerte auf der Kartenflaeche. */
export interface FriendPin {
  id: string;
  x: number;
  y: number;
  place: string;
  when: string;
}

export interface Hashtag {
  tag: string;
  posts: number;
}

export interface Sound {
  id: string;
  title: string;
  artist: string;
  uses: number;
}

export interface Place {
  id: string;
  name: string;
  posts: number;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: User;
}
