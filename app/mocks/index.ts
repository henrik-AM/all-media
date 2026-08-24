import { AuthUser, Chat, Contact, Message, Story, User } from '../types';

export const CURRENT_USER_ID = 'me';

export const mockUsers: Record<string, User> = {
  me: { id: 'me', name: 'Henrik', handle: '@henrik', status: 'online', about: 'Hey, ich nutze All Media!' },
  u1: { id: 'u1', name: 'Anna Schmidt', handle: '@anna', status: 'online', about: 'Verfügbar' },
  u2: { id: 'u2', name: 'Bob Müller', handle: '@bob', status: 'away', about: 'Im Meeting' },
  u3: { id: 'u3', name: 'Clara Weber', handle: '@clara', status: 'offline', about: 'Anfrage gesendet' },
  u4: { id: 'u4', name: 'David König', handle: '@david', status: 'away', about: 'Beschäftigt' },
  u5: { id: 'u5', name: 'Elif Yilmaz', handle: '@elif', status: 'online', about: 'Hey, ich nutze All Media!' },
  u6: { id: 'u6', name: 'Finn Bauer', handle: '@finn', status: 'offline', about: 'Nur dringende Anrufe' },
};

export const mockChats: Chat[] = [
  { id: 'c1', name: 'Anna Schmidt', userId: 'u1', isGroup: false, preview: 'Klingt gut, bis später!', time: '14:32', unreadCount: 2 },
  { id: 'c2', name: 'Bob Müller', userId: 'u2', isGroup: false, preview: 'Schicke dir die Datei gerade', time: '13:05', unreadCount: 1 },
  { id: 'c3', name: 'Clara Weber', userId: 'u3', isGroup: false, preview: 'Foto', previewMedia: 'image', time: '11:48', unreadCount: 0 },
  { id: 'c4', name: 'Projekt Team', isGroup: true, memberIds: ['u1', 'u2', 'u4'], preview: 'David: Meeting verschoben auf 15 Uhr', time: 'Gestern', unreadCount: 0, muted: true },
  { id: 'c5', name: 'David König', userId: 'u4', isGroup: false, preview: 'Alles klar', time: 'Gestern', unreadCount: 0 },
  { id: 'c6', name: 'Elif Yilmaz', userId: 'u5', isGroup: false, preview: 'Sprachnachricht', previewMedia: 'audio', time: 'Mo', unreadCount: 0 },
  { id: 'c7', name: 'Wochenend-Crew', isGroup: true, memberIds: ['u3', 'u5', 'u6'], preview: 'Elif: Wer ist dabei?', time: 'Mo', unreadCount: 0 },
  { id: 'c8', name: 'Finn Bauer', userId: 'u6', isGroup: false, preview: 'Danke dir!', time: 'So', unreadCount: 0 },
];

export const mockMessages: Record<string, Message[]> = {
  c1: [
    { id: 'm1', chatId: 'c1', senderId: 'u1', text: 'Hey! Wie läuft das Projekt?', time: '14:02' },
    { id: 'm2', chatId: 'c1', senderId: 'me', text: 'Läuft gut, bin fast fertig mit dem Design', time: '14:05', read: true },
    { id: 'm3', chatId: 'c1', senderId: 'u1', text: 'Super, kannst du mir das nachher zeigen?', time: '14:20' },
    { id: 'm4', chatId: 'c1', senderId: 'me', text: 'Klar, so gegen 17 Uhr?', time: '14:28', read: true },
    { id: 'm5', chatId: 'c1', senderId: 'u1', text: 'Klingt gut, bis später!', time: '14:32' },
  ],
  c2: [
    { id: 'm1', chatId: 'c2', senderId: 'u2', text: 'Hast du die Unterlagen schon?', time: '12:40' },
    { id: 'm2', chatId: 'c2', senderId: 'me', text: 'Noch nicht, kannst du sie schicken?', time: '12:55', read: true },
    { id: 'm3', chatId: 'c2', senderId: 'u2', text: 'Schicke dir die Datei gerade', time: '13:05' },
  ],
  c3: [
    { id: 'm1', chatId: 'c3', senderId: 'u3', text: 'Schau mal, was ich gefunden habe', time: '11:40' },
    { id: 'm2', chatId: 'c3', senderId: 'u3', text: 'Foto', time: '11:48', media: 'image' },
  ],
  c4: [
    { id: 'm1', chatId: 'c4', senderId: 'u1', text: 'Sind alle für morgen bereit?', time: 'Gestern' },
    { id: 'm2', chatId: 'c4', senderId: 'u2', text: 'Von meiner Seite ja', time: 'Gestern' },
    { id: 'm3', chatId: 'c4', senderId: 'me', text: 'Ich auch', time: 'Gestern', read: true },
    { id: 'm4', chatId: 'c4', senderId: 'u4', text: 'Meeting verschoben auf 15 Uhr', time: 'Gestern' },
  ],
  c5: [
    { id: 'm1', chatId: 'c5', senderId: 'me', text: 'Ich melde mich morgen bei dir', time: 'Gestern', read: true },
    { id: 'm2', chatId: 'c5', senderId: 'u4', text: 'Alles klar', time: 'Gestern' },
  ],
  c6: [{ id: 'm1', chatId: 'c6', senderId: 'u5', text: 'Sprachnachricht', time: 'Mo', media: 'audio' }],
  c7: [
    { id: 'm1', chatId: 'c7', senderId: 'u3', text: 'Samstag Grillen?', time: 'Mo' },
    { id: 'm2', chatId: 'c7', senderId: 'u5', text: 'Wer ist dabei?', time: 'Mo' },
  ],
  c8: [
    { id: 'm1', chatId: 'c8', senderId: 'me', text: 'Kein Problem!', time: 'So', read: true },
    { id: 'm2', chatId: 'c8', senderId: 'u6', text: 'Danke dir!', time: 'So' },
  ],
};

export const mockContacts: Contact[] = [
  { id: 'u1', name: 'Anna Schmidt', status: 'friend', about: 'Verfügbar' },
  { id: 'u2', name: 'Bob Müller', status: 'friend', about: 'Im Meeting' },
  { id: 'u3', name: 'Clara Weber', status: 'pending', about: 'Anfrage gesendet' },
  { id: 'u4', name: 'David König', status: 'friend', about: 'Beschäftigt' },
  { id: 'u5', name: 'Elif Yilmaz', status: 'friend', about: 'Hey, ich nutze All Media!' },
  { id: 'u6', name: 'Finn Bauer', status: 'friend', about: 'Nur dringende Anrufe' },
];

export const mockStories: Story[] = [
  { id: 's0', userId: 'me', name: 'Deine Story', viewed: false, own: true },
  { id: 's1', userId: 'u1', name: 'Anna', viewed: false },
  { id: 's2', userId: 'u2', name: 'Bob', viewed: false },
  { id: 's3', userId: 'u3', name: 'Clara', viewed: false },
  { id: 's4', userId: 'u4', name: 'David', viewed: true },
  { id: 's5', userId: 'u5', name: 'Elif', viewed: true },
  { id: 's6', userId: 'u6', name: 'Finn', viewed: true },
];

export const mockCurrentUser: AuthUser = {
  id: CURRENT_USER_ID,
  email: 'henrik@example.com',
  profile: mockUsers.me,
};
