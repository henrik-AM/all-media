// Die All-Media-Website: statische Seite aus ../public und die dazugehoerige
// Schein-API mit den Mockdaten.
//
// Dieselbe Datei bedient beides:
//   - die dauerhaft erreichbare Fassung in der Cloud (../api/index.js)
//   - den lokalen Server auf Henriks Mac (../../app/web-app.js)
// Beide teilen sich diesen Code, damit es keine zwei Staende gibt.

const express = require('express');
const path = require('path');

const app = express();

const users = {
  u1: { id: 'u1', name: 'Anna Schmidt', handle: '@anna', initials: 'AS', color: '#F2A65A', phone: '+49 151 2345678' },
  u2: { id: 'u2', name: 'Bob Müller', handle: '@bob', initials: 'BM', color: '#6C8AE4', phone: '+49 152 3456789' },
  u3: { id: 'u3', name: 'Clara Weber', handle: '@clara', initials: 'CW', color: '#E4699B', phone: '+49 160 4567890' },
  u4: { id: 'u4', name: 'David König', handle: '@david', initials: 'DK', color: '#4DB6AC', phone: '+49 171 5678901' },
  u5: { id: 'u5', name: 'Elif Yilmaz', handle: '@elif', initials: 'EY', color: '#9575CD', phone: '+49 172 6789012' },
  u6: { id: 'u6', name: 'Finn Bauer', handle: '@finn', initials: 'FB', color: '#7986CB', phone: '+49 173 7890123' },
  me: { id: 'me', name: 'Du', handle: '@henrik', initials: 'DU', color: '#0A66FF', phone: '+49 170 1234567' },
  // Diese drei stehen bewusst NICHT in den Kontakten - sonst laesst sich
  // "Kontakt hinzufuegen" gar nicht ausprobieren.
  u7: { id: 'u7', name: 'Greta Hoffmann', handle: '@greta', initials: 'GH', color: '#EF6C6C', phone: '+49 174 8901234' },
  u8: { id: 'u8', name: 'Hakan Demir', handle: '@hakan', initials: 'HD', color: '#5C9E6F', phone: '+49 175 9012345' },
  u9: { id: 'u9', name: 'Ida Nowak', handle: '@ida', initials: 'IN', color: '#C48BD9', phone: '+49 176 0123456' },
};

// --- Person finden: Benutzername ODER Telefonnummer ------------------------
// Henrik wollte nicht mehr an den Benutzernamen gebunden sein.

/** Nur Ziffern, Laendervorwahl vereinheitlicht - "+49 170..." = "0170...". */
function normalisiereNummer(eingabe) {
  let z = String(eingabe).replace(/[^\d+]/g, '').replace(/^\+/, '00');
  if (z.startsWith('00')) z = z.slice(2);
  else if (z.startsWith('0')) z = '49' + z.slice(1);
  return z;
}

function istNummer(eingabe) {
  return /^[+\d][\d\s/()-]{4,}$/.test(String(eingabe).trim());
}

function findePerson(eingabe) {
  const roh = String(eingabe).trim();
  if (!roh) return null;
  const personen = Object.values(users).filter((u) => u.id !== 'me');

  if (istNummer(roh)) {
    const gesucht = normalisiereNummer(roh);
    return personen.find((u) => u.phone && normalisiereNummer(u.phone) === gesucht) || null;
  }
  const name = roh.replace(/^@/, '').toLowerCase();
  return personen.find(
    (u) => u.handle.replace('@', '').toLowerCase() === name || u.name.toLowerCase() === name
  ) || null;
}

const chats = [
  { id: 'c1', userId: 'u1', name: 'Anna Schmidt', preview: 'Klingt gut, bis später!', time: '14:32', unread: 2, muted: false, isGroup: false },
  { id: 'c2', userId: 'u2', name: 'Bob Müller', preview: 'Schicke dir die Datei gerade', time: '13:05', unread: 1, muted: false, isGroup: false },
  { id: 'c3', userId: 'u3', name: 'Clara Weber', preview: 'Foto', time: '11:48', unread: 0, muted: false, isGroup: false, mediaPreview: 'image' },
  { id: 'c4', userId: null, name: 'Projekt Team', preview: 'David: Meeting verschoben auf 15 Uhr', time: 'Gestern', unread: 0, muted: true, isGroup: true, members: ['u1', 'u2', 'u4'] },
  { id: 'c5', userId: 'u4', name: 'David König', preview: 'Alles klar 👍', time: 'Gestern', unread: 0, muted: false, isGroup: false },
  { id: 'c6', userId: 'u5', name: 'Elif Yilmaz', preview: 'Sprachnachricht', time: 'Mo', unread: 0, muted: false, isGroup: false, mediaPreview: 'audio' },
  { id: 'c7', userId: null, name: 'Wochenend-Crew', preview: 'Elif: Wer ist dabei?', time: 'Mo', unread: 0, muted: false, isGroup: true, members: ['u3', 'u5', 'u6'] },
  { id: 'c8', userId: 'u6', name: 'Finn Bauer', preview: 'Danke dir!', time: 'So', unread: 0, muted: false, isGroup: false },
];

const stories = [
  { id: 's0', userId: 'me', name: 'Deine Story', own: true, viewed: false, liked: false },
  { id: 's1', userId: 'u1', name: 'Anna', viewed: false, liked: false, caption: 'Erstes Licht auf 2500 Metern' },
  { id: 's2', userId: 'u2', name: 'Bob', viewed: false, liked: false, caption: 'Neuer Build läuft durch' },
  { id: 's3', userId: 'u3', name: 'Clara', viewed: false, liked: false, caption: 'Hafen im Nebel' },
  { id: 's4', userId: 'u4', name: 'David', viewed: true, liked: false, caption: 'Schreibtisch neu sortiert' },
  { id: 's5', userId: 'u5', name: 'Elif', viewed: true, liked: false, caption: 'Pasta in zehn Minuten' },
  { id: 's6', userId: 'u6', name: 'Finn', viewed: true, liked: false, caption: '20 Kilometer geschafft' },
];

// Querformat-Videos (Videos / Querformat im Prototyp)
const clips = [
  { id: 'q1', userId: 'u1', title: 'Zugspitze bei Sonnenaufgang – die ganze Tour', duration: '18:42', views: 128400, age: 'vor 2 Tagen' , location: 'Zugspitze', music: 'Ambient Sunrise – Nora K.', tags: ['#sonnenaufgang'], description: 'Die ganze Tour von der Hütte bis zum Gipfel, ungeschnitten. Kapitel in der Beschreibung.', likes: 8420, comments: 214, liked: false, saved: false, reposted: false },
  { id: 'q2', userId: 'u4', title: 'Design Tokens sauber aufsetzen', duration: '24:10', views: 41200, age: 'vor 5 Tagen' , location: 'Köln', music: 'Lo-Fi Focus – beatlab', tags: ['#designsystem'], description: 'Von der ersten Farbvariable bis zum fertigen Theme — Schritt für Schritt mitgebaut.', likes: 3110, comments: 96, liked: false, saved: false, reposted: false },
  { id: 'q3', userId: 'u5', title: 'Meal Prep für eine ganze Woche', duration: '11:07', views: 302900, age: 'vor 1 Woche' , location: 'Hamburg', music: 'Kitchen Groove – Milo', tags: ['#mealprep'], description: 'Fünf Gerichte, eine Stunde Arbeit, eine ganze Woche satt. Einkaufszettel unten.', likes: 24800, comments: 612, liked: false, saved: false, reposted: false },
  { id: 'q4', userId: 'u2', title: 'Expo SDK 57: Was sich geändert hat', duration: '09:55', views: 18700, age: 'vor 1 Woche' , location: 'Köln', music: 'Originalton', tags: ['#reactnative'], description: 'Was sich mit Expo SDK 57 ändert und worauf man beim Umstieg achten muss.', likes: 1240, comments: 58, liked: false, saved: false, reposted: false },
  { id: 'q5', userId: 'u3', title: 'Nachtfotografie am Hafen', duration: '15:31', views: 87300, age: 'vor 2 Wochen' , location: 'Hamburg', music: 'Golden Hour – Lys', tags: ['#hafen', '#nachtfotografie'], description: 'Blaue Stunde am Hafen: Einstellungen, Stativ, Nachbearbeitung.', likes: 6180, comments: 143, liked: false, saved: false, reposted: false },
  { id: 'q6', userId: 'u6', title: 'Kleine Commits, klare Historie', duration: '07:44', views: 22100, age: 'vor 3 Wochen' , location: 'Berlin', music: 'Originalton', tags: ['#reactnative'], description: 'Warum kleine Commits das Review leichter machen — mit Beispielen aus echten Projekten.', likes: 1870, comments: 74, liked: false, saved: false, reposted: false },
];

