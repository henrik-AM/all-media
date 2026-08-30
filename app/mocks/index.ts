import { AuthUser, Chat, Clip, Comment, Community, Contact, FriendPin, Hashtag, Message, Place, Post, Profile, Sound, Story, User, Video } from '../types';

export const CURRENT_USER_ID = 'me';

export const mockUsers: Record<string, User> = {
  me: { id: 'me', name: 'Henrik', handle: '@henrik', status: 'online', about: 'Hey, ich nutze All Media!', phone: '+49 170 1234567' },
  // Test-Bots für die Entwicklung
  test_u1: { id: 'test_u1', name: 'Test Bot 1', handle: '@testbot1', status: 'online', about: 'Ich bin ein Test-Bot', phone: '+49 999 0000001' },
  test_u2: { id: 'test_u2', name: 'Test Bot 2', handle: '@testbot2', status: 'away', about: 'Auch ich teste', phone: '+49 999 0000002' },
  // Weitere User (u1-u9) entfernt - können später hinzugefügt werden wenn nötig
};

// Test-Bots für die Entwicklung (können jederzeit gelöscht werden)
export const mockChats: Chat[] = [
  { id: 'test_c1', name: 'Test Bot 1', userId: 'test_u1', isGroup: false, preview: 'Hallo! Ich bin ein Test-Bot', time: 'gerade eben', unreadCount: 0 },
  { id: 'test_c2', name: 'Test Bot 2', userId: 'test_u2', isGroup: false, preview: 'Auch ich bin zum Testen da', time: 'vor 1 Min', unreadCount: 1 },
];

// Test-Nachrichten für die Entwicklung
export const mockMessages: Record<string, Message[]> = {
  test_c1: [
    { id: 'm1', chatId: 'test_c1', senderId: 'test_u1', text: 'Hallo! Ich bin ein Test-Bot', time: 'vor 2 Min' },
    { id: 'm2', chatId: 'test_c1', senderId: 'me', text: 'Hi! Danke dass du da bist', time: 'vor 1 Min', read: true },
    { id: 'm3', chatId: 'test_c1', senderId: 'test_u1', text: 'Gerne! Teste die Authentifizierung 🚀', time: 'gerade eben' },
  ],
  test_c2: [
    { id: 'm1', chatId: 'test_c2', senderId: 'test_u2', text: 'Auch ich bin zum Testen da', time: 'vor 1 Min' },
    { id: 'm2', chatId: 'test_c2', senderId: 'test_u2', text: 'Teste die UI mit mehreren Chats', time: 'gerade eben' },
  ],
};

