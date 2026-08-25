import { AuthUser, Chat, Clip, Comment, Community, Contact, FriendPin, Hashtag, Message, Place, Post, Profile, Sound, Story, User, Video } from '../types';

export const CURRENT_USER_ID = 'me';

export const mockUsers: Record<string, User> = {
  me: { id: 'me', name: 'Henrik', handle: '@henrik', status: 'online', about: 'Hey, ich nutze All Media!', phone: '+49 170 1234567' },
  u1: { id: 'u1', name: 'Anna Schmidt', handle: '@anna', status: 'online', about: 'Verfügbar', phone: '+49 151 2345678' },
  u2: { id: 'u2', name: 'Bob Müller', handle: '@bob', status: 'away', about: 'Im Meeting', phone: '+49 152 3456789' },
  u3: { id: 'u3', name: 'Clara Weber', handle: '@clara', status: 'offline', about: 'Anfrage gesendet', phone: '+49 160 4567890' },
  u4: { id: 'u4', name: 'David König', handle: '@david', status: 'away', about: 'Beschäftigt', phone: '+49 171 5678901' },
  u5: { id: 'u5', name: 'Elif Yilmaz', handle: '@elif', status: 'online', about: 'Hey, ich nutze All Media!', phone: '+49 172 6789012' },
  u6: { id: 'u6', name: 'Finn Bauer', handle: '@finn', status: 'offline', about: 'Nur dringende Anrufe', phone: '+49 173 7890123' },
  // Diese drei stehen bewusst NICHT in den Kontakten - sonst laesst sich
  // "Kontakt hinzufuegen" gar nicht ausprobieren.
  u7: { id: 'u7', name: 'Greta Hoffmann', handle: '@greta', status: 'online', about: 'Hey, ich nutze All Media!', phone: '+49 174 8901234' },
  u8: { id: 'u8', name: 'Hakan Demir', handle: '@hakan', status: 'away', about: 'Unterwegs', phone: '+49 175 9012345' },
  u9: { id: 'u9', name: 'Ida Nowak', handle: '@ida', status: 'offline', about: 'Bin bald zurück', phone: '+49 176 0123456' },
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

export const mockProfiles: Record<string, Profile> = {
  u1: { userId: 'u1', bio: 'Bergsteigerin und Fotografin. Immer auf der Suche nach dem ersten Licht.', link: 'anna-schmidt.de', posts: 148, followers: 12400, following: 312, isFollowing: true, highlights: ['Alpen', 'Ausrüstung', 'Touren'] },
  u2: { userId: 'u2', bio: 'Entwickler. Schreibt über Expo, Navigation und Performance.', link: 'bobmueller.dev', posts: 63, followers: 2140, following: 189, isFollowing: true, highlights: ['Talks', 'Setup'] },
  u3: { userId: 'u3', bio: 'Hafen, Hamburg, Hochformat.', link: 'clara.photo', posts: 421, followers: 8730, following: 640, isFollowing: true, highlights: ['Hafen', 'Nebel', 'Nacht'] },
  u4: { userId: 'u4', bio: 'Produktdesign und Design Systeme. Kaffee als Grundnahrungsmittel.', link: 'davidkoenig.design', posts: 97, followers: 5310, following: 274, isFollowing: true, highlights: ['Tokens', 'Prozess'] },
  u5: { userId: 'u5', bio: 'Kochen ohne Schnickschnack. Rezepte unter zehn Minuten.', link: 'elif-kocht.de', posts: 289, followers: 31200, following: 128, isFollowing: false, highlights: ['Pasta', 'Meal Prep', 'Basics'] },
  u6: { userId: 'u6', bio: 'Schreibt Software und läuft danach zwanzig Kilometer.', link: 'finnbauer.io', posts: 54, followers: 1180, following: 402, isFollowing: true, highlights: ['Laufen'] },
  me: { userId: 'me', bio: 'Baue gerade All Media.', link: 'all-media.app', posts: 12, followers: 340, following: 186, isFollowing: false, highlights: ['Projekt'] },
};

export const mockComments: Record<string, Comment[]> = {
  p1: [
    { id: 'cm1', userId: 'u1', text: 'Das Licht ist der Wahnsinn. Welche Blende?', time: '07:12', likes: 12, liked: false },
    { id: 'cm2', userId: 'u3', text: 'f/8, Stativ und zehn Sekunden Belichtung.', time: '07:20', likes: 4, liked: false },
    { id: 'cm3', userId: 'u4', text: 'Da will ich auch mal hin.', time: '08:02', likes: 1, liked: false },
  ],
  p2: [
    { id: 'cm1', userId: 'u2', text: 'Welche Monitore sind das?', time: 'Gestern', likes: 3, liked: false },
    { id: 'cm2', userId: 'u5', text: 'Zwei 27 Zoll, nichts Besonderes, aber gleiche Höhe ist wichtig.', time: 'Gestern', likes: 7, liked: true },
  ],
  p3: [{ id: 'cm1', userId: 'u6', text: 'Respekt für den Aufstieg!', time: 'Mo', likes: 22, liked: false }],
  p4: [{ id: 'cm1', userId: 'u1', text: 'Kann ich nur unterschreiben.', time: 'So', likes: 5, liked: false }],
  v1: [
    { id: 'cm1', userId: 'u4', text: 'Wie früh musstest du los?', time: '05:40', likes: 8, liked: false },
    { id: 'cm2', userId: 'u1', text: 'Vier Uhr ab Parkplatz, dann zwei Stunden hoch.', time: '05:55', likes: 15, liked: false },
  ],
  v2: [{ id: 'cm1', userId: 'u6', text: 'Kurz und hilfreich, danke.', time: 'Gestern', likes: 6, liked: false }],
  v3: [
    { id: 'cm1', userId: 'u2', text: 'Ohne Sahne cremig? Verrate das Geheimnis.', time: 'Mo', likes: 31, liked: false },
    { id: 'cm2', userId: 'u5', text: 'Nudelwasser. Immer Nudelwasser.', time: 'Mo', likes: 88, liked: true },
  ],
  v4: [],
  v5: [{ id: 'cm1', userId: 'u3', text: 'Mache ich seit einem Jahr, will nicht mehr zurück.', time: 'Sa', likes: 9, liked: false }],
};

/*
 * Die Kommentarzahl steht nicht mehr als eigene Zahl am Beitrag.
 *
 * Henrik hatte gemeldet, dass "Alle 28 Kommentare ansehen" dasteht, obwohl
 * es nur vier gibt - das feste Feld und mockComments waren auseinander-
 * gelaufen. Jetzt zaehlt die Liste selbst, dann kann es nicht wieder
 * passieren. Genauso geloest wie in der Website (mitKommentarzahl in
 * web/server/app.js).
 */
function mitKommentarzahl<T extends { id: string; comments?: number }>(eintraege: T[]): T[] {
  return eintraege.map((e) => ({ ...e, comments: (mockComments[e.id] || []).length }));
}

const mockPostsRoh: Post[] = [
  { id: 'p1', userId: 'u3', location: 'Hamburg', music: 'Golden Hour – Lys', description: 'Der Hafen um sechs Uhr morgens. Ganz ohne Menschen.', likedBy: 'Anna Schmidt', likes: 342, comments: 27, reposts: 0, reposted: false, liked: false, saved: false, following: true, notify: false, tags: ['#hafen', '#nachtfotografie'] },
  { id: 'p2', userId: 'u5', location: 'Köln', music: 'Originalton', description: 'Neues Setup steht. Zwei Monitore waren doch die richtige Entscheidung.', likedBy: 'Bob Müller', likes: 128, comments: 14, reposts: 0, reposted: false, liked: true, saved: false, following: true, notify: true, tags: ['#homeoffice', '#designsystem'] },
  { id: 'p3', userId: 'u1', location: 'Zugspitze', music: 'Ambient Sunrise – Nora K.', description: 'Oben angekommen. Der Aufstieg war jede Minute wert.', likedBy: 'David König', likes: 1204, comments: 96, reposts: 0, reposted: false, liked: false, saved: true, following: false, notify: false, tags: ['#sonnenaufgang'] },
  { id: 'p4', userId: 'u6', location: 'Berlin', music: 'Lo-Fi Focus – beatlab', description: 'Kleine Commits, klare Historie. Mein Team dankt es mir.', likedBy: 'Elif Yilmaz', likes: 87, comments: 9, reposts: 0, reposted: false, liked: false, saved: false, following: true, notify: false, tags: ['#reactnative'] },
];

const mockVideosRoh: Video[] = [
  { id: 'v1', userId: 'u1', description: 'Sonnenaufgang über den Alpen. Vier Uhr aufstehen hat sich gelohnt.', location: 'Zugspitze', music: 'Ambient Sunrise – Nora K.', likes: 12400, comments: 218, shares: 96, reposted: false, liked: false, saved: false, tags: ['#sonnenaufgang'] },
  { id: 'v2', userId: 'u4', description: 'So richtet ihr euer Home-Office in 60 Sekunden ein.', location: 'Köln', music: 'Lo-Fi Focus – beatlab', likes: 8210, comments: 143, shares: 61, reposted: false, liked: true, saved: true, tags: ['#homeoffice', '#designsystem'] },
  { id: 'v3', userId: 'u5', description: 'Rezept: Pasta in 10 Minuten, ohne Sahne und trotzdem cremig.', location: 'Hamburg', music: 'Kitchen Groove – Milo', likes: 24800, comments: 512, shares: 340, reposted: false, liked: false, saved: false, tags: ['#mealprep'] },
  { id: 'v4', userId: 'u2', description: 'Erster Laufversuch mit der neuen Kamera-Stabilisierung.', location: 'Rheinpark', music: 'Runner High – Aster', likes: 3140, comments: 74, shares: 22, reposted: false, liked: false, saved: false, tags: ['#laufen'] },
  { id: 'v5', userId: 'u6', description: 'Warum kleine Commits dein Leben leichter machen.', location: 'Berlin', music: 'Originalton', likes: 5670, comments: 189, shares: 118, reposted: false, liked: false, saved: false, tags: ['#reactnative'] },
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
  { id: 's0', userId: 'me', name: 'Deine Story', viewed: false, own: true, liked: false },
  { id: 's1', userId: 'u1', name: 'Anna', viewed: false, liked: false, caption: 'Erstes Licht auf 2500 Metern' },
  { id: 's2', userId: 'u2', name: 'Bob', viewed: false, liked: false, caption: 'Neuer Build läuft durch' },
  { id: 's3', userId: 'u3', name: 'Clara', viewed: false, liked: false, caption: 'Hafen im Nebel' },
  { id: 's4', userId: 'u4', name: 'David', viewed: true, liked: false, caption: 'Schreibtisch neu sortiert' },
  { id: 's5', userId: 'u5', name: 'Elif', viewed: true, liked: false, caption: 'Pasta in zehn Minuten' },
  { id: 's6', userId: 'u6', name: 'Finn', viewed: true, liked: false, caption: '20 Kilometer geschafft' },
];

/** Querformat-Videos, Prototyp-Frame "Videos - Querformat". */
const mockClipsRoh: Clip[] = [
  { id: 'q1', userId: 'u1', title: 'Zugspitze bei Sonnenaufgang – die ganze Tour', duration: '18:42', views: 128400, age: 'vor 2 Tagen', location: 'Zugspitze', music: 'Ambient Sunrise – Nora K.', tags: ['#sonnenaufgang'], description: 'Die ganze Tour von der Hütte bis zum Gipfel, ungeschnitten. Kapitel in der Beschreibung.', likes: 8420, comments: 214, liked: false, saved: false, reposted: false },
  { id: 'q2', userId: 'u4', title: 'Design Tokens sauber aufsetzen', duration: '24:10', views: 41200, age: 'vor 5 Tagen', location: 'Köln', music: 'Lo-Fi Focus – beatlab', tags: ['#designsystem'], description: 'Von der ersten Farbvariable bis zum fertigen Theme — Schritt für Schritt mitgebaut.', likes: 3110, comments: 96, liked: false, saved: false, reposted: false },
  { id: 'q3', userId: 'u5', title: 'Meal Prep für eine ganze Woche', duration: '11:07', views: 302900, age: 'vor 1 Woche', location: 'Hamburg', music: 'Kitchen Groove – Milo', tags: ['#mealprep'], description: 'Fünf Gerichte, eine Stunde Arbeit, eine ganze Woche satt. Einkaufszettel unten.', likes: 24800, comments: 612, liked: false, saved: false, reposted: false },
  { id: 'q4', userId: 'u2', title: 'Expo SDK 57: Was sich geändert hat', duration: '09:55', views: 18700, age: 'vor 1 Woche', location: 'Köln', music: 'Originalton', tags: ['#reactnative'], description: 'Was sich mit Expo SDK 57 ändert und worauf man beim Umstieg achten muss.', likes: 1240, comments: 58, liked: false, saved: false, reposted: false },
  { id: 'q5', userId: 'u3', title: 'Nachtfotografie am Hafen', duration: '15:31', views: 87300, age: 'vor 2 Wochen', location: 'Hamburg', music: 'Golden Hour – Lys', tags: ['#hafen', '#nachtfotografie'], description: 'Blaue Stunde am Hafen: Einstellungen, Stativ, Nachbearbeitung.', likes: 6180, comments: 143, liked: false, saved: false, reposted: false },
  { id: 'q6', userId: 'u6', title: 'Kleine Commits, klare Historie', duration: '07:44', views: 22100, age: 'vor 3 Wochen', location: 'Berlin', music: 'Originalton', tags: ['#reactnative'], description: 'Warum kleine Commits das Review leichter machen — mit Beispielen aus echten Projekten.', likes: 1870, comments: 74, liked: false, saved: false, reposted: false },
];

// Die drei Listen mit abgeleiteter Kommentarzahl, siehe mitKommentarzahl.
export const mockPosts = mitKommentarzahl(mockPostsRoh);
export const mockVideos = mitKommentarzahl(mockVideosRoh);
export const mockClips = mitKommentarzahl(mockClipsRoh);

/** Friend-Map, Prototyp-Frame "Messenger - Friend-Map". */
export const mockFriendPins: FriendPin[] = [
  { id: 'u1', x: 24, y: 30, place: 'Zugspitze', when: 'vor 5 Min.' },
  { id: 'u2', x: 62, y: 22, place: 'Köln Innenstadt', when: 'vor 12 Min.' },
  { id: 'u3', x: 45, y: 55, place: 'Hamburger Hafen', when: 'vor 1 Std.' },
  { id: 'u4', x: 76, y: 63, place: 'Köln Ehrenfeld', when: 'vor 2 Std.' },
  { id: 'u5', x: 18, y: 72, place: 'Zuhause', when: 'gerade eben' },
  { id: 'u6', x: 58, y: 82, place: 'Rheinpark', when: 'vor 20 Min.' },
];

/** Explorer-Abschnitte, Prototyp-Frame "Video - Suche". */
export const mockHashtags: Hashtag[] = [
  { tag: '#sonnenaufgang', posts: 128400 },
  { tag: '#designsystem', posts: 41200 },
  { tag: '#mealprep', posts: 302900 },
  { tag: '#reactnative', posts: 18700 },
  { tag: '#hafen', posts: 87300 },
  { tag: '#laufen', posts: 220100 },
  { tag: '#homeoffice', posts: 64800 },
  { tag: '#nachtfotografie', posts: 39100 },
];

export const mockSounds: Sound[] = [
  { id: 'so1', title: 'Golden Hour', artist: 'Lys', uses: 12400, dauer: '3:46', lyrics: 'And the light comes slow over the water' },
  { id: 'so2', title: 'Lo-Fi Focus', artist: 'beatlab', uses: 8210, dauer: '2:58', lyrics: 'Instrumental' },
  { id: 'so3', title: 'Kitchen Groove', artist: 'Milo', uses: 24800, dauer: '3:12', lyrics: 'Ten minutes and the table is set' },
  { id: 'so4', title: 'Runner High', artist: 'Aster', uses: 3140, dauer: '4:05', lyrics: 'One more mile, one more morning' },
  { id: 'so5', title: 'Ambient Sunrise', artist: 'Nora K.', uses: 5670, dauer: '5:21', lyrics: 'Instrumental' },
];

// ort verbindet den Standort mit dem location-Feld der Beitraege - ohne das
// waere die Standort-Seite immer leer. adresse und koordinaten stehen im
// Prototyp-Frame "VSS + Standort" im Kopf.
export const mockPlaces: Place[] = [
  { id: 'pl1', name: 'Hamburger Hafen', posts: 8730, ort: 'Hamburg', adresse: 'Am Sandtorkai, 20457 Hamburg, Deutschland', koordinaten: '53.5413° N, 9.9891° O', x: 44, y: 28 },
  { id: 'pl2', name: 'Zugspitze', posts: 12400, ort: 'Zugspitze', adresse: 'Zugspitzplatt, 82475 Garmisch-Partenkirchen, Deutschland', koordinaten: '47.4211° N, 10.9853° O', x: 52, y: 78 },
  { id: 'pl3', name: 'Rheinpark Köln', posts: 3140, ort: 'Rheinpark', adresse: 'Sachsenbergstraße, 50679 Köln, Deutschland', koordinaten: '50.9494° N, 6.9722° O', x: 30, y: 52 },
  { id: 'pl4', name: 'Berlin Mitte', posts: 22100, ort: 'Berlin', adresse: 'Unter den Linden, 10117 Berlin, Deutschland', koordinaten: '52.5170° N, 13.3889° O', x: 70, y: 34 },
  { id: 'pl5', name: 'Alster', posts: 5310, ort: 'Hamburg', adresse: 'An der Alster, 20099 Hamburg, Deutschland', koordinaten: '53.5586° N, 10.0011° O', x: 46, y: 25 },
];

export const mockCurrentUser: AuthUser = {
  id: CURRENT_USER_ID,
  email: 'henrik@example.com',
  profile: mockUsers.me,
};