// Explorer-Abschnitte (Video - Suche im Prototyp)
const hashtags = [
  { tag: '#sonnenaufgang', posts: 128400 },
  { tag: '#designsystem', posts: 41200 },
  { tag: '#mealprep', posts: 302900 },
  { tag: '#reactnative', posts: 18700 },
  { tag: '#hafen', posts: 87300 },
  { tag: '#laufen', posts: 220100 },
  { tag: '#homeoffice', posts: 64800 },
  { tag: '#nachtfotografie', posts: 39100 },
];

// dauer und lyrics werden auf der Sound-Seite gebraucht (Prototyp-Frame
// "VSSo + Sound": Wellenform mit Laufzeit und eine Lyrics-Zeile).
const sounds = [
  { id: 'so1', title: 'Golden Hour', artist: 'Lys', uses: 12400, dauer: '3:46', lyrics: 'And the light comes slow over the water' },
  { id: 'so2', title: 'Lo-Fi Focus', artist: 'beatlab', uses: 8210, dauer: '2:58', lyrics: 'Instrumental' },
  { id: 'so3', title: 'Kitchen Groove', artist: 'Milo', uses: 24800, dauer: '3:12', lyrics: 'Ten minutes and the table is set' },
  { id: 'so4', title: 'Runner High', artist: 'Aster', uses: 3140, dauer: '4:05', lyrics: 'One more mile, one more morning' },
  { id: 'so5', title: 'Ambient Sunrise', artist: 'Nora K.', uses: 5670, dauer: '5:21', lyrics: 'Instrumental' },
];

// ort verbindet den Standort mit dem location-Feld der Beitraege - ohne das
// waere die Standort-Seite immer leer. adresse und koordinaten stehen im
// Prototyp-Frame "VSS + Standort" im Kopf.
const places = [
  { id: 'pl1', name: 'Hamburger Hafen', posts: 8730, ort: 'Hamburg', adresse: 'Am Sandtorkai, 20457 Hamburg, Deutschland', koordinaten: '53.5413° N, 9.9891° O', x: 44, y: 28 },
  { id: 'pl2', name: 'Zugspitze', posts: 12400, ort: 'Zugspitze', adresse: 'Zugspitzplatt, 82475 Garmisch-Partenkirchen, Deutschland', koordinaten: '47.4211° N, 10.9853° O', x: 52, y: 78 },
  { id: 'pl3', name: 'Rheinpark Köln', posts: 3140, ort: 'Rheinpark', adresse: 'Sachsenbergstraße, 50679 Köln, Deutschland', koordinaten: '50.9494° N, 6.9722° O', x: 30, y: 52 },
  { id: 'pl4', name: 'Berlin Mitte', posts: 22100, ort: 'Berlin', adresse: 'Unter den Linden, 10117 Berlin, Deutschland', koordinaten: '52.5170° N, 13.3889° O', x: 70, y: 34 },
  { id: 'pl5', name: 'Alster', posts: 5310, ort: 'Hamburg', adresse: 'An der Alster, 20099 Hamburg, Deutschland', koordinaten: '53.5586° N, 10.0011° O', x: 46, y: 25 },
];

// Friend-Map (Messenger / Friend-Map im Prototyp)
const friends = [
  { id: 'u1', x: 24, y: 30, place: 'Zugspitze', when: 'vor 5 Min.' },
  { id: 'u2', x: 62, y: 22, place: 'Köln Innenstadt', when: 'vor 12 Min.' },
  { id: 'u3', x: 45, y: 55, place: 'Hamburger Hafen', when: 'vor 1 Std.' },
  { id: 'u4', x: 76, y: 63, place: 'Köln Ehrenfeld', when: 'vor 2 Std.' },
  { id: 'u5', x: 18, y: 72, place: 'Zuhause', when: 'gerade eben' },
  { id: 'u6', x: 58, y: 82, place: 'Rheinpark', when: 'vor 20 Min.' },
];

const profiles = {
  u1: { bio: 'Bergsteigerin und Fotografin. Immer auf der Suche nach dem ersten Licht.', link: 'anna-schmidt.de', posts: 148, followers: 12400, following: 312, following_me: true, highlights: ['Alpen', 'Ausrüstung', 'Touren'] },
  u2: { bio: 'Entwickler. Schreibt über Expo, Navigation und Performance.', link: 'bobmueller.dev', posts: 63, followers: 2140, following: 189, following_me: true, highlights: ['Talks', 'Setup'] },
  u3: { bio: 'Hafen, Hamburg, Hochformat.', link: 'clara.photo', posts: 421, followers: 8730, following: 640, following_me: true, highlights: ['Hafen', 'Nebel', 'Nacht'] },
  u4: { bio: 'Produktdesign und Design Systeme. Kaffee als Grundnahrungsmittel.', link: 'davidkoenig.design', posts: 97, followers: 5310, following: 274, following_me: true, highlights: ['Tokens', 'Prozess'] },
  u5: { bio: 'Kochen ohne Schnickschnack. Rezepte unter zehn Minuten.', link: 'elif-kocht.de', posts: 289, followers: 31200, following: 128, following_me: false, highlights: ['Pasta', 'Meal Prep', 'Basics'] },
  u6: { bio: 'Schreibt Software und läuft danach zwanzig Kilometer.', link: 'finnbauer.io', posts: 54, followers: 1180, following: 402, following_me: true, highlights: ['Laufen'] },
  me: { bio: 'Baue gerade All Media.', link: 'all-media.app', posts: 12, followers: 340, following: 186, following_me: false, highlights: ['Projekt'], playlists: ['Beste Clips', 'Tutorials'], spende: null, live: null },
};

const gridItems = {};
for (const id of Object.keys(profiles)) {
  const kinds = ['image', 'video', 'image', 'video', 'image', 'image', 'video', 'image', 'video', 'image', 'video', 'image'];
  gridItems[id] = kinds.map((kind, i) => ({ id: `${id}_g${i}`, kind }));
}

