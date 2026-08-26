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
  u1: { id: 'u1', name: 'Anna Schmidt', handle: '@anna', initials: 'AS', color: 'linear-gradient(135deg,#FCA2BC,#E04570)', phone: '+49 151 2345678' },
  u2: { id: 'u2', name: 'Bob Müller', handle: '@bob', initials: 'BM', color: 'linear-gradient(135deg,#75DCF2,#1791BA)', phone: '+49 152 3456789' },
  u3: { id: 'u3', name: 'Clara Weber', handle: '@clara', initials: 'CW', color: 'linear-gradient(135deg,#FBD277,#D88F1C)', phone: '+49 160 4567890' },
  u4: { id: 'u4', name: 'David König', handle: '@david', initials: 'DK', color: 'linear-gradient(135deg,#9FDD84,#419A32)', phone: '+49 171 5678901' },
  u5: { id: 'u5', name: 'Elif Yilmaz', handle: '@elif', initials: 'EY', color: 'linear-gradient(135deg,#FFB877,#EE5F2A)', phone: '+49 172 6789012' },
  u6: { id: 'u6', name: 'Finn Bauer', handle: '@finn', initials: 'FB', color: 'linear-gradient(135deg,#93AEFF,#4152D8)', phone: '+49 173 7890123' },
  me: { id: 'me', name: 'Du', handle: '@henrik', initials: 'DU', color: 'linear-gradient(135deg,#FFB877,#EE5F2A)', phone: '+49 170 1234567' },
  // Diese drei stehen bewusst NICHT in den Kontakten - sonst laesst sich
  // "Kontakt hinzufuegen" gar nicht ausprobieren.
  u7: { id: 'u7', name: 'Greta Hoffmann', handle: '@greta', initials: 'GH', color: 'linear-gradient(135deg,#FBA0C4,#DC3F7C)', phone: '+49 174 8901234' },
  u8: { id: 'u8', name: 'Hakan Demir', handle: '@hakan', initials: 'HD', color: 'linear-gradient(135deg,#6FE2D0,#12907F)', phone: '+49 175 9012345' },
  u9: { id: 'u9', name: 'Ida Nowak', handle: '@ida', initials: 'IN', color: 'linear-gradient(135deg,#C4A4F7,#7C46EE)', phone: '+49 176 0123456' },
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

/*
 * Querformat-Videos (Videos / Querformat im Prototyp).
 *
 * `art` entscheidet, unter welchem Knopf der Filterleiste ein Video
 * auftaucht: 'standard', '360' oder 'live'. Fehlt das Feld, gilt
 * 'standard'. Vorher gab es das Feld nicht - die Leiste zeigte deshalb
 * unter allen vier Knoepfen dieselben Videos, was Henrik am 26.08.2026
 * gemeldet hat. Dieselbe Liste steht in app/mocks/index.ts.
 *
 * Jede Art kommt mehrfach vor: mit nur einem Live-Video liesse sich nicht
 * erkennen, ob wirklich gefiltert wird.
 */