// Test-Kontakte für die Entwicklung
export const mockContacts: Contact[] = [
  { id: 'test_u1', name: 'Test Bot 1', status: 'friend', about: 'Ich bin ein Test-Bot' },
  { id: 'test_u2', name: 'Test Bot 2', status: 'friend', about: 'Auch ich teste' },
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

  // Querformat-Clips. Die fehlten hier komplett, während die Website sie
  // längst hatte — dadurch zählte `mitKommentarzahl` bei jedem Clip null, und
  // im Spieler stand "0" neben 8,4k Gefällt-mir. Gleiche Texte wie in der
  // Website, damit App und Website dieselben Zahlen zeigen.
  q1: [
    { id: 'cm1', userId: 'u2', text: 'Die Kapitelmarken sind Gold wert.', time: 'vor 2 Tagen', likes: 14, liked: false },
    { id: 'cm2', userId: 'u5', text: 'Wie lange wart ihr insgesamt unterwegs?', time: 'vor 2 Tagen', likes: 3, liked: false },
    { id: 'cm3', userId: 'u1', text: 'Neun Stunden mit Pausen.', time: 'vor 1 Tag', likes: 11, liked: false },
  ],
  q2: [
    { id: 'cm1', userId: 'u6', text: 'Endlich mal ohne Framework-Geplänkel erklärt.', time: 'vor 4 Tagen', likes: 22, liked: false },
    { id: 'cm2', userId: 'u3', text: 'Teil zwei zu Dark Mode wäre super.', time: 'vor 3 Tagen', likes: 8, liked: false },
  ],
  q3: [
    { id: 'cm1', userId: 'u1', text: 'Der Einkaufszettel spart mir jede Woche eine Stunde.', time: 'vor 6 Tagen', likes: 41, liked: false },
    { id: 'cm2', userId: 'u4', text: 'Hält das wirklich fünf Tage frisch?', time: 'vor 5 Tagen', likes: 6, liked: false },
    { id: 'cm3', userId: 'u5', text: 'Vier sicher, am fünften würde ich einfrieren.', time: 'vor 5 Tagen', likes: 19, liked: false },
  ],
  q4: [{ id: 'cm1', userId: 'u4', text: 'Der Hinweis zum Umstieg hat mir zwei Stunden gespart.', time: 'vor 6 Tagen', likes: 12, liked: false }],
  q5: [
    { id: 'cm1', userId: 'u6', text: 'Blaue Stunde ist einfach unschlagbar.', time: 'vor 2 Wochen', likes: 17, liked: false },
    { id: 'cm2', userId: 'u2', text: 'Welches Stativ nutzt du?', time: 'vor 12 Tagen', likes: 2, liked: false },
  ],
  q6: [{ id: 'cm1', userId: 'u5', text: 'Mein Team hat es nach dem Video übernommen.', time: 'vor 3 Wochen', likes: 9, liked: false }],
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
  { id: 'v1', userId: 'u1', description: 'Sonnenaufgang über den Alpen. Vier Uhr aufstehen hat sich gelohnt.', location: 'Zugspitze', music: 'Ambient Sunrise – Nora K.', likes: 12400, comments: 218, shares: 96, reposted: false, liked: false, saved: false, notify: true, tags: ['#sonnenaufgang'] },
  { id: 'v2', userId: 'u4', description: 'So richtet ihr euer Home-Office in 60 Sekunden ein.', location: 'Köln', music: 'Lo-Fi Focus – beatlab', likes: 8210, comments: 143, shares: 61, reposted: false, liked: true, saved: true, notify: true, tags: ['#homeoffice', '#designsystem'] },
  { id: 'v3', userId: 'u5', description: 'Rezept: Pasta in 10 Minuten, ohne Sahne und trotzdem cremig.', location: 'Hamburg', music: 'Kitchen Groove – Milo', likes: 24800, comments: 512, shares: 340, reposted: false, liked: false, saved: false, notify: false, tags: ['#mealprep'] },
  { id: 'v4', userId: 'u2', description: 'Erster Laufversuch mit der neuen Kamera-Stabilisierung.', location: 'Rheinpark', music: 'Runner High – Aster', likes: 3140, comments: 74, shares: 22, reposted: false, liked: false, saved: false, notify: true, tags: ['#laufen'] },
  { id: 'v5', userId: 'u6', description: 'Warum kleine Commits dein Leben leichter machen.', location: 'Berlin', music: 'Originalton', likes: 5670, comments: 189, shares: 118, reposted: false, liked: false, saved: false, notify: true, tags: ['#reactnative'] },
];

/*
 * Communitys. bio, link, eigen und unterthemen kamen am 26.08.2026 dazu -
 * die Community-Seite folgt jetzt dem Prototyp-Frame "CH + Kanal", und der
 * verlangt Biografie, Link und eine Liste von Unterthemen. Dieselben Daten
 * stehen in web/server/app.js.
 */