const comments = {
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

const posts = [
  { id: 'p1', userId: 'u3', location: 'Hamburg', music: 'Golden Hour – Lys', description: 'Der Hafen um sechs Uhr morgens. Ganz ohne Menschen.', likedBy: 'Anna Schmidt', likes: 342, comments: 27, reposts: 0, reposted: false, liked: false, saved: false, following: true, notify: false , tags: ['#hafen', '#nachtfotografie'] },
  { id: 'p2', userId: 'u5', location: 'Köln', music: 'Originalton', description: 'Neues Setup steht. Zwei Monitore waren doch die richtige Entscheidung.', likedBy: 'Bob Müller', likes: 128, comments: 14, reposts: 0, reposted: false, liked: true, saved: false, following: true, notify: true , tags: ['#homeoffice', '#designsystem'] },
  { id: 'p3', userId: 'u1', location: 'Zugspitze', music: 'Ambient Sunrise – Nora K.', description: 'Oben angekommen. Der Aufstieg war jede Minute wert.', likedBy: 'David König', likes: 1204, comments: 96, reposts: 0, reposted: false, liked: false, saved: true, following: false, notify: false , tags: ['#sonnenaufgang'] },
  { id: 'p4', userId: 'u6', location: 'Berlin', music: 'Lo-Fi Focus – beatlab', description: 'Kleine Commits, klare Historie. Mein Team dankt es mir.', likedBy: 'Elif Yilmaz', likes: 87, comments: 9, reposts: 0, reposted: false, liked: false, saved: false, following: true, notify: false , tags: ['#reactnative'] },
];

const videos = [
  { id: 'v1', userId: 'u1', description: 'Sonnenaufgang über den Alpen. Vier Uhr aufstehen hat sich gelohnt.', location: 'Zugspitze', music: 'Ambient Sunrise – Nora K.', likes: 12400, comments: 218, shares: 96, reposted: false, liked: false, saved: false , tags: ['#sonnenaufgang'] },
  { id: 'v2', userId: 'u4', description: 'So richtet ihr euer Home-Office in 60 Sekunden ein.', location: 'Köln', music: 'Lo-Fi Focus – beatlab', likes: 8210, comments: 143, shares: 61, reposted: false, liked: true, saved: true , tags: ['#homeoffice', '#designsystem'] },
  { id: 'v3', userId: 'u5', description: 'Rezept: Pasta in 10 Minuten, ohne Sahne und trotzdem cremig.', location: 'Hamburg', music: 'Kitchen Groove – Milo', likes: 24800, comments: 512, shares: 340, reposted: false, liked: false, saved: false , tags: ['#mealprep'] },
  { id: 'v4', userId: 'u2', description: 'Erster Laufversuch mit der neuen Kamera-Stabilisierung.', location: 'Rheinpark', music: 'Runner High – Aster', likes: 3140, comments: 74, shares: 22, reposted: false, liked: false, saved: false , tags: ['#laufen'] },
  { id: 'v5', userId: 'u6', description: 'Warum kleine Commits dein Leben leichter machen.', location: 'Berlin', music: 'Originalton', likes: 5670, comments: 189, shares: 118, reposted: false, liked: false, saved: false , tags: ['#reactnative'] },
];

const communities = [
  { id: 'k1', name: 'Design Systeme', members: 1284, visibility: 'public', topic: 'Komponenten, Tokens, Figma', joined: true, unread: 3, channels: ['ch-allgemein', 'ch-tokens', 'ch-figma'] },
  { id: 'k2', name: 'React Native DE', members: 842, visibility: 'public', topic: 'Expo, Navigation, Performance', joined: true, unread: 0, channels: ['ch-allgemein', 'ch-expo', 'ch-navigation'] },
  { id: 'k3', name: 'Fotografie', members: 3120, visibility: 'public', topic: 'Licht, Komposition, Nachbearbeitung', joined: false, unread: 0, channels: ['ch-allgemein', 'ch-licht', 'ch-nachbearbeitung'] },
  { id: 'k4', name: 'Team Intern', members: 12, visibility: 'private', topic: 'Nur für das Kernteam', joined: true, unread: 5, channels: ['ch-allgemein', 'ch-sprint'] },
  { id: 'k5', name: 'Laufgruppe Köln', members: 96, visibility: 'private', topic: 'Treffpunkte und Termine', joined: true, unread: 0, channels: ['ch-allgemein', 'ch-termine'] },
  { id: 'k6', name: 'Musikproduktion', members: 671, visibility: 'public', topic: 'Ableton, Mixing, Sounddesign', joined: false, unread: 0, channels: ['ch-allgemein', 'ch-ableton', 'ch-mixing'] },
];

const communityChannels = {
  'ch-allgemein': { name: 'Allgemein', topics: ['Diskussionen', 'News'] },
  'ch-tokens': { name: 'Design Tokens', topics: ['Struktur', 'Best Practices'] },
  'ch-figma': { name: 'Figma', topics: ['Plugins', 'Workflows'] },
  'ch-expo': { name: 'Expo', topics: ['SDK Updates', 'Debugging'] },
  'ch-navigation': { name: 'Navigation', topics: ['React Navigation', 'Router'] },
  'ch-licht': { name: 'Licht & Belichtung', topics: ['Goldene Stunde', 'ISO'] },
  'ch-nachbearbeitung': { name: 'Nachbearbeitung', topics: ['Lightroom', 'Capture One'] },
  'ch-sprint': { name: 'Sprint Planning', topics: ['Backlog', 'Reviews'] },
  'ch-termine': { name: 'Termine', topics: ['Diese Woche', 'Nächste Woche'] },
  'ch-ableton': { name: 'Ableton Live', topics: ['Devices', 'Workflow'] },
  'ch-mixing': { name: 'Mixing & Mastering', topics: ['Techniken', 'Feedback'] },
};

const communityMessages = {
  k1: [
    { id: 'm1', from: 'u1', text: 'Hat jemand Erfahrung mit Design Tokens in Figma Variables?', time: '09:12' },
    { id: 'm2', from: 'u4', text: 'Ja, wir nutzen das seit einem halben Jahr produktiv', time: '09:20' },
    { id: 'm3', from: 'me', text: 'Wie handhabt ihr Dark Mode dabei?', time: '09:24' },
    { id: 'm4', from: 'u4', text: 'Zwei Modi in einer Collection, das reicht meistens', time: '09:31' },
  ],
  k2: [
    { id: 'm1', from: 'u2', text: 'Expo SDK 57 läuft bei mir stabil', time: 'Gestern' },
    { id: 'm2', from: 'u5', text: 'Bei mir auch, nur der Metro Cache zickt manchmal', time: 'Gestern' },
  ],
  k3: [{ id: 'm1', from: 'u3', text: 'Goldene Stunde heute um 19:40', time: 'Mo' }],
  k4: [
    { id: 'm1', from: 'u1', text: 'Sprint-Planung morgen um 10 Uhr', time: '11:02' },
    { id: 'm2', from: 'me', text: 'Bin dabei', time: '11:05' },
  ],
  k5: [{ id: 'm1', from: 'u6', text: 'Samstag 8 Uhr am Rheinpark?', time: 'So' }],
  k6: [{ id: 'm1', from: 'u5', text: 'Neuer Track ist fertig gemischt', time: 'Sa' }],
};

const contacts = [
  { id: 'u1', name: 'Anna Schmidt', status: 'friend', about: 'Verfügbar' },
  { id: 'u2', name: 'Bob Müller', status: 'friend', about: 'Im Meeting' },
  { id: 'u3', name: 'Clara Weber', status: 'pending', about: 'Anfrage gesendet' },
  { id: 'u4', name: 'David König', status: 'friend', about: 'Beschäftigt' },
  { id: 'u5', name: 'Elif Yilmaz', status: 'friend', about: 'Hey, ich nutze All Media!' },
  { id: 'u6', name: 'Finn Bauer', status: 'friend', about: 'Nur dringende Anrufe' },
];

const messages = {
  c1: [
    { id: 'm1', from: 'u1', text: 'Hey! Wie läuft das Projekt?', time: '14:02' },
    { id: 'm2', from: 'me', text: 'Läuft gut, bin fast fertig mit dem Design', time: '14:05' },
    { id: 'm3', from: 'u1', text: 'Super, kannst du mir das nachher zeigen?', time: '14:20' },
    { id: 'm4', from: 'me', text: 'Klar, so gegen 17 Uhr?', time: '14:28' },
    { id: 'm5', from: 'u1', text: 'Klingt gut, bis später!', time: '14:32' },
  ],
  c2: [
    { id: 'm1', from: 'u2', text: 'Hast du die Unterlagen schon?', time: '12:40' },
    { id: 'm2', from: 'me', text: 'Noch nicht, kannst du sie schicken?', time: '12:55' },
    { id: 'm3', from: 'u2', text: 'Schicke dir die Datei gerade', time: '13:05' },
  ],
  c3: [
    { id: 'm1', from: 'u3', text: 'Schau mal, was ich gefunden habe', time: '11:40' },
    { id: 'm2', from: 'u3', text: 'Foto', time: '11:48', media: 'image' },
  ],
  c4: [
    { id: 'm1', from: 'u1', text: 'Sind alle für morgen bereit?', time: 'Gestern' },
    { id: 'm2', from: 'u2', text: 'Von meiner Seite ja', time: 'Gestern' },
    { id: 'm3', from: 'me', text: 'Ich auch', time: 'Gestern' },
    { id: 'm4', from: 'u4', text: 'Meeting verschoben auf 15 Uhr', time: 'Gestern' },
  ],
  c5: [
    { id: 'm1', from: 'me', text: 'Ich melde mich morgen bei dir', time: 'Gestern' },
    { id: 'm2', from: 'u4', text: 'Alles klar 👍', time: 'Gestern' },
  ],
  c6: [{ id: 'm1', from: 'u5', text: 'Sprachnachricht', time: 'Mo', media: 'audio' }],
  c7: [
    { id: 'm1', from: 'u3', text: 'Samstag Grillen?', time: 'Mo' },
    { id: 'm2', from: 'u5', text: 'Wer ist dabei?', time: 'Mo' },
  ],
  c8: [
    { id: 'm1', from: 'me', text: 'Kein Problem!', time: 'So' },
    { id: 'm2', from: 'u6', text: 'Danke dir!', time: 'So' },
  ],
};

// Der Server haelt alles im Speicher. Damit der Smoke-Test nicht bei jedem Lauf
// Testgruppen und Testkommentare hinterlaesst, wird hier ein Abzug des
// Startzustands gemacht, den /api/reset wiederherstellt. Die Sammlungen werden
// dabei an Ort und Stelle geleert und neu gefuellt, damit alle Handler
// weiterhin auf dieselben Referenzen zeigen.
// Was der Nutzer selbst repostet hat - fuellt den Repost-Reiter im eigenen
// Profil. Ohne diese Liste blieb der Reiter immer leer.
// --- Mitteilungen ---------------------------------------------------------
// Prototyp-Frames "VP + Mitteilung" (Videos-Profil) und "CP + Mitteilungen"
// (Community-Profil). Beide Bereiche haben eine eigene Liste, weil im
// Prototyp auch beide eine eigene Glocke haben.
//
// Gespeichert wird nur, was passiert ist - der Satz entsteht erst beim
// Ausliefern. Sonst muesste bei jeder Textaenderung der Bestand mitwandern.
const mitteilungen = [
  { id: 'n1', bereich: 'videos', art: 'like', userId: 'u1', ziel: { art: 'post', id: 'p1' }, minuten: 10, gelesen: false },
  { id: 'n2', bereich: 'videos', art: 'follow', userId: 'u5', ziel: { art: 'profile', id: 'u5' }, minuten: 95, gelesen: false },
  { id: 'n3', bereich: 'videos', art: 'comment', userId: 'u3', ziel: { art: 'post', id: 'p2' }, minuten: 260, gelesen: false },
  { id: 'n4', bereich: 'videos', art: 'repost', userId: 'u4', ziel: { art: 'video', id: 'v1' }, minuten: 1500, gelesen: true },
  { id: 'n5', bereich: 'videos', art: 'mention', userId: 'u2', ziel: { art: 'profile', id: 'u2' }, minuten: 7200, gelesen: true },
  { id: 'n6', bereich: 'videos', art: 'story', userId: 'u6', ziel: { art: 'profile', id: 'u6' }, minuten: 11000, gelesen: true },
  { id: 'n7', bereich: 'videos', art: 'like', userId: 'u3', ziel: { art: 'video', id: 'v2' }, minuten: 30000, gelesen: true },
  { id: 'n8', bereich: 'videos', art: 'follow', userId: 'u7', ziel: { art: 'profile', id: 'u7' }, minuten: 46000, gelesen: true },

  { id: 'c1', bereich: 'communities', art: 'kanal', userId: 'u2', ziel: { art: 'community', id: 'k1' }, minuten: 25, gelesen: false },
  { id: 'c2', bereich: 'communities', art: 'beitritt', userId: 'u5', ziel: { art: 'community', id: 'k2' }, minuten: 180, gelesen: false },
  { id: 'c3', bereich: 'communities', art: 'nachricht', userId: 'u1', ziel: { art: 'community', id: 'k1' }, minuten: 1400, gelesen: true },
  { id: 'c4', bereich: 'communities', art: 'einladung', userId: 'u4', ziel: { art: 'community', id: 'k3' }, minuten: 6000, gelesen: true },
  { id: 'c5', bereich: 'communities', art: 'beitritt', userId: 'u6', ziel: { art: 'community', id: 'k4' }, minuten: 20000, gelesen: true },
];

/** "vor 10 min", "vor 4 h", "vor 5 Tagen", "vor 3 W", "vor 2 M" - wie im Prototyp. */
function zeitText(minuten) {
  if (minuten < 60) return `vor ${minuten} min`;
  const stunden = Math.floor(minuten / 60);
  if (stunden < 24) return `vor ${stunden} h`;
  const tage = Math.floor(stunden / 24);
  if (tage === 1) return 'vor 1 Tag';
  if (tage < 7) return `vor ${tage} Tagen`;
  const wochen = Math.floor(tage / 7);
  if (wochen < 5) return `vor ${wochen} W`;
  return `vor ${Math.floor(tage / 30)} M`;
}

function mitteilungText(m) {
  const name = users[m.userId]?.name || 'Jemand';
  const community = communities.find((c) => c.id === m.ziel.id)?.name || 'einer Community';
  return {
    like: `${name} gefällt dein ${m.ziel.art === 'video' ? 'Video' : 'Beitrag'}.`,
    follow: `${name} folgt dir jetzt.`,
    comment: `${name} hat deinen Beitrag kommentiert.`,
    repost: `${name} hat dein Video repostet.`,
    mention: `${name} hat dich in einem Kommentar erwähnt.`,
    story: `${name} hat auf deine Story geantwortet.`,
    kanal: `${name} hat einen neuen Kanal in „${community}" erstellt.`,
    beitritt: `${name} ist „${community}" beigetreten.`,
    nachricht: `Neue Nachrichten in „${community}".`,
    einladung: `${name} hat dich zu „${community}" eingeladen.`,
  }[m.art];
}

/** Liste eines Bereichs, fertig fuer die Anzeige. */
function mitteilungenFuer(bereich) {
  return mitteilungen
    .filter((m) => m.bereich === bereich)
    .sort((a, b) => a.minuten - b.minuten)
    .map((m) => ({
      id: m.id,
      art: m.art,
      userId: m.userId,
      text: mitteilungText(m),
      zeit: zeitText(m.minuten),
      gelesen: m.gelesen,
      ziel: m.ziel,
    }));
}

/** Neue Mitteilung anlegen - wird benutzt, wenn in der App etwas passiert. */
function neueMitteilung(bereich, art, userId, ziel) {
  const eintrag = { id: `n${Date.now()}${mitteilungen.length}`, bereich, art, userId, ziel, minuten: 0, gelesen: false };
  mitteilungen.unshift(eintrag);
  return eintrag;
}

const reposts = [];

/** Repost setzen oder zuruecknehmen. */
function setzeRepost(art, id, an) {
  const stelle = reposts.findIndex((r) => r.art === art && r.id === id);
  if (an && stelle === -1) reposts.unshift({ art, id, zeit: Date.now() });
  if (!an && stelle !== -1) reposts.splice(stelle, 1);
}

const SEED = structuredClone({ chats, contacts, posts, videos, clips, communities, messages, communityMessages, comments, profiles, stories, mitteilungen, gridItems });

function resetState() {
  const restoreList = (list, seed) => {
    list.length = 0;
    list.push(...structuredClone(seed));
  };
  const restoreMap = (map, seed) => {
    for (const key of Object.keys(map)) delete map[key];
    Object.assign(map, structuredClone(seed));
  };

  restoreList(chats, SEED.chats);
  restoreList(contacts, SEED.contacts);
  restoreList(posts, SEED.posts);
  restoreList(videos, SEED.videos);
  restoreList(communities, SEED.communities);
  restoreList(stories, SEED.stories);
  restoreList(mitteilungen, SEED.mitteilungen);
  restoreList(clips, SEED.clips);
  restoreMap(gridItems, SEED.gridItems);
  eigeneNummer = 0;
  restoreMap(messages, SEED.messages);
  restoreMap(communityMessages, SEED.communityMessages);
  restoreMap(comments, SEED.comments);
  restoreMap(profiles, SEED.profiles);
  reposts.length = 0;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/api/reset', (req, res) => {
  resetState();
  res.json({ ok: true });
});