const clips = [
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

/*
 * dauer und lyrics werden auf der Sound-Seite gebraucht.
 *
 * Prototyp-Frame "VSSo + Sound + Lyrics": Songname, Produzent/in, eine
 * Trennlinie und darunter der Liedtext ueber die ganze Seite. Henrik am
 * 26.08.2026, Punkt 11: "Sound öffnet, aber keine Lyrics-Anzeige."
 *
 * Vorher stand hier eine einzelne Zeile. Der Frame zeigt einen ganzen Text,
 * in Strophen getrennt - deshalb jetzt mehrere Zeilen je Lied. Instrumentale
 * Stuecke haben keinen Text; sie bekommen null und die Seite sagt das auch,
 * statt "Instrumental" als Liedzeile auszugeben.
 */
const sounds = [
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
 * Wie viele Kommentare ein Beitrag hat, steht NICHT mehr als eigene Zahl am
 * Beitrag. Henrik hatte gemeldet, dass "Alle 28 Kommentare ansehen" dasteht,
 * obwohl es nur vier gibt - die feste Zahl und die echte Liste waren
 * auseinandergelaufen.
 *
 * Jetzt zaehlt beim Ausliefern die Liste selbst. Damit kann es nicht wieder
 * auseinanderlaufen, auch nicht nachdem jemand einen Kommentar schreibt.
 */
function mitKommentarzahl(eintraege) {
  return eintraege.map((e) => ({ ...e, comments: (comments[e.id] || []).length }));
}

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

/*
 * Communitys.
 *
 * `bio`, `link` und `eigen` kamen am 26.08.2026 dazu: die Kanalseite wird
 * nach dem Prototyp-Frame "CH + Kanal" gebaut, und dort stehen unter dem
 * Kopfbild eine Biografie und ein Link. `eigen` sagt, ob Henrik die
 * Community selbst angelegt hat - eine eigene Community kann man nicht
 * verlassen (sonst stuende sie ohne Besitzer da).
 */
const communities = [
  { id: 'k1', name: 'Design Systeme', members: 1284, visibility: 'public', topic: 'Komponenten, Tokens, Figma', bio: 'Alles rund um Komponenten, Tokens und den Weg von Figma in den Code. Fragen jederzeit willkommen.', link: 'designsysteme.de', eigen: false, joined: true, unread: 3, channels: ['ch-allgemein', 'ch-tokens', 'ch-figma'] },
  { id: 'k2', name: 'React Native DE', members: 842, visibility: 'public', topic: 'Expo, Navigation, Performance', bio: 'Deutschsprachige Runde zu React Native und Expo. Von der ersten App bis zum Store-Release.', link: 'rn-de.dev', eigen: false, joined: true, unread: 0, channels: ['ch-allgemein', 'ch-expo', 'ch-navigation'] },
  { id: 'k3', name: 'Fotografie', members: 3120, visibility: 'public', topic: 'Licht, Komposition, Nachbearbeitung', bio: 'Licht, Komposition, Nachbearbeitung. Jeden Sonntag ein gemeinsames Thema.', link: 'lichtundschatten.foto', eigen: false, joined: false, unread: 0, channels: ['ch-allgemein', 'ch-licht', 'ch-nachbearbeitung'] },
  { id: 'k4', name: 'Team Intern', members: 12, visibility: 'private', topic: 'Nur für das Kernteam', bio: 'Interner Kanal des Kernteams. Sprintplanung, Entscheidungen, alles Kurzfristige.', link: '', eigen: true, joined: true, unread: 5, channels: ['ch-allgemein', 'ch-sprint'] },
  { id: 'k5', name: 'Laufgruppe Köln', members: 96, visibility: 'private', topic: 'Treffpunkte und Termine', bio: 'Wir laufen dienstags und samstags. Treffpunkte und Termine stehen hier.', link: 'laufgruppe-koeln.de', eigen: true, joined: true, unread: 0, channels: ['ch-allgemein', 'ch-termine'] },
  { id: 'k6', name: 'Musikproduktion', members: 671, visibility: 'public', topic: 'Ableton, Mixing, Sounddesign', bio: 'Ableton, Mixing, Sounddesign. Feedback-Runden am Monatsende.', link: 'musikproduktion.club', eigen: false, joined: false, unread: 0, channels: ['ch-allgemein', 'ch-ableton', 'ch-mixing'] },
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

/*
 * Nachrichten in den Kanaelen einer Community.
 *
 * Der Schluessel ist die KANAL-Kennung, nicht die der Community. Vorher stand
 * hier "k1", "k2" - also die Community. Der Kanal-Endpunkt sucht aber nach
 * "ch-tokens", fand deshalb nie etwas, und jeder Kanal war leer. Seit Henriks
 * Aufbau Community -> Kanal -> Thema gilt, gehoeren sie ohnehin an den Kanal:
 * eine Community hat mehrere Kanaele mit je eigenem Verlauf.
 */
const communityMessages = {
  'ch-tokens': [
    { id: 'm1', from: 'u1', text: 'Hat jemand Erfahrung mit Design Tokens in Figma Variables?', time: '09:12' },
    { id: 'm2', from: 'u4', text: 'Ja, wir nutzen das seit einem halben Jahr produktiv', time: '09:20' },
    { id: 'm3', from: 'me', text: 'Wie handhabt ihr Dark Mode dabei?', time: '09:24' },
    { id: 'm4', from: 'u4', text: 'Zwei Modi in einer Collection, das reicht meistens', time: '09:31' },
  ],
  'ch-figma': [
    { id: 'm1', from: 'u3', text: 'Welches Plugin nutzt ihr zum Exportieren?', time: 'Gestern' },
    { id: 'm2', from: 'u1', text: 'Wir gehen inzwischen ohne Plugin über die API', time: 'Gestern' },
  ],
  'ch-expo': [
    { id: 'm1', from: 'u2', text: 'Expo SDK 57 läuft bei mir stabil', time: 'Gestern' },
    { id: 'm2', from: 'u5', text: 'Bei mir auch, nur der Metro Cache zickt manchmal', time: 'Gestern' },
    { id: 'm3', from: 'me', text: 'Hilft bei mir: npx expo start -c', time: 'Gestern' },
  ],
  'ch-navigation': [
    { id: 'm1', from: 'u6', text: 'Router oder React Navigation für neue Projekte?', time: 'Mo' },
    { id: 'm2', from: 'u2', text: 'Router, wenn du sowieso auf Expo setzt', time: 'Mo' },
  ],
  'ch-licht': [
    { id: 'm1', from: 'u3', text: 'Goldene Stunde heute um 19:40', time: 'Mo' },
  ],
  'ch-nachbearbeitung': [
    { id: 'm1', from: 'u5', text: 'Capture One für Farben, Lightroom für alles andere', time: 'Sa' },
  ],
  'ch-sprint': [
    { id: 'm1', from: 'u1', text: 'Sprint-Planung morgen um 10 Uhr', time: '11:02' },
    { id: 'm2', from: 'me', text: 'Bin dabei', time: '11:05' },
  ],
  'ch-termine': [
    { id: 'm1', from: 'u6', text: 'Samstag 8 Uhr am Rheinpark?', time: 'So' },
    { id: 'm2', from: 'u4', text: 'Passt, ich bringe Wasser mit', time: 'So' },
  ],
  'ch-ableton': [
    { id: 'm1', from: 'u5', text: 'Neuer Track ist fertig gemischt', time: 'Sa' },
  ],
  'ch-mixing': [
    { id: 'm1', from: 'u2', text: 'Wie laut mastert ihr für Streaming?', time: 'Fr' },
    { id: 'm2', from: 'u5', text: '-14 LUFS integrated, dann macht keine Plattform Ärger', time: 'Fr' },
  ],
  'ch-allgemein': [
    { id: 'm1', from: 'u4', text: 'Willkommen allen Neuen hier!', time: '08:30' },
  ],
};

const contacts = [
  { id: 'u1', name: 'Anna Schmidt', status: 'friend', about: 'Verfügbar' },
  { id: 'u2', name: 'Bob Müller', status: 'friend', about: 'Im Meeting' },
  { id: 'u3', name: 'Clara Weber', status: 'pending', about: 'Anfrage gesendet' },
  { id: 'u4', name: 'David König', status: 'friend', about: 'Beschäftigt' },
  { id: 'u5', name: 'Elif Yilmaz', status: 'friend', about: 'Hey, ich nutze All Media!' },
  { id: 'u6', name: 'Finn Bauer', status: 'friend', about: 'Nur dringende Anrufe' },
];

/*
 * Persoenliche Chats im Community-Bereich.
 *
 * Henriks Trennung: "Messenger = Chat ueber Telefonnummer/Kontakt.
 * Community-Chat = Kommunikation ohne Telefonnummer, z. B. zum Teilen von
 * Videos oder fuer normale Nachrichten."
 *
 * Hier stehen deshalb Leute, die NICHT in den Kontakten sind - man kennt sie
 * aus einer Community, nicht aus dem Telefonbuch. Der Bereich zeigte vorher
 * die Communitys selbst; die stehen aber schon unter Home.
 */
const communityChats = [
  { id: 'cc1', userId: 'u7', name: 'Greta Hoffmann', preview: 'Dein Reel vom Hafen ist stark!', time: '15:04', unread: 2, muted: false, isGroup: false },
  { id: 'cc2', userId: 'u8', name: 'Hakan Demir', preview: 'Schaust du mal in den Tokens-Kanal?', time: '12:41', unread: 0, muted: false, isGroup: false },
  { id: 'cc3', userId: null, name: 'Design-Runde', preview: 'Ida: Donnerstag passt mir', time: 'Gestern', unread: 1, muted: false, isGroup: true, members: ['u7', 'u8', 'u9'] },
  { id: 'cc4', userId: 'u9', name: 'Ida Nowak', preview: 'Danke für den Tipp mit dem Stativ', time: 'Mo', unread: 0, muted: false, isGroup: false },
];

const communityChatMessages = {
  cc1: [
    { id: 'm1', from: 'u7', text: 'Dein Reel vom Hafen ist stark!', time: '15:04' },
  ],
  cc2: [
    { id: 'm1', from: 'u8', text: 'Schaust du mal in den Tokens-Kanal?', time: '12:41' },
    { id: 'm2', from: 'me', text: 'Mache ich heute Abend', time: '12:52' },
  ],
  cc3: [
    { id: 'm1', from: 'u8', text: 'Wann passt es euch diese Woche?', time: 'Gestern' },
    { id: 'm2', from: 'u9', text: 'Donnerstag passt mir', time: 'Gestern' },
  ],
  cc4: [
    { id: 'm1', from: 'u9', text: 'Danke für den Tipp mit dem Stativ', time: 'Mo' },
  ],
};

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

const SEED = structuredClone({ chats, contacts, posts, videos, clips, communities, messages, communityMessages, communityChats, communityChatMessages, comments, profiles, stories, mitteilungen, gridItems });

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
  restoreList(communityChats, SEED.communityChats);
  restoreMap(communityChatMessages, SEED.communityChatMessages);
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
    users, chats, stories, contacts, communities,
    // Die Kommentarzahl kommt aus der echten Liste, siehe mitKommentarzahl.
    videos: mitKommentarzahl(videos),
    posts: mitKommentarzahl(posts),
    clips: mitKommentarzahl(clips),
    communityChats,
    archiviert,
    hashtags, sounds, places, friends, gefolgt, ungelesen, blockiert, stummgeschaltet,
  });
});