export const mockCommunities: Community[] = [
  { id: 'k1', name: 'Design Systeme', topic: 'Komponenten, Tokens, Figma', members: 1284, visibility: 'public', joined: true, unreadCount: 3, bio: 'Alles rund um Komponenten, Tokens und den Weg von Figma in den Code. Fragen jederzeit willkommen.', link: 'designsysteme.de', eigen: false, unterthemen: [
    { id: 'k1-allgemein', name: 'Allgemein', themen: ['Diskussionen', 'News'] },
    { id: 'k1-tokens', name: 'Design Tokens', themen: ['Struktur', 'Best Practices'] },
    { id: 'k1-figma', name: 'Figma', themen: ['Plugins', 'Workflows'] },
  ] },
  { id: 'k2', name: 'React Native DE', topic: 'Expo, Navigation, Performance', members: 842, visibility: 'public', joined: true, unreadCount: 0, bio: 'Deutschsprachige Runde zu React Native und Expo. Von der ersten App bis zum Store-Release.', link: 'rn-de.dev', eigen: false, unterthemen: [
    { id: 'k2-allgemein', name: 'Allgemein', themen: ['Diskussionen', 'News'] },
    { id: 'k2-expo', name: 'Expo', themen: ['SDK Updates', 'Debugging'] },
    { id: 'k2-navigation', name: 'Navigation', themen: ['React Navigation', 'Router'] },
  ] },
  { id: 'k3', name: 'Fotografie', topic: 'Licht, Komposition, Nachbearbeitung', members: 3120, visibility: 'public', joined: false, unreadCount: 0, bio: 'Licht, Komposition, Nachbearbeitung. Jeden Sonntag ein gemeinsames Thema.', link: 'lichtundschatten.foto', eigen: false, unterthemen: [
    { id: 'k3-allgemein', name: 'Allgemein', themen: ['Diskussionen', 'News'] },
    { id: 'k3-licht', name: 'Licht & Belichtung', themen: ['Goldene Stunde', 'ISO'] },
    { id: 'k3-nachbearbeitung', name: 'Nachbearbeitung', themen: ['Lightroom', 'Capture One'] },
  ] },
  { id: 'k4', name: 'Team Intern', topic: 'Nur für das Kernteam', members: 12, visibility: 'private', joined: true, unreadCount: 5, bio: 'Interner Kanal des Kernteams. Sprintplanung, Entscheidungen, alles Kurzfristige.', link: '', eigen: true, unterthemen: [
    { id: 'k4-allgemein', name: 'Allgemein', themen: ['Diskussionen', 'News'] },
    { id: 'k4-sprint', name: 'Sprint Planning', themen: ['Backlog', 'Reviews'] },
  ] },
  { id: 'k5', name: 'Laufgruppe Köln', topic: 'Treffpunkte und Termine', members: 96, visibility: 'private', joined: true, unreadCount: 0, bio: 'Wir laufen dienstags und samstags. Treffpunkte und Termine stehen hier.', link: 'laufgruppe-koeln.de', eigen: true, unterthemen: [
    { id: 'k5-allgemein', name: 'Allgemein', themen: ['Diskussionen', 'News'] },
    { id: 'k5-termine', name: 'Termine', themen: ['Diese Woche', 'Nächste Woche'] },
  ] },
  { id: 'k6', name: 'Musikproduktion', topic: 'Ableton, Mixing, Sounddesign', members: 671, visibility: 'public', joined: false, unreadCount: 0, bio: 'Ableton, Mixing, Sounddesign. Feedback-Runden am Monatsende.', link: 'musikproduktion.club', eigen: false, unterthemen: [
    { id: 'k6-allgemein', name: 'Allgemein', themen: ['Diskussionen', 'News'] },
    { id: 'k6-ableton', name: 'Ableton Live', themen: ['Devices', 'Workflow'] },
    { id: 'k6-mixing', name: 'Mixing & Mastering', themen: ['Techniken', 'Feedback'] },
  ] },
];

// Community-Nachrichten von Bots entfernt – nur echte User-Nachrichten
export const mockCommunityMessages: Record<string, Message[]> = {};

