import { AuthUser, Chat, Community, Contact, Message, Story, User, Video } from '../types';

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

export const mockVideos: Video[] = [
  { id: 'v1', userId: 'u1', description: 'Sonnenaufgang über den Alpen. Vier Uhr aufstehen hat sich gelohnt.', location: 'Zugspitze', music: 'Ambient Sunrise – Nora K.', likes: 12400, comments: 218, shares: 96, liked: false, saved: false },
  { id: 'v2', userId: 'u4', description: 'So richtet ihr euer Home-Office in 60 Sekunden ein.', location: 'Köln', music: 'Lo-Fi Focus – beatlab', likes: 8210, comments: 143, shares: 61, liked: true, saved: true },
  { id: 'v3', userId: 'u5', description: 'Rezept: Pasta in 10 Minuten, ohne Sahne und trotzdem cremig.', location: 'Hamburg', music: 'Kitchen Groove – Milo', likes: 24800, comments: 512, shares: 340, liked: false, saved: false },
  { id: 'v4', userId: 'u2', description: 'Erster Laufversuch mit der neuen Kamera-Stabilisierung.', location: 'Rheinpark', music: 'Runner High – Aster', likes: 3140, comments: 74, shares: 22, liked: false, saved: false },
  { id: 'v5', userId: 'u6', description: 'Warum kleine Commits dein Leben leichter machen.', location: 'Berlin', music: 'Originalton', likes: 5670, comments: 189, shares: 118, liked: false, saved: false },
];

export const mockCommunities: Community[] = [
  { id: 'k1', name: 'Design Systeme', topic: 'Komponenten, Tokens, Figma', members: 1284, visibility: 'public', joined: true, unreadCount: 3 },
  { id: 'k2', name: 'React Native DE', topic: 'Expo, Navigation, Performance', members: 842, visibility: 'public', joined: true, unreadCount: 0 },
  { id: 'k3', name: 'Fotografie', topic: 'Licht, Komposition, Nachbearbeitung', members: 3120, visibility: 'public', joined: false, unreadCount: 0 },
  { id: 'k4', name: 'Team Intern', topic: 'Nur für das Kernteam', members: 12, visibility: 'private', joined: true, unreadCount: 5 },
  { id: 'k5', name: 'Laufgruppe Köln', topic: 'Treffpunkte und Termine', members: 96, visibility: 'private', joined: true, unreadCount: 0 },
  { id: 'k6', name: 'Musikproduktion', topic: 'Ableton, Mixing, Sounddesign', members: 671, visibility: 'public', joined: false, unreadCount: 0 },
];

export const mockCommunityMessages: Record<string, Message[]> = {
  k1: [
    { id: 'm1', chatId: 'k1', senderId: 'u1', text: 'Hat jemand Erfahrung mit Design Tokens in Figma Variables?', time: '09:12' },
    { id: 'm2', chatId: 'k1', senderId: 'u4', text: 'Ja, wir nutzen das seit einem halben Jahr produktiv', time: '09:20' },
    { id: 'm3', chatId: 'k1', senderId: 'me', text: 'Wie handhabt ihr Dark Mode dabei?', time: '09:24', read: true },
    { id: 'm4', chatId: 'k1', senderId: 'u4', text: 'Zwei Modi in einer Collection, das reicht meistens', time: '09:31' },
  ],
  k2: [
    { id: 'm1', chatId: 'k2', senderId: 'u2', text: 'Expo SDK 57 läuft bei mir stabil', time: 'Gestern' },
    { id: 'm2', chatId: 'k2', senderId: 'u5', text: 'Bei mir auch, nur der Metro Cache zickt manchmal', time: 'Gestern' },
  ],
  k3: [{ id: 'm1', chatId: 'k3', senderId: 'u3', text: 'Goldene Stunde heute um 19:40', time: 'Mo' }],
  k4: [
    { id: 'm1', chatId: 'k4', senderId: 'u1', text: 'Sprint-Planung morgen um 10 Uhr', time: '11:02' },
    { id: 'm2', chatId: 'k4', senderId: 'me', text: 'Bin dabei', time: '11:05', read: true },
  ],
  k5: [{ id: 'm1', chatId: 'k5', senderId: 'u6', text: 'Samstag 8 Uhr am Rheinpark?', time: 'So' }],
  k6: [{ id: 'm1', chatId: 'k6', senderId: 'u5', text: 'Neuer Track ist fertig gemischt', time: 'Sa' }],
};

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