/* ------------------------------------------------- Kontakteinstellungen */
/*
 * Was der Prototyp-Frame "MC + Kontakteinstellungen" anbietet: Medien,
 * markierte Nachrichten, gemeinsame Gruppen, Chat leeren, Favorit.
 */

/** Nachricht mit einem Stern markieren oder die Markierung wieder wegnehmen. */
/*
 * Chat verwalten: archivieren, stummschalten, gelesen, loeschen.
 *
 * Henrik wollte die WhatsApp-Optionen hinter langem Druecken. Ein Chat kann
 * aus dem Messenger oder aus dem Community-Bereich kommen - beide liegen in
 * eigenen Listen, deshalb wird hier zuerst gesucht, wo er steht.
 */
const archiviert = [];

function findeChat(chatId) {
  const imMessenger = chats.find((c) => c.id === chatId);
  if (imMessenger) return { chat: imMessenger, liste: chats };
  const imCommunity = communityChats.find((c) => c.id === chatId);
  if (imCommunity) return { chat: imCommunity, liste: communityChats };
  return null;
}

/*
 * Diese Route ist bewusst eng gefasst. `:was` wuerde sonst auch /accept
 * und alles andere unter /api/chats/... abfangen, was spaeter im Code
 * steht - Express nimmt die erste passende Route. Unbekanntes geht
 * deshalb mit next() weiter an die naechste.
 */