export const mockStories: Story[] = [
  { id: 's0', userId: 'me', name: 'Deine Story', viewed: false, own: true, liked: false },
  { id: 's1', userId: 'u1', name: 'Anna', viewed: false, liked: false, caption: 'Erstes Licht auf 2500 Metern' },
  { id: 's2', userId: 'u2', name: 'Bob', viewed: false, liked: false, caption: 'Neuer Build läuft durch' },
  { id: 's3', userId: 'u3', name: 'Clara', viewed: false, liked: false, caption: 'Hafen im Nebel' },
  { id: 's4', userId: 'u4', name: 'David', viewed: true, liked: false, caption: 'Schreibtisch neu sortiert' },
  { id: 's5', userId: 'u5', name: 'Elif', viewed: true, liked: false, caption: 'Pasta in zehn Minuten' },
  { id: 's6', userId: 'u6', name: 'Finn', viewed: true, liked: false, caption: '20 Kilometer geschafft' },
];

/*
 * Querformat-Videos, Prototyp-Frame "Videos - Querformat".
 *
 * `art` entscheidet, unter welchem Filter der Leiste ein Video auftaucht.
 * Jede der drei Arten kommt mehrfach vor - mit nur einem Live-Video liesse
 * sich nicht erkennen, ob der Filter wirklich filtert oder nur zufaellig
 * dasselbe zeigt.
 */