app.get('/api/bootstrap', (req, res) => {
  // Wem man folgt, gleich mitliefern - sonst zeigt der Folgen-Knopf im
  // Video-Feed "Folgen", obwohl man der Person laengst folgt.
  const gefolgt = Object.fromEntries(
    Object.entries(profiles).map(([id, p]) => [id, !!p.following_me])
  );
  const ungelesen = {
    videos: mitteilungen.filter((m) => m.bereich === 'videos' && !m.gelesen).length,
    communities: mitteilungen.filter((m) => m.bereich === 'communities' && !m.gelesen).length,
  };
  // Wen man blockiert oder stummgeschaltet hat - fuer die Listen in den
  // Einstellungen.
  const blockiert = Object.keys(profiles).filter((id) => profiles[id].blocked);
  const stummgeschaltet = Object.keys(profiles).filter((id) => profiles[id].muted);

  res.json({
    users, chats, stories, contacts, communities, videos, posts, clips,
    hashtags, sounds, places, friends, gefolgt, ungelesen, blockiert, stummgeschaltet,
  });
});

/* ------------------------------------------------- Kontakteinstellungen */
/*
 * Was der Prototyp-Frame "MC + Kontakteinstellungen" anbietet: Medien,
 * markierte Nachrichten, gemeinsame Gruppen, Chat leeren, Favorit.
 */