const CHAT_AKTIONEN = ['archiv', 'stumm', 'gelesen', 'loeschen', 'sperren', 'mitteilungen', 'blockieren'];

app.post('/api/chats/:chatId/:was', (req, res, next) => {
  if (!CHAT_AKTIONEN.includes(req.params.was)) return next();

  const treffer = findeChat(req.params.chatId);
  if (!treffer) return res.json({ ok: false, error: 'Diesen Chat gibt es nicht' });

  const { chat, liste } = treffer;
  const { was } = req.params;

  if (was === 'archiv') {
    const drin = archiviert.indexOf(chat.id);
    if (drin === -1) archiviert.push(chat.id);
    else archiviert.splice(drin, 1);
    return res.json({
      ok: true,
      archiviert: drin === -1,
      meldung: drin === -1 ? `„${chat.name}" archiviert` : `„${chat.name}" ist wieder in der Liste`,
    });
  }

  if (was === 'stumm') {
    chat.muted = !chat.muted;
    return res.json({
      ok: true,
      muted: chat.muted,
      meldung: chat.muted ? `„${chat.name}" stummgeschaltet` : `„${chat.name}" ist nicht mehr stumm`,
    });
  }

  if (was === 'gelesen') {
    // Ohne Gegenstueck waere "als ungelesen markieren" nicht rueckgaengig zu
    // machen - deshalb schaltet derselbe Punkt in beide Richtungen.
    chat.unread = chat.unread ? 0 : 1;
    return res.json({
      ok: true,
      unread: chat.unread,
      meldung: chat.unread ? 'Als ungelesen markiert' : 'Als gelesen markiert',
    });
  }

  /*
   * Chat sperren. Henrik hat am 26.08.2026 gemeldet, dass die Einstellungen
   * der Kontaktinfo "nicht funktionsfähig" sind und "Chat sperren" darunter
   * ausdruecklich genannt.
   *
   * Was es hier heisst: ein gesperrter Chat zeigt in der Liste keine
   * Vorschau mehr, und vor dem Oeffnen wird nachgefragt. Ohne echte
   * Anmeldung mit Face ID oder Code ist das die ehrliche Fassung - eine
   * Abfrage, die nichts prueft, waere Theater.
   */
  if (was === 'sperren') {
    chat.gesperrt = !chat.gesperrt;
    return res.json({
      ok: true,
      gesperrt: chat.gesperrt,
      meldung: chat.gesperrt ? `„${chat.name}" ist gesperrt` : `„${chat.name}" ist wieder offen`,
    });
  }

  if (was === 'mitteilungen') {
    // Getrennt von "stumm": stumm schaltet nur den Ton, hier gehen die
    // Mitteilungen zu diesem Chat ganz aus.
    chat.mitteilungenAus = !chat.mitteilungenAus;
    return res.json({
      ok: true,
      aus: chat.mitteilungenAus,
      meldung: chat.mitteilungenAus
        ? `Keine Mitteilungen mehr aus „${chat.name}"`
        : `Mitteilungen aus „${chat.name}" wieder an`,
    });
  }

  /*
   * Blockieren hat Folgen: der Chat nimmt keine Nachrichten mehr an (siehe
   * POST /api/messages/:chatId, das `blocked` bereits abfragt) und das
   * Profil merkt es sich. Vorher wurde die Person nur in eine Liste im
   * Browser geschoben, die niemand ausgewertet hat.
   */
  if (was === 'blockieren') {
    chat.blocked = !chat.blocked;
    if (chat.userId && profiles[chat.userId]) profiles[chat.userId].blocked = chat.blocked;
    return res.json({
      ok: true,
      blocked: chat.blocked,
      meldung: chat.blocked ? `„${chat.name}" blockiert` : `„${chat.name}" nicht mehr blockiert`,
    });
  }

  if (was === 'loeschen') {
    const stelle = liste.indexOf(chat);
    if (stelle !== -1) liste.splice(stelle, 1);
    // Die Nachrichten gehen mit - sonst taucht der Verlauf wieder auf,
    // sobald jemand denselben Chat neu anlegt.
    delete nachrichtenSpeicher(chat.id)[chat.id];
    return res.json({ ok: true, meldung: `„${chat.name}" gelöscht` });
  }

  // Hierher kommt nichts mehr: CHAT_AKTIONEN oben filtert bereits.
  return next();
});

