const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const users = {
  u1: { id: 'u1', name: 'Anna Schmidt', initials: 'AS', color: '#F2A65A' },
  u2: { id: 'u2', name: 'Bob Müller', initials: 'BM', color: '#6C8AE4' },
  u3: { id: 'u3', name: 'Clara Weber', initials: 'CW', color: '#E4699B' },
  u4: { id: 'u4', name: 'David König', initials: 'DK', color: '#4DB6AC' },
  u5: { id: 'u5', name: 'Elif Yilmaz', initials: 'EY', color: '#9575CD' },
  u6: { id: 'u6', name: 'Finn Bauer', initials: 'FB', color: '#7986CB' },
  me: { id: 'me', name: 'Du', initials: 'DU', color: '#0A66FF' },
};

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
  { id: 's0', userId: 'me', name: 'Deine Story', own: true, viewed: false },
  { id: 's1', userId: 'u1', name: 'Anna', viewed: false },
  { id: 's2', userId: 'u2', name: 'Bob', viewed: false },
  { id: 's3', userId: 'u3', name: 'Clara', viewed: false },
  { id: 's4', userId: 'u4', name: 'David', viewed: true },
  { id: 's5', userId: 'u5', name: 'Elif', viewed: true },
  { id: 's6', userId: 'u6', name: 'Finn', viewed: true },
];

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
  { id: 'p1', userId: 'u3', location: 'Hamburg', music: 'Golden Hour – Lys', description: 'Der Hafen um sechs Uhr morgens. Ganz ohne Menschen.', likedBy: 'Anna Schmidt', likes: 342, comments: 27, liked: false, saved: false, following: true, notify: false },
  { id: 'p2', userId: 'u5', location: 'Köln', music: 'Originalton', description: 'Neues Setup steht. Zwei Monitore waren doch die richtige Entscheidung.', likedBy: 'Bob Müller', likes: 128, comments: 14, liked: true, saved: false, following: true, notify: true },
  { id: 'p3', userId: 'u1', location: 'Zugspitze', music: 'Ambient Sunrise – Nora K.', description: 'Oben angekommen. Der Aufstieg war jede Minute wert.', likedBy: 'David König', likes: 1204, comments: 96, liked: false, saved: true, following: false, notify: false },
  { id: 'p4', userId: 'u6', location: 'Berlin', music: 'Lo-Fi Focus – beatlab', description: 'Kleine Commits, klare Historie. Mein Team dankt es mir.', likedBy: 'Elif Yilmaz', likes: 87, comments: 9, liked: false, saved: false, following: true, notify: false },
];

const videos = [
  { id: 'v1', userId: 'u1', description: 'Sonnenaufgang über den Alpen. Vier Uhr aufstehen hat sich gelohnt.', location: 'Zugspitze', music: 'Ambient Sunrise – Nora K.', likes: 12400, comments: 218, shares: 96, liked: false, saved: false },
  { id: 'v2', userId: 'u4', description: 'So richtet ihr euer Home-Office in 60 Sekunden ein.', location: 'Köln', music: 'Lo-Fi Focus – beatlab', likes: 8210, comments: 143, shares: 61, liked: true, saved: true },
  { id: 'v3', userId: 'u5', description: 'Rezept: Pasta in 10 Minuten, ohne Sahne und trotzdem cremig.', location: 'Hamburg', music: 'Kitchen Groove – Milo', likes: 24800, comments: 512, shares: 340, liked: false, saved: false },
  { id: 'v4', userId: 'u2', description: 'Erster Laufversuch mit der neuen Kamera-Stabilisierung.', location: 'Rheinpark', music: 'Runner High – Aster', likes: 3140, comments: 74, shares: 22, liked: false, saved: false },
  { id: 'v5', userId: 'u6', description: 'Warum kleine Commits dein Leben leichter machen.', location: 'Berlin', music: 'Originalton', likes: 5670, comments: 189, shares: 118, liked: false, saved: false },
];

const communities = [
  { id: 'k1', name: 'Design Systeme', members: 1284, visibility: 'public', topic: 'Komponenten, Tokens, Figma', joined: true, unread: 3 },
  { id: 'k2', name: 'React Native DE', members: 842, visibility: 'public', topic: 'Expo, Navigation, Performance', joined: true, unread: 0 },
  { id: 'k3', name: 'Fotografie', members: 3120, visibility: 'public', topic: 'Licht, Komposition, Nachbearbeitung', joined: false, unread: 0 },
  { id: 'k4', name: 'Team Intern', members: 12, visibility: 'private', topic: 'Nur für das Kernteam', joined: true, unread: 5 },
  { id: 'k5', name: 'Laufgruppe Köln', members: 96, visibility: 'private', topic: 'Treffpunkte und Termine', joined: true, unread: 0 },
  { id: 'k6', name: 'Musikproduktion', members: 671, visibility: 'public', topic: 'Ableton, Mixing, Sounddesign', joined: false, unread: 0 },
];

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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/bootstrap', (req, res) => {
  res.json({ users, chats, stories, contacts, communities, videos, posts });
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

app.post('/api/chats/:chatId/read', (req, res) => {
  const chat = chats.find((c) => c.id === req.params.chatId);
  if (chat) chat.unread = 0;
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n  All Media läuft auf http://localhost:${PORT}\n`);
});