/** Nachricht mit einem Stern markieren oder die Markierung wieder wegnehmen. */
app.post('/api/messages/:chatId/:messageId/stern', (req, res) => {
  const store = communityMessages[req.params.chatId] ? communityMessages : messages;
  const nachricht = (store[req.params.chatId] || []).find((m) => m.id === req.params.messageId);
  if (!nachricht) return res.json({ ok: false, error: 'Diese Nachricht gibt es nicht' });

  nachricht.stern = !nachricht.stern;
  res.json({ ok: true, stern: nachricht.stern, id: nachricht.id });
});

/** Alles, was in diesem Chat an Medien und Weitergeleitetem liegt. */
app.get('/api/chats/:chatId/medien', (req, res) => {
  const store = communityMessages[req.params.chatId] ? communityMessages : messages;
  const alle = store[req.params.chatId] || [];

  res.json({
    medien: alle.filter((m) => m.media || m.geteilt || m.standort || m.kontakt),
    markiert: alle.filter((m) => m.stern),
    gesamt: alle.length,
  });
});

/** Chat leeren - die Unterhaltung bleibt, die Nachrichten sind weg. */
app.post('/api/chats/:chatId/leeren', (req, res) => {
  const store = communityMessages[req.params.chatId] ? communityMessages : messages;
  store[req.params.chatId] = [];

  const chat = chats.find((c) => c.id === req.params.chatId);
  if (chat) {
    chat.preview = 'Keine Nachrichten';
    chat.unread = 0;
  }
  res.json({ ok: true, chats });
});

/** Kontakt als Favorit merken. */
app.post('/api/kontakte/:userId/favorit', (req, res) => {
  const kontakt = contacts.find((c) => c.id === req.params.userId);
  if (!kontakt) return res.json({ ok: false, error: 'Diese Person steht nicht in deinen Kontakten' });

  kontakt.favorit = !kontakt.favorit;
  res.json({ ok: true, favorit: kontakt.favorit, contacts });
});

/*
 * Querformat-Player (Prototyp-Frame "VQ + Video"). Like, Merken und Repost
 * wie beim Hochformat - vorher liess sich ein Querformat-Video ueberhaupt
 * nicht oeffnen.
 */
app.post('/api/clips/:id/:action', (req, res) => {
  const clip = clips.find((c) => c.id === req.params.id);
  if (!clip) return res.status(404).json({ error: 'Nicht gefunden' });

  const { action } = req.params;
  if (action === 'like') {
    clip.liked = !clip.liked;
    clip.likes = Math.max(0, (clip.likes || 0) + (clip.liked ? 1 : -1));
  } else if (action === 'save') {
    clip.saved = !clip.saved;
  } else if (action === 'repost') {
    clip.reposted = !clip.reposted;
    setzeRepost('clip', clip.id, clip.reposted);
  } else {
    return res.status(400).json({ error: 'Unbekannte Aktion' });
  }

  res.json(clip);
});

/* --------------------------------------- Weitere Optionen im Fremdprofil */
/*
 * Stummschalten, Blockieren und Melden. Blockieren hat Folgen: die Person
 * fliegt aus den Kontakten, der gemeinsame Chat wird gesperrt, und sie
 * taucht in Auswahllisten nicht mehr auf. Sonst waere der Knopf nur ein
 * Hinweis mit anderem Text.
 */
app.post('/api/profile/:userId/:was', (req, res, next) => {
  const { userId, was } = req.params;
  if (!['stumm', 'block', 'melden'].includes(was)) return next();

  const profil = profiles[userId];
  const person = users[userId];
  if (!profil || !person) return res.json({ ok: false, error: 'Profil nicht gefunden' });

  if (was === 'stumm') {
    profil.muted = !profil.muted;
    return res.json({ ok: true, muted: profil.muted });
  }

  if (was === 'melden') {
    const grund = String(req.body?.grund || '').trim();
    if (!grund) return res.json({ ok: false, error: 'Bitte einen Grund auswählen' });
    profil.gemeldet = grund;
    return res.json({ ok: true, gemeldet: grund });
  }

  profil.blocked = !profil.blocked;

  const chat = chats.find((c) => !c.isGroup && c.userId === userId);
  if (profil.blocked) {
    const stelle = contacts.findIndex((c) => c.id === userId);
    if (stelle !== -1) contacts.splice(stelle, 1);
    if (chat) chat.blocked = true;
  } else if (chat) {
    delete chat.blocked;
  }

  res.json({ ok: true, blocked: profil.blocked, contacts, chats });
});

/* ------------------------------------------------------- Explorer-Seiten */
/*
 * Was hinter einem Hashtag, einem Standort und einem Sound steckt.
 * Prototyp-Frames "VS# - Hashtagoptionen", "VSS + Standort" und
 * "VSSo + Sound". Alle drei sind gleich aufgebaut: ein Kopf und darunter
 * die Abschnitte Reels, Querformat und Beitraege.
 *
 * Bisher gab jeder dieser Knoepfe nur "... folgt" aus.
 */
app.get('/api/explorer/:art/:wert', (req, res) => {
  const { art } = req.params;
  const wert = decodeURIComponent(req.params.wert);

  let passt;
  let kopf;

  if (art === 'hashtag') {
    const tag = wert.startsWith('#') ? wert : `#${wert}`;
    passt = (e) => (e.tags || []).includes(tag);
    kopf = { art, titel: tag, anzahl: hashtags.find((h) => h.tag === tag)?.posts || 0 };
  } else if (art === 'standort') {
    const platz = places.find((p) => p.id === wert || p.name === wert);
    if (!platz) return res.json({ ok: false, error: 'Diesen Standort gibt es nicht' });
    passt = (e) => e.location === platz.ort;
    kopf = { art, titel: platz.name, anzahl: platz.posts, adresse: platz.adresse, koordinaten: platz.koordinaten, x: platz.x, y: platz.y };
  } else if (art === 'sound') {
    const sound = sounds.find((s) => s.id === wert || s.title === wert);
    if (!sound) return res.json({ ok: false, error: 'Diesen Sound gibt es nicht' });
    passt = (e) => typeof e.music === 'string' && e.music.startsWith(sound.title);
    kopf = { art, titel: sound.title, produzent: sound.artist, anzahl: sound.uses, dauer: sound.dauer, lyrics: sound.lyrics };
  } else {
    return res.json({ ok: false, error: 'Unbekannter Bereich' });
  }

  res.json({
    ok: true,
    kopf,
    reels: videos.filter(passt),
    clips: clips.filter(passt),
    beitraege: posts.filter(passt),
  });
});