/*
 * Einen Chat melden. Der Grund wird mitgeschickt und am Profil vermerkt -
 * vorher gab der Knopf nur einen Hinweis aus und vergass ihn sofort.
 */
app.post('/api/chats/:chatId/melden', (req, res) => {
  const treffer = findeChat(req.params.chatId);
  if (!treffer) return res.json({ ok: false, error: 'Diesen Chat gibt es nicht' });

  const grund = String(req.body?.grund || '').trim();
  if (!grund) return res.json({ ok: false, error: 'Bitte einen Grund angeben' });

  const { chat } = treffer;
  if (chat.userId && profiles[chat.userId]) profiles[chat.userId].gemeldet = grund;
  res.json({ ok: true, grund, meldung: 'Danke, die Meldung ist bei uns angekommen' });
});

app.post('/api/messages/:chatId/:messageId/stern', (req, res) => {
  const store = nachrichtenSpeicher(req.params.chatId);
  const nachricht = (store[req.params.chatId] || []).find((m) => m.id === req.params.messageId);
  if (!nachricht) return res.json({ ok: false, error: 'Diese Nachricht gibt es nicht' });

  nachricht.stern = !nachricht.stern;
  res.json({ ok: true, stern: nachricht.stern, id: nachricht.id });
});

/** Alles, was in diesem Chat an Medien und Weitergeleitetem liegt. */
app.get('/api/chats/:chatId/medien', (req, res) => {
  const store = nachrichtenSpeicher(req.params.chatId);
  const alle = store[req.params.chatId] || [];

  res.json({
    medien: alle.filter((m) => m.media || m.geteilt || m.standort || m.kontakt),
    markiert: alle.filter((m) => m.stern),
    gesamt: alle.length,
  });
});