const mockClipsRoh: Clip[] = [
  { id: 'q1', userId: 'u1', title: 'Zugspitze bei Sonnenaufgang – die ganze Tour', duration: '18:42', views: 128400, age: 'vor 2 Tagen', art: '360', location: 'Zugspitze', music: 'Ambient Sunrise – Nora K.', tags: ['#sonnenaufgang'], description: 'Die ganze Tour von der Hütte bis zum Gipfel, ungeschnitten. Kapitel in der Beschreibung.', likes: 8420, comments: 214, liked: false, saved: false, reposted: false, kapitel: [{ bei: 0, titel: 'Aufbruch an der Hütte' }, { bei: 240, titel: 'Über das Blockfeld' }, { bei: 620, titel: 'Der Grat' }, { bei: 900, titel: 'Sonnenaufgang am Gipfel' }], untertitel: true },
  { id: 'q2', userId: 'u4', title: 'Design Tokens sauber aufsetzen', duration: '24:10', views: 41200, age: 'vor 5 Tagen', art: 'standard', location: 'Köln', music: 'Lo-Fi Focus – beatlab', tags: ['#designsystem'], description: 'Von der ersten Farbvariable bis zum fertigen Theme — Schritt für Schritt mitgebaut.', likes: 3110, comments: 96, liked: false, saved: false, reposted: false, kapitel: [{ bei: 0, titel: 'Warum Tokens' }, { bei: 180, titel: 'Die erste Farbvariable' }, { bei: 600, titel: 'Hell und Dunkel' }, { bei: 1100, titel: 'Übergabe an den Code' }], untertitel: true },
  { id: 'q3', userId: 'u5', title: 'Meal Prep für eine ganze Woche', duration: '11:07', views: 302900, age: 'vor 1 Woche', art: 'standard', location: 'Hamburg', music: 'Kitchen Groove – Milo', tags: ['#mealprep'], description: 'Fünf Gerichte, eine Stunde Arbeit, eine ganze Woche satt. Einkaufszettel unten.', likes: 24800, comments: 612, liked: false, saved: false, reposted: false, kapitel: [{ bei: 0, titel: 'Einkaufszettel' }, { bei: 120, titel: 'Vorbereiten' }, { bei: 400, titel: 'Kochen' }, { bei: 580, titel: 'Abfüllen' }], untertitel: true },
  { id: 'q4', userId: 'u2', title: 'Expo SDK 57 live erklärt – Fragen willkommen', duration: 'LIVE', views: 18700, age: 'läuft gerade', art: 'live', zuschauer: 1240, location: 'Köln', music: 'Originalton', tags: ['#reactnative'], description: 'Was sich mit Expo SDK 57 ändert und worauf man beim Umstieg achten muss.', likes: 1240, comments: 58, liked: false, saved: false, reposted: false },
  { id: 'q5', userId: 'u3', title: 'Nachtfotografie am Hafen', duration: '15:31', views: 87300, age: 'vor 2 Wochen', art: 'standard', location: 'Hamburg', music: 'Golden Hour – Lys', tags: ['#hafen', '#nachtfotografie'], description: 'Blaue Stunde am Hafen: Einstellungen, Stativ, Nachbearbeitung.', likes: 6180, comments: 143, liked: false, saved: false, reposted: false, untertitel: true },
  { id: 'q6', userId: 'u6', title: 'Kleine Commits, klare Historie', duration: '07:44', views: 22100, age: 'vor 3 Wochen', art: 'standard', location: 'Berlin', music: 'Originalton', tags: ['#reactnative'], description: 'Warum kleine Commits das Review leichter machen — mit Beispielen aus echten Projekten.', likes: 1870, comments: 74, liked: false, saved: false, reposted: false, untertitel: true },
  { id: 'q7', userId: 'u3', title: 'Hamburger Hafen in 360° – einmal um die Elbphilharmonie', duration: '12:20', views: 64500, age: 'vor 4 Tagen', art: '360', location: 'Hamburg', music: 'Harbour Drift – Lys', tags: ['#hafen', '#360'], description: 'Rundumblick vom Wasser aus. Zum Umsehen ziehen oder das Handy drehen.', likes: 4820, comments: 118, liked: false, saved: false, reposted: false },
  { id: 'q8', userId: 'u5', title: 'Sonntagsküche live – wir kochen zusammen', duration: 'LIVE', views: 9400, age: 'läuft gerade', art: 'live', zuschauer: 412, location: 'Hamburg', music: 'Originalton', tags: ['#mealprep'], description: 'Zwei Gerichte, eine Pfanne, alle Fragen im Chat.', likes: 730, comments: 205, liked: false, saved: false, reposted: false },
  { id: 'q9', userId: 'u1', title: 'Gipfelpanorama Alpen – 360° Rundflug', duration: '08:05', views: 51200, age: 'vor 1 Woche', art: '360', location: 'Zugspitze', music: 'Ambient Sunrise – Nora K.', tags: ['#sonnenaufgang', '#360'], description: 'Einmal über die Gipfelkette, aufgenommen mit einer 360°-Kamera an der Drohne.', likes: 3940, comments: 87, liked: false, saved: false, reposted: false },
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
  {
    id: 'so1', title: 'Golden Hour', artist: 'Lys', uses: 12400, dauer: '3:46',
    lyrics: [
      'And the light comes slow over the water',
      'nobody up but the gulls and me',
      '',
      'Cranes in the mist like a paper drawing',
      'the harbour holds its breath',
      '',
      'Golden hour, golden hour',
      'stay a little longer now',
      'Golden hour, golden hour',
      'nothing here needs fixing',
    ],
  },
  { id: 'so2', title: 'Lo-Fi Focus', artist: 'beatlab', uses: 8210, dauer: '2:58', lyrics: null },
  {
    id: 'so3', title: 'Kitchen Groove', artist: 'Milo', uses: 24800, dauer: '3:12',
    lyrics: [
      'Ten minutes and the table is set',
      'onions going soft in the pan',
      '',
      'Nobody taught me, I just kept going',
      'burnt a lot of Sundays learning how',
      '',
      'Kitchen groove, kitchen groove',
      'dinner is an easy thing',
    ],
  },
  {
    id: 'so4', title: 'Runner High', artist: 'Aster', uses: 3140, dauer: '4:05',
    lyrics: [
      'One more mile, one more morning',
      'the city still asleep behind me',
      '',
      'Legs remember what the head forgets',
      'keep the rhythm, keep the rhythm',
      '',
      'Runner high, runner high',
      'nothing hurts until I stop',
    ],
  },
  { id: 'so5', title: 'Ambient Sunrise', artist: 'Nora K.', uses: 5670, dauer: '5:21', lyrics: null },
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