/** Eigenen Kanal anlegen (Prototyp "CP + erstellen"). */
app.post('/api/communities', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const thema = String(req.body?.thema || '').trim();
  if (!name) return res.json({ ok: false, error: 'Bitte einen Namen eingeben' });
  if (communities.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return res.json({ ok: false, error: 'Diesen Kanal gibt es schon' });
  }

  const community = {
    id: `k${Date.now()}`,
    name,
    members: 1,
    visibility: req.body?.sichtbarkeit === 'public' ? 'public' : 'private',
    topic: thema || 'Ohne Beschreibung',
    joined: true,
    unread: 0,
    eigen: true,
  };
  communities.unshift(community);
  communityMessages[community.id] = [];
  res.json({ ok: true, community });
});

/* --------------------------------------------------------- Eigene Inhalte */
/*
 * Was der Plus-Knopf im eigenen Profil anlegt (Prototyp "VP + erstellen").
 * Das Bild selbst bleibt im Browser - der Server teilt seinen Speicher mit
 * allen Besuchern, dort haette ein privates Foto nichts zu suchen. Hier
 * steht nur der Eintrag.
 */
let eigeneNummer = 0;
const eigeneId = (praefix) => `${praefix}_e${++eigeneNummer}`;

app.post('/api/eigene/beitrag', (req, res) => {
  const beschreibung = String(req.body?.beschreibung || '').trim();
  if (!beschreibung) return res.json({ ok: false, error: 'Bitte eine Beschreibung eingeben' });

  const beitrag = {
    id: eigeneId('p'),
    userId: 'me',
    location: String(req.body?.ort || '').trim() || 'Ohne Ort',
    music: 'Originalton',
    description: beschreibung,
    likedBy: '',
    likes: 0,
    comments: 0,
    reposts: 0,
    reposted: false,
    liked: false,
    saved: false,
    following: false,
    notify: false,
    eigen: true,
  };
  posts.unshift(beitrag);
  gridItems.me.unshift({ id: beitrag.id, kind: 'image', eigen: true });
  profiles.me.posts += 1;
  res.json({ ok: true, beitrag });
});

app.post('/api/eigene/video', (req, res) => {
  const beschreibung = String(req.body?.beschreibung || '').trim();
  if (!beschreibung) return res.json({ ok: false, error: 'Bitte eine Beschreibung eingeben' });
  const quer = req.body?.format === 'quer';

  if (quer) {
    const clip = {
      id: eigeneId('q'),
      userId: 'me',
      title: beschreibung,
      duration: String(req.body?.dauer || '00:15'),
      views: 0,
      age: 'gerade eben',
      eigen: true,
    };
    clips.unshift(clip);
    gridItems.me.unshift({ id: clip.id, kind: 'video', eigen: true });
    profiles.me.posts += 1;
    return res.json({ ok: true, clip });
  }

  const video = {
    id: eigeneId('v'),
    userId: 'me',
    description: beschreibung,
    location: String(req.body?.ort || '').trim() || 'Ohne Ort',
    music: 'Originalton',
    likes: 0,
    comments: 0,
    shares: 0,
    reposted: false,
    liked: false,
    saved: false,
    eigen: true,
  };
  videos.unshift(video);
  gridItems.me.unshift({ id: video.id, kind: 'video', eigen: true });
  profiles.me.posts += 1;
  res.json({ ok: true, video });
});

app.post('/api/eigene/highlight', (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.json({ ok: false, error: 'Bitte einen Namen eingeben' });
  if (profiles.me.highlights.includes(name)) return res.json({ ok: false, error: 'Dieses Highlight gibt es schon' });
  profiles.me.highlights.push(name);
  res.json({ ok: true, highlights: profiles.me.highlights });
});

app.post('/api/eigene/playlist', (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.json({ ok: false, error: 'Bitte einen Namen eingeben' });
  profiles.me.playlists = profiles.me.playlists || [];
  if (profiles.me.playlists.includes(name)) return res.json({ ok: false, error: 'Diese Playlist gibt es schon' });
  profiles.me.playlists.push(name);
  res.json({ ok: true, playlists: profiles.me.playlists });
});

app.post('/api/eigene/spende', (req, res) => {
  const titel = String(req.body?.titel || '').trim();
  const ziel = Number(req.body?.ziel);
  if (!titel) return res.json({ ok: false, error: 'Bitte einen Titel eingeben' });
  if (!Number.isFinite(ziel) || ziel <= 0) return res.json({ ok: false, error: 'Bitte ein Spendenziel in Euro eingeben' });

  profiles.me.spende = { titel, ziel, gesammelt: 0, text: String(req.body?.text || '').trim() };
  res.json({ ok: true, spende: profiles.me.spende });
});

/** Livestream starten und beenden. Die Aufzeichnung bleibt im Profil. */
app.post('/api/eigene/livestream', (req, res) => {
  if (req.body?.aktion === 'start') {
    profiles.me.live = { seit: Date.now(), zuschauer: 0 };
    return res.json({ ok: true, live: true });
  }

  const lief = profiles.me.live;
  profiles.me.live = null;
  if (!lief) return res.json({ ok: true, live: false });

  const sekunden = Math.max(1, Math.round((Date.now() - lief.seit) / 1000));
  const clip = {
    id: eigeneId('q'),
    userId: 'me',
    title: String(req.body?.titel || '').trim() || 'Livestream-Aufzeichnung',
    duration: `${String(Math.floor(sekunden / 60)).padStart(2, '0')}:${String(sekunden % 60).padStart(2, '0')}`,
    views: lief.zuschauer,
    age: 'gerade eben',
    eigen: true,
    aufzeichnung: true,
  };
  clips.unshift(clip);
  gridItems.me.unshift({ id: clip.id, kind: 'video', eigen: true });
  res.json({ ok: true, live: false, clip });
});

/** Mitteilungen eines Bereichs ("videos" oder "communities"). */
app.get('/api/mitteilungen/:bereich', (req, res) => {
  const eintraege = mitteilungenFuer(req.params.bereich);
  res.json({ eintraege, ungelesen: eintraege.filter((m) => !m.gelesen).length });
});

/** Eine einzelne Mitteilung als gelesen markieren. */
app.post('/api/mitteilungen/:id/gelesen', (req, res) => {
  const m = mitteilungen.find((x) => x.id === req.params.id);
  if (!m) return res.json({ ok: false, error: 'Diese Mitteilung gibt es nicht' });
  m.gelesen = true;
  res.json({ ok: true, ungelesen: mitteilungen.filter((x) => x.bereich === m.bereich && !x.gelesen).length });
});

/** Alle Mitteilungen eines Bereichs als gelesen markieren. */
app.post('/api/mitteilungen/:bereich/alle-gelesen', (req, res) => {
  for (const m of mitteilungen) if (m.bereich === req.params.bereich) m.gelesen = true;
  res.json({ ok: true, ungelesen: 0 });
});

/** Die eigenen Reposts, aufgeloest zu Beitraegen und Videos. */
app.get('/api/reposts', (req, res) => {
  res.json(
    reposts
      .map((r) =>
        r.art === 'post'
          ? { art: 'post', eintrag: posts.find((p) => p.id === r.id) }
          : r.art === 'clip'
          ? { art: 'clip', eintrag: clips.find((c) => c.id === r.id) }
          : { art: 'video', eintrag: videos.find((v) => v.id === r.id) }
      )
      .filter((r) => r.eintrag)
  );
});