/** Chat leeren - die Unterhaltung bleibt, die Nachrichten sind weg. */
app.post('/api/chats/:chatId/leeren', (req, res) => {
  const store = nachrichtenSpeicher(req.params.chatId);
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
    /*
     * Auch nach `ort` suchen, nicht nur nach Kennung und Name.
     *
     * An einem Beitrag steht "Hamburg", der Standort heisst aber
     * "Hamburger Hafen" und traegt "Hamburg" nur im Feld `ort`. Seit der
     * Standort am Beitrag anklickbar ist, kommt genau dieser Wert hier an -
     * vorher fuehrte der Weg nur ueber die Suche, wo der volle Name steht.
     */
    const platz =
      places.find((p) => p.id === wert || p.name === wert) ||
      places.find((p) => p.ort === wert);
    if (!platz) return res.json({ ok: false, error: 'Diesen Standort gibt es nicht' });
    passt = (e) => e.location === platz.ort;
    // `id` gehoert dazu: die Fotoseite braucht sie, um von dort wieder
    // hierher zurueckzufinden.
    kopf = { art, id: platz.id, titel: platz.name, anzahl: platz.posts, adresse: platz.adresse, koordinaten: platz.koordinaten, x: platz.x, y: platz.y };
  } else if (art === 'sound') {
    /*
     * An einem Beitrag steht "Golden Hour – Lys", der Sound heisst aber nur
     * "Golden Hour" - der Teil hinter dem Gedankenstrich ist der Interpret.
     * Deshalb wird der vordere Teil abgetrennt, bevor gesucht wird.
     *
     * "Originalton" ist kein Eintrag in der Liste und faellt bewusst in die
     * Fehlermeldung: dahinter steckt keine Seite.
     */
    const titelTeil = wert.split(/\s+[–—-]\s+/)[0].trim();
    const sound =
      sounds.find((s) => s.id === wert || s.title === wert) ||
      sounds.find((s) => s.title === titelTeil);
    if (!sound) {
      return res.json({
        ok: false,
        error: wert === 'Originalton' ? 'Originalton hat keine eigene Seite' : 'Diesen Sound gibt es nicht',
      });
    }
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
      art: 'standard',
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

/*
 * Eigenes Profil bearbeiten - Henrik: "Profilbild, Name, Info/Bio, Link usw.
 * ueber eine Bearbeitungseinstellung aendern koennen."
 *
 * Name und Kuerzel stehen in `users`, Bio und Link in `profiles`. Beides
 * wird hier zusammen gepflegt, damit der Aufrufer nur einen Weg kennen muss.
 *
 * Das Profilbild selbst bleibt im Browser: der Server teilt seinen Speicher
 * mit allen Besuchern, dort hat ein privates Foto nichts zu suchen. Hier
 * steht nur die Farbe, die als Ersatzbild dient.
 */
app.post('/api/eigene/profil', (req, res) => {
  const { name, bio, link, color } = req.body || {};

  if (name !== undefined) {
    const sauber = String(name).trim();
    if (!sauber) return res.json({ ok: false, error: 'Der Name darf nicht leer sein' });
    if (sauber.length > 40) return res.json({ ok: false, error: 'Der Name ist zu lang (hoechstens 40 Zeichen)' });
    users.me.name = sauber;
    // Kuerzel aus den Anfangsbuchstaben, hoechstens zwei.
    users.me.initials = sauber
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  if (bio !== undefined) {
    const sauber = String(bio).trim();
    if (sauber.length > 150) return res.json({ ok: false, error: 'Die Info ist zu lang (hoechstens 150 Zeichen)' });
    profiles.me.bio = sauber;
  }

  if (link !== undefined) {
    profiles.me.link = String(link).trim();
  }

  // Erlaubt ist eine einzelne Farbe oder ein Zwei-Ton-Verlauf. Der Wert landet
  // ungefiltert in einem style-Attribut, deshalb wird er hier eng geprueft und
  // nicht nur auf Laenge.
  const istFarbe = /^#[0-9a-fA-F]{6}$/.test(String(color));
  const istVerlauf = /^linear-gradient\(135deg,#[0-9a-fA-F]{6},#[0-9a-fA-F]{6}\)$/.test(String(color));
  if (color !== undefined && (istFarbe || istVerlauf)) {
    users.me.color = color;
  }

  res.json({
    ok: true,
    profil: {
      name: users.me.name,
      initials: users.me.initials,
      color: users.me.color,
      bio: profiles.me.bio,
      link: profiles.me.link,
    },
  });
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
  if (!titel) return res.json({ ok: false, error: 'Bitte einen Titel eingeben' });

  /*
   * Punkt 44: das Ziel ist freiwillig. Nicht jede Sammlung laeuft auf einen
   * Betrag zu - manche laufen einfach. Steht keiner da, gilt 0; die Anzeige
   * zeigt dann den gesammelten Betrag ohne Balken.
   *
   * Eine unsinnige Eingabe (Text, negative Zahl) wird weiterhin abgelehnt -
   * freiwillig heisst nicht beliebig.
   */
  const roh = String(req.body?.ziel ?? '').trim();
  let ziel = 0;
  if (roh) {
    ziel = Number(roh.replace(',', '.'));
    if (!Number.isFinite(ziel) || ziel <= 0) {
      return res.json({ ok: false, error: 'Das Spendenziel muss eine Zahl über null sein' });
    }
  }

  profiles.me.spende = { titel, ziel, gesammelt: 0, text: String(req.body?.text || '').trim() };
  res.json({ ok: true, spende: profiles.me.spende });
});

/*
 * Einen eigenen Beitrag oder ein eigenes Video loeschen.
 *
 * Henrik am 26.08.2026, Punkt 37: "Eigene Beiträge können nicht gelöscht
 * werden." Und Punkt 46 fuer die Livestream-Aufzeichnung, die als
 * Querformat-Video im Profil liegt.
 *
 * Nur eigene Inhalte - alles andere gehoert jemand anderem.
 */
app.post('/api/eigene/:id/loeschen', (req, res) => {
  const id = req.params.id;

  const imRaster = gridItems.me.some((g) => g.id === id);

  /*
   * Zwei Faelle. Selbst veroeffentlichte Beitraege stehen in posts, videos
   * oder clips - die kommen dort raus. Die Kacheln, mit denen das Profil von
   * Anfang an gefuellt ist (me_g0 …), stehen nur im Raster; sie sind
   * trotzdem eigene Inhalte und muessen sich genauso loeschen lassen. Ohne
   * diesen zweiten Fall waere "Löschen" auf zwoelf von zwoelf Kacheln
   * wirkungslos gewesen.
   */
  for (const liste of [posts, videos, clips]) {
    const stelle = liste.findIndex((e) => e.id === id);
    if (stelle === -1) continue;
    if (liste[stelle].userId !== 'me') {
      return res.json({ ok: false, error: 'Das ist nicht dein Beitrag' });
    }
    liste.splice(stelle, 1);
    gridItems.me = gridItems.me.filter((g) => g.id !== id);
    if (liste === posts) profiles.me.posts = Math.max(0, profiles.me.posts - 1);
    return res.json({ ok: true, meldung: 'Gelöscht' });
  }

  if (imRaster) {
    gridItems.me = gridItems.me.filter((g) => g.id !== id);
    profiles.me.posts = Math.max(0, profiles.me.posts - 1);
    return res.json({ ok: true, meldung: 'Gelöscht' });
  }

  res.json({ ok: false, error: 'Das gibt es nicht mehr' });
});

/*
 * Einen eigenen Beitrag in eine Playlist oder ein Highlight legen.
 * Punkt 40: "Keine Möglichkeit, Inhalte zu Playlists/Highlights
 * hinzuzufügen."
 */
app.post('/api/eigene/:id/sammlung', (req, res) => {
  const id = req.params.id;
  const name = String(req.body?.name || '').trim();
  const art = req.body?.art === 'highlight' ? 'highlights' : 'playlists';
  if (!name) return res.json({ ok: false, error: 'Bitte eine Sammlung wählen' });

  profiles.me.sammlungen = profiles.me.sammlungen || {};
  const schluessel = `${art}:${name}`;
  const drin = profiles.me.sammlungen[schluessel] || [];
  if (drin.includes(id)) return res.json({ ok: false, error: `Steht schon in „${name}"` });

  profiles.me.sammlungen[schluessel] = [...drin, id];
  res.json({ ok: true, meldung: `Zu „${name}" hinzugefügt` });
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
    // Die Aufzeichnung ist ein normales Video, kein laufender Stream -
    // sie gehoert unter "Standard", nicht unter "Live".
    art: 'standard',
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

/*
 * Nachrichten eines Chats. Der Aufrufer muss nicht wissen, aus welchem
 * Bereich der Chat kommt - hier wird nachgesehen, wo er liegt.
 */
function nachrichtenSpeicher(chatId) {
  if (communityChatMessages[chatId]) return communityChatMessages;
  if (communityMessages[chatId]) return communityMessages;
  return messages;
}

app.get('/api/messages/:chatId', (req, res) => {
  res.json(nachrichtenSpeicher(req.params.chatId)[req.params.chatId] || []);
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

  const store = nachrichtenSpeicher(chatId);
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

  const store = nachrichtenSpeicher(chatId);
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

/*
 * Neues Unterthema in einer Community anlegen.
 * Prototyp-Frame "CH + Unterthema erstellen" - auf der Kanalseite gab es
 * dafuer bis zum 26.08.2026 keinen Weg.
 */
app.post('/api/communities/:id/channels', (req, res) => {
  const community = communities.find((c) => c.id === req.params.id);
  if (!community) return res.status(404).json({ ok: false, error: 'Nicht gefunden' });

  const name = String(req.body?.name || '').trim();
  if (!name) return res.json({ ok: false, error: 'Bitte einen Namen eingeben' });

  const schon = community.channels.some(
    (chId) => (communityChannels[chId]?.name || '').toLowerCase() === name.toLowerCase()
  );
  if (schon) return res.json({ ok: false, error: 'Dieses Unterthema gibt es schon' });

  const id = 'ch-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
  communityChannels[id] = { name, topics: [] };
  community.channels.push(id);
  res.json({ ok: true, id, name });
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
