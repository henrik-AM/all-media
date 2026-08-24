import { User, Chat, Message, Contact, AuthUser } from '../types';

export const mockUsers: Record<string, User> = {
  user1: { id: 'user1', name: 'Anna Schmidt', handle: '@anna', status: 'online' },
  user2: { id: 'user2', name: 'Bob Müller', handle: '@bob', status: 'offline' },
  user3: { id: 'user3', name: 'Clara Weber', handle: '@clara', status: 'online' },
  currentUser: { id: 'current', name: 'Du', handle: '@yourhandle', status: 'online' },
};

export const mockMessages: Message[] = [
  {
    id: 'msg1',
    chatId: 'chat1',
    senderId: 'user1',
    text: 'Hey, wie gehts?',
    timestamp: new Date(Date.now() - 5 * 60000),
    read: true,
  },
  {
    id: 'msg2',
    chatId: 'chat1',
    senderId: 'current',
    text: 'Mir gehts gut!',
    timestamp: new Date(Date.now() - 3 * 60000),
    read: true,
  },
];

export const mockChats: Chat[] = [
  {
    id: 'chat1',
    participantIds: ['current', 'user1'],
    lastMessage: mockMessages[1],
    updatedAt: new Date(),
    isGroup: false,
    unreadCount: 0,
  },
  {
    id: 'chat2',
    participantIds: ['current', 'user2'],
    isGroup: false,
    updatedAt: new Date(Date.now() - 1 * 3600000),
    unreadCount: 1,
  },
];

export const mockContacts: Contact[] = [
  { id: 'c1', userId: 'user1', name: 'Anna', status: 'friend' },
  { id: 'c2', userId: 'user2', name: 'Bob', status: 'friend' },
  { id: 'c3', userId: 'user3', name: 'Clara', status: 'pending' },
];

export const mockCurrentUser: AuthUser = {
  id: 'current',
  email: 'user@example.com',
  profile: mockUsers.currentUser,
  contacts: mockContacts,
};