app.get('/api/profile/:userId', (req, res) => {
  const userId = req.params.userId;
  const profile = profiles[userId];
  const person = users[userId];
  if (!profile || !person) return res.status(404).json({ error: 'Nicht gefunden' });

  res.json({ ...person, ...profile, grid: gridItems[userId] || [] });
});

/** Einem Video-Autor folgen oder entfolgen. */
app.post('/api/autoren/:userId/follow', (req, res) => {
  const profil = profiles[req.params.userId];
  if (!profil) return res.json({ ok: false, error: 'Profil nicht gefunden' });

  profil.following_me = !profil.following_me;
  profil.followers += profil.following_me ? 1 : -1;
  res.json({ ok: true, following: profil.following_me, followers: profil.followers });
});

app.post('/api/profile/:userId/follow', (req, res) => {
  const profile = profiles[req.params.userId];
  if (!profile) return res.status(404).json({ error: 'Nicht gefunden' });

  profile.following_me = !profile.following_me;
  profile.followers += profile.following_me ? 1 : -1;
  res.json({ following_me: profile.following_me, followers: profile.followers });
});

app.get('/api/comments/:targetId', (req, res) => {
  res.json(comments[req.params.targetId] || []);
});

app.post('/api/comments/:targetId', (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text erforderlich' });

  const targetId = req.params.targetId;
  if (!comments[targetId]) comments[targetId] = [];

  const comment = {
    id: 'cm' + Date.now(),
    userId: 'me',
    text: text.trim(),
    time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    likes: 0,
    liked: false,
  };
  comments[targetId].push(comment);

  const target = posts.find((p) => p.id === targetId) || videos.find((v) => v.id === targetId);
  if (target) target.comments += 1;

  res.json(comment);
});

app.post('/api/comments/:targetId/:commentId/like', (req, res) => {
  const list = comments[req.params.targetId] || [];
  const comment = list.find((c) => c.id === req.params.commentId);
  if (!comment) return res.status(404).json({ error: 'Nicht gefunden' });

  comment.liked = !comment.liked;
  comment.likes += comment.liked ? 1 : -1;
  res.json(comment);
});

app.post('/api/posts/:id/:action', (req, res) => {
  const post = posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Nicht gefunden' });

  const { action } = req.params;
  if (action === 'like') {
    post.liked = !post.liked;
    post.likes += post.liked ? 1 : -1;
  } else if (action === 'save') {
    post.saved = !post.saved;
  } else if (action === 'follow') {
    post.following = !post.following;
  } else if (action === 'notify') {
    post.notify = !post.notify;
  } else if (action === 'repost') {
    // Der eigene Repost landet im Repost-Reiter des eigenen Profils.
    post.reposted = !post.reposted;
    post.reposts += post.reposted ? 1 : -1;
    setzeRepost('post', post.id, post.reposted);
  } else {
    return res.status(400).json({ error: 'Unbekannte Aktion' });
  }

  res.json(post);
});

app.post('/api/videos/:id/:action', (req, res) => {
  const video = videos.find((v) => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: 'Nicht gefunden' });

  const { action } = req.params;
  if (action === 'like') {
    video.liked = !video.liked;
    video.likes += video.liked ? 1 : -1;
  } else if (action === 'save') {
    video.saved = !video.saved;
  } else if (action === 'share') {
    video.shares += 1;
  } else if (action === 'repost') {
    video.reposted = !video.reposted;
    video.shares += video.reposted ? 1 : -1;
    setzeRepost('video', video.id, video.reposted);
  } else {
    return res.status(400).json({ error: 'Unbekannte Aktion' });
  }

  res.json(video);
});

app.get('/api/messages/:chatId', (req, res) => {
  res.json(messages[req.params.chatId] || communityMessages[req.params.chatId] || []);
});

app.post('/api/communities/:id/join', (req, res) => {
  const community = communities.find((c) => c.id === req.params.id);
  if (!community) return res.status(404).json({ error: 'Nicht gefunden' });

  community.joined = !community.joined;
  community.members += community.joined ? 1 : -1;
  res.json(community);
});

app.post('/api/messages/:chatId', (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text erforderlich' });
  }
  const chatId = req.params.chatId;

  // Solange die Anfrage laeuft, bleibt es bei der einen Nachricht, die schon
  // mit der Anfrage rausging.
  const offen = chats.find((c) => c.id === chatId);
  if (offen && offen.requestState === 'pending') {
    return res.json({ ok: false, error: 'Warte, bis die Anfrage angenommen wurde' });
  }
  if (offen && offen.blocked) {
    return res.json({ ok: false, error: 'Diese Person ist blockiert' });
  }

  const store = communityMessages[chatId] ? communityMessages : messages;
  if (!store[chatId]) store[chatId] = [];

  const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const message = { id: 'm' + Date.now(), from: 'me', text: text.trim(), time };
  store[chatId].push(message);

  const chat = chats.find((c) => c.id === chatId);
  if (chat) {
    chat.preview = text.trim();
    chat.time = time;
  }

  res.json(message);
});

/*
 * Einen Beitrag oder ein Video an Kontakte schicken - Prototyp-Frames
 * "Nutzer B + Beitrag teilen" und "VQ + Video teilen". Dort steht ein Raster
 * mit Personen; wen man antippt, der bekommt es in den Chat.
 */
app.post('/api/teilen', (req, res) => {
  const { art, id } = req.body || {};
  const empfaenger = Array.isArray(req.body?.empfaenger) ? req.body.empfaenger : [];
  if (!empfaenger.length) return res.json({ ok: false, error: 'Bitte mindestens eine Person auswählen' });

  const eintrag =
    art === 'video'
      ? videos.find((v) => v.id === id)
      : art === 'clip'
      ? clips.find((c) => c.id === id)
      : posts.find((p) => p.id === id);
  if (!eintrag) return res.json({ ok: false, error: 'Diesen Beitrag gibt es nicht mehr' });

  const autor = users[eintrag.userId]?.name || 'Unbekannt';
  const titel = eintrag.title || eintrag.description || 'Ohne Beschreibung';
  const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const vorschau = art === 'post' ? 'Beitrag geteilt' : 'Video geteilt';
  const gesendet = [];

  for (const userId of empfaenger) {
    if (!users[userId]) continue;

    let chat = chats.find((c) => !c.isGroup && c.userId === userId);
    if (!chat) {
      chat = {
        id: `c${Date.now()}${gesendet.length}`,
        userId,
        name: users[userId].name,
        preview: vorschau,
        time,
        unread: 0,
        muted: false,
        isGroup: false,
      };
      chats.unshift(chat);
    }

    if (!messages[chat.id]) messages[chat.id] = [];
    messages[chat.id].push({
      id: `m${Date.now()}${gesendet.length}`,
      from: 'me',
      text: vorschau,
      time,
      geteilt: { art, id, titel, autor },
    });

    chat.preview = vorschau;
    chat.time = time;
    gesendet.push(userId);
  }

  if (art === 'video') eintrag.shares = (eintrag.shares || 0) + gesendet.length;
  res.json({ ok: true, gesendet, chats });
});

/*
 * Anhang im Chat: Foto, Standort oder ein weitergereichter Kontakt.
 * Das Bild selbst bleibt im Browser - der Server merkt sich nur, dass an
 * dieser Stelle ein Foto steht. Genauso ist es bei "Deine Story" und bei
 * eigenen Beitraegen geloest.
 */
app.post('/api/messages/:chatId/anhang', (req, res) => {
  const chatId = req.params.chatId;
  const art = req.body?.art;

  const offen = chats.find((c) => c.id === chatId);
  if (offen && offen.requestState === 'pending') {
    return res.json({ ok: false, error: 'Warte, bis die Anfrage angenommen wurde' });
  }
  if (offen && offen.blocked) {
    return res.json({ ok: false, error: 'Diese Person ist blockiert' });
  }

  const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const message = { id: 'm' + Date.now(), from: 'me', time };
  let vorschau;

  if (art === 'foto') {
    message.media = 'image';
    message.text = 'Foto';
    vorschau = 'Foto';
  } else if (art === 'standort') {
    const platz = places.find((p) => p.id === req.body?.id) || places[0];
    message.standort = { name: platz.name, adresse: platz.adresse, koordinaten: platz.koordinaten, x: platz.x, y: platz.y };
    message.text = `Standort: ${platz.name}`;
    vorschau = 'Standort';
  } else if (art === 'kontakt') {
    const person = users[req.body?.id];
    if (!person) return res.json({ ok: false, error: 'Diese Person gibt es nicht' });
    message.kontakt = { id: person.id, name: person.name, handle: person.handle, phone: person.phone };
    message.text = `Kontakt: ${person.name}`;
    vorschau = 'Kontakt';
  } else {
    return res.json({ ok: false, error: 'Unbekannter Anhang' });
  }

  const store = communityMessages[chatId] ? communityMessages : messages;
  if (!store[chatId]) store[chatId] = [];
  store[chatId].push(message);

  const chat = chats.find((c) => c.id === chatId);
  if (chat) {
    chat.preview = vorschau;
    chat.time = time;
  }

  res.json({ ok: true, message });
});

app.post('/api/groups', (req, res) => {
  const { name, memberIds, info } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name erforderlich' });
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'Mindestens ein Mitglied erforderlich' });
  }

  const chat = {
    id: 'c' + Date.now(),
    userId: null,
    name: name.trim(),
    preview: (info && info.trim()) || 'Gruppe erstellt',
    info: (info && info.trim()) || '',
    time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    unread: 0,
    muted: false,
    isGroup: true,
    members: memberIds,
  };
  chats.unshift(chat);
  messages[chat.id] = [];

  res.json(chat);
});

// "Nicht gefunden" und "schon vorhanden" sind hier normale Ergebnisse einer
// Suche, keine Fehler der Anfrage. Deshalb 200 mit ok-Feld statt 404/409 —
// sonst protokolliert der Browser bei jeder Fehleingabe einen Ladefehler.
app.post('/api/contacts', (req, res) => {
  const { handle, nachricht } = req.body || {};
  if (!handle || !handle.trim()) {
    return res.json({ ok: false, error: 'Bitte Benutzername oder Telefonnummer eingeben' });
  }

  const person = findePerson(handle);

  if (!person) {
    return res.json({
      ok: false,
      error: istNummer(handle)
        ? 'Zu dieser Nummer gibt es noch kein Konto'
        : 'Niemand mit diesem Benutzernamen gefunden',
    });
  }
  if (contacts.some((c) => c.id === person.id)) {
    return res.json({ ok: false, error: `${person.name} ist bereits in deinen Kontakten` });
  }

  const contact = { id: person.id, name: person.name, status: 'pending', about: 'Anfrage gesendet', phone: person.phone };
  contacts.push(contact);

  // Chat zur Anfrage anlegen. Bis zur Annahme ist genau die eine
  // mitgeschickte Nachricht erlaubt.
  const text = (nachricht || '').trim();
  const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const chat = {
    id: 'c' + Date.now(),
    userId: person.id,
    name: person.name,
    preview: text || 'Anfrage gesendet',
    time,
    unread: 0,
    muted: false,
    isGroup: false,
    requestState: 'pending',
  };
  chats.unshift(chat);
  messages[chat.id] = text ? [{ id: 'm' + Date.now(), from: 'me', text, time }] : [];

  res.json({ ok: true, contact, chat });
});

/** Person zu einer Nummer oder einem Benutzernamen nachschlagen. */
app.post('/api/personen/suche', (req, res) => {
  const { eingabe } = req.body || {};
  const person = findePerson(eingabe || '');
  res.json({ person: person || null });
});

/** Anfrage annehmen - danach ist der Chat frei benutzbar. */
app.post('/api/chats/:chatId/accept', (req, res) => {
  const chat = chats.find((c) => c.id === req.params.chatId);
  if (!chat) return res.json({ ok: false, error: 'Chat nicht gefunden' });

  chat.requestState = 'accepted';
  const kontakt = contacts.find((c) => c.id === chat.userId);
  if (kontakt) {
    kontakt.status = 'friend';
    kontakt.about = 'Kontakt';
  }
  res.json({ ok: true, chat });
});

// Story liken. Der Zustand liegt beim Server, damit das Herz beim erneuten
// Oeffnen der Story noch rot ist.
app.post('/api/stories/:id/like', (req, res) => {
  const story = stories.find((s) => s.id === req.params.id);
  if (!story) return res.status(404).json({ error: 'Nicht gefunden' });

  story.liked = !story.liked;
  res.json(story);
});

app.post('/api/stories/:id/seen', (req, res) => {
  const story = stories.find((s) => s.id === req.params.id);
  if (story) story.viewed = true;
  res.json({ ok: true });
});

// Antwort auf eine Story landet im normalen Chat mit dieser Person. Gibt es
// noch keinen, wird er angelegt — sonst waere die Antwort nirgends zu sehen.
app.post('/api/stories/:id/reply', (req, res) => {
  const story = stories.find((s) => s.id === req.params.id);
  const { text } = req.body || {};
  if (!story) return res.status(404).json({ error: 'Nicht gefunden' });
  if (!text || !text.trim()) return res.json({ ok: false, error: 'Bitte etwas schreiben' });

  let chat = chats.find((c) => !c.isGroup && c.userId === story.userId);
  const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  if (!chat) {
    const person = users[story.userId];
    chat = {
      id: 'c' + Date.now(),
      userId: story.userId,
      name: person ? person.name : 'Unbekannt',
      preview: '',
      time,
      unread: 0,
      muted: false,
      isGroup: false,
    };
    chats.unshift(chat);
    messages[chat.id] = [];
  }

  if (!messages[chat.id]) messages[chat.id] = [];
  const message = {
    id: 'm' + Date.now(),
    from: 'me',
    text: text.trim(),
    time,
    replyToStory: story.name,
  };
  messages[chat.id].push(message);

  chat.preview = text.trim();
  chat.time = time;

  res.json({ ok: true, chatId: chat.id, message });
});

app.post('/api/chats/:chatId/read', (req, res) => {
  const chat = chats.find((c) => c.id === req.params.chatId);
  if (chat) chat.unread = 0;
  res.json({ ok: true });
});

/** Communities: beigetretene vs. Entdecken */
app.get('/api/communities', (req, res) => {
  const filter = req.query.filter || 'joined'; // joined | discover
  const result = communities.filter((c) => filter === 'discover' ? !c.joined : c.joined);
  res.json(result);
});

/** Community mit Kanälen */
app.get('/api/communities/:id', (req, res) => {
  const community = communities.find((c) => c.id === req.params.id);
  if (!community) return res.status(404).json({ error: 'Nicht gefunden' });

  const channels = community.channels.map((chId) => ({
    id: chId,
    name: communityChannels[chId]?.name || chId,
    topics: communityChannels[chId]?.topics || [],
  }));

  res.json({ ...community, channels });
});

/** Community-Kanal öffnen (zeigt Themen oder Chat) */
app.get('/api/communities/:id/channels/:chId', (req, res) => {
  const community = communities.find((c) => c.id === req.params.id);
  const channel = communityChannels[req.params.chId];

  if (!community || !channel) return res.status(404).json({ error: 'Nicht gefunden' });

  res.json({
    community: community.name,
    channel: channel.name,
    topics: channel.topics,
    messages: communityMessages[req.params.chId] || [],
  });
});

/** Community beitreten */
app.post('/api/communities/:id/join', (req, res) => {
  const community = communities.find((c) => c.id === req.params.id);
  if (community) community.joined = true;
  res.json({ ok: true });
});

/** Community verlassen */
app.post('/api/communities/:id/leave', (req, res) => {
  const community = communities.find((c) => c.id === req.params.id);
  if (community) community.joined = false;
  res.json({ ok: true });
});

module.exports = app;
