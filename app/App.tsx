import React, { useEffect, useCallback, useContext, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext, AuthProvider } from './contexts/AuthContext';
import { ThemeContext, ThemeProvider } from './contexts/ThemeContext';
import { SupabaseProvider } from './contexts/SupabaseContext';
import { RepostProvider } from './contexts/RepostContext';
import { ProfilProvider, useProfil } from './contexts/ProfilContext';
import { ActionSheet } from './components/ActionSheet';
import { AddContactSheet } from './components/AddContactSheet';
import { ErstellenSheet, ErstellenPunkt } from './components/ErstellenSheet';
import { FormularFeld, FormularSheet } from './components/FormularSheet';
import { MitteilungenSheet } from './components/MitteilungenSheet';
import { NewGroupSheet } from './components/NewGroupSheet';
import { TeilenSheet, TeilenZiel } from './components/TeilenSheet';
import { KontoWechsel } from './components/KontoWechsel';
import { TabBar } from './components/TabBar';
import { TopSwitcher } from './components/TopSwitcher';
import { Toast } from './components/Toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AreaKey, NAV, SubKey, defaultSub } from './constants/navigation';
import { LoginScreen } from './screens/LoginScreen';
import { ChatListScreen } from './screens/messenger/ChatListScreen';
import { ChatDetailScreen } from './screens/messenger/ChatDetailScreen';
import { ContactsScreen } from './screens/messenger/ContactsScreen';
import { ContactProfileScreen } from './screens/messenger/ContactProfileScreen';
import { FriendMapScreen } from './screens/messenger/FriendMapScreen';
import { MessengerProfileScreen } from './screens/messenger/MessengerProfileScreen';
import { StoryViewerScreen } from './screens/messenger/StoryViewerScreen';
import { CameraScreen } from './screens/messenger/CameraScreen';
import { CallScreen } from './screens/messenger/CallScreen';
import { CommunitiesScreen } from './screens/communities/CommunitiesScreen';
import { CommunityChatsScreen } from './screens/communities/CommunityChatsScreen';
import { CommunityProfileScreen } from './screens/communities/CommunityProfileScreen';
import { CommunitySearchScreen } from './screens/communities/CommunitySearchScreen';
import { VideoFeedScreen } from './screens/video/VideoFeedScreen';
import { LandscapeVideosScreen } from './screens/videos/LandscapeVideosScreen';
import { ClipPlayerScreen } from './screens/videos/ClipPlayerScreen';
import { ExplorerScreen, ExplorerZiel } from './screens/videos/ExplorerScreen';
import { LivestreamScreen } from './screens/videos/LivestreamScreen';
import { VideoProfileScreen } from './screens/videos/VideoProfileScreen';
import { VideoSearchScreen } from './screens/videos/VideoSearchScreen';
import { HomeFeedScreen } from './screens/home/HomeFeedScreen';
import { SettingsScreen } from './screens/profile/SettingsScreen';
import { UserProfileScreen } from './screens/profile/UserProfileScreen';
import { colors, themenStyles } from './constants/design';
import { aufnehmen } from './lib/aufnehmen';
import { mockChats, mockClips, mockContacts, mockMessages, mockPlaces, mockStories, mockUsers } from './mocks';
import { Chat, Community, Contact, Message, MitteilungsBereich, MitteilungsZiel, Post, Story, Video } from './types';

type Overlay =
  | { kind: 'chat'; chat: Chat; extra?: Message[] }
  | { kind: 'story'; story: Story }
  /**
   * variant entscheidet, welches Profil gezeigt wird: im Messenger das
   * Kontaktprofil (Nummer, Medien, Blockieren), sonst das oeffentliche
   * Profil mit Beitraegen.
   */
  | { kind: 'profile'; userId: string; variant: 'kontakt' | 'oeffentlich' }
  | { kind: 'contacts' }
  | { kind: 'camera' }
  | { kind: 'call'; userId?: string; gruppenName?: string; teilnehmer?: string[]; art: 'audio' | 'video' }
  | { kind: 'livestream' }
  | { kind: 'explorer'; ziel: ExplorerZiel }
  | { kind: 'clip'; clipId: string }
  | null;

type Sheet = 'new' | 'group' | 'contact' | 'konto' | 'mitteilungen' | 'erstellen' | null;

/** Ein offenes Formular-Blatt aus dem Erstellen-Menü. */
interface Formular {
  title: string;
  felder: FormularFeld[];
  knopf: string;
  absenden: (werte: Record<string, string>) => string | null;
}

const now = () => new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

const Shell = () => {
  const { logout } = useContext(AuthContext);
  const { isDark } = useContext(ThemeContext);

  // Jeder Bereich merkt sich seinen zuletzt offenen Unterpunkt — genau wie im
  // Prototyp, wo die obere Leiste zum Bereich gehoert.
  const [area, setArea] = useState<AreaKey>('messenger');
  const [subs, setSubs] = useState<Record<AreaKey, SubKey>>(defaultSub);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>(mockChats);
  const [contacts, setContacts] = useState<Contact[]>(mockContacts);
  // Storys liegen in der Shell, damit die eigene Aufnahme in der Leiste
  // ankommt - vorher las jeder Bildschirm direkt die Mock-Daten.
  const [stories, setStories] = useState<Story[]>(mockStories);

  // Die drei Knoepfe oben rechts im eigenen Profil gehoeren zu genau einem
  // Bereich - Videos oder Communitys. Beide haben eigene Mitteilungen und ein
  // eigenes Erstellen-Menue, so wie im Prototyp.
  const [profilBereich, setProfilBereich] = useState<MitteilungsBereich>('videos');
  const [formular, setFormular] = useState<Formular | null>(null);
  /** Abschnitt, bei dem die Einstellungen aufgehen sollen. */
  const [settingsSprung, setSettingsSprung] = useState<string | null>(null);
  const [teilenZiel, setTeilenZiel] = useState<TeilenZiel | null>(null);
  /*
   * Weitergeleitete Beitraege. Sie muessen die Shell ueberleben: der Chat
   * baut seine Nachrichten beim Oeffnen neu auf, ein Beitrag, den man vorher
   * geteilt hat, waere sonst wieder weg.
   */
  const [extraNachrichten, setExtraNachrichten] = useState<Record<string, Message[]>>({});
  const profil = useProfil();

  const sub = subs[area];
  const setSub = (next: SubKey) => setSubs((prev) => ({ ...prev, [area]: next }));

  /*
   * Prüf-Schalter: beim Start auf einen bestimmten Bildschirm springen.
   *
   * Warum es das gibt: die rund 108 Prüfungen des Projekts laufen alle gegen
   * die Website. Für die App gab es nur `tsc` und den Metro-Bau — beide sagen
   * nichts darüber, wie ein Bildschirm aussieht. Genau deshalb ist am
   * 26.08.2026 ein falscher Avatar in der Story-Leiste durchgerutscht.
   *
   * `tools/app-bilder.js` schreibt hier einen Bereich hinein, startet die App
   * neu und legt ein Bild ab. Ohne diesen Schalter käme man im Simulator nie
   * über den ersten Bildschirm hinaus, weil sich ein Tippen von außen nicht
   * auslösen lässt.
   *
   * Format:  bereich/unterpunkt[#überlagerung:parameter]
   *
   *   messenger/chats              die Chatliste
   *   messenger/chats#chat:c1      ein offener Chat darin
   *   videos/profile#profil:u1     ein fremdes Profil
   *
   * Der Teil hinter der Raute kam später dazu: die vierzehn Bereiche allein
   * decken keinen einzigen Detailbildschirm ab. Ein Chat, ein Story-Betrachter
   * und ein fremdes Profil sind aber genau die Bildschirme, auf denen ein
   * Nutzer die meiste Zeit verbringt — und die einzigen, für die es bis dahin
   * kein Bild gab. Ein Fehler an einer Sprechblase wäre nie aufgefallen.
   *
   * `__DEV__` ist in einem veröffentlichten Build false — der Schalter
   * existiert dort also nicht, und der Schlüssel wird nie gelesen.
   */
  useEffect(() => {
    if (!__DEV__) return;
    AsyncStorage.getItem('all-media.pruefbild')
      .then((roh) => {
        if (!roh) return;
        const [pfad, ueberlagerung] = roh.split('#');
        const [zielArea, zielSub] = pfad.split('/') as [AreaKey, SubKey | undefined];
        if (!NAV.some((a) => a.key === zielArea)) return;
        setArea(zielArea);
        if (zielSub) setSubs((prev) => ({ ...prev, [zielArea]: zielSub }));
        if (ueberlagerung) pruefUeberlagerung(ueberlagerung);
      })
      .catch(() => {
        // Kein Schalter gesetzt oder Speicher nicht lesbar: normal starten.
      });
  }, []);

  /**
   * Den Teil hinter der Raute in eine Überlagerung übersetzen. Bewusst
   * nachsichtig: eine unbekannte Angabe lässt schlicht den Grundbildschirm
   * stehen, statt die App beim Start abstürzen zu lassen.
   */
  const pruefUeberlagerung = (angabe: string) => {
    const [art, a, b] = angabe.split(':');
    switch (art) {
      case 'chat': {
        const chat = mockChats.find((c) => c.id === a);
        if (chat) setOverlay({ kind: 'chat', chat, extra: [] });
        break;
      }
      case 'story': {
        const story = mockStories.find((s) => s.id === a);
        if (story) setOverlay({ kind: 'story', story });
        break;
      }
      case 'profil':
        if (mockUsers[a]) setOverlay({ kind: 'profile', userId: a, variant: 'oeffentlich' });
        break;
      case 'kontakt':
        if (mockUsers[a]) setOverlay({ kind: 'profile', userId: a, variant: 'kontakt' });
        break;
      case 'kontakte':
        setOverlay({ kind: 'contacts' });
        break;
      case 'anruf':
        if (mockUsers[a]) setOverlay({ kind: 'call', userId: a, art: b === 'video' ? 'video' : 'audio' });
        break;
      case 'clip':
        if (mockClips.some((c) => c.id === a)) setOverlay({ kind: 'clip', clipId: a });
        break;
      case 'blatt':
        if (['new', 'group', 'contact', 'konto', 'mitteilungen', 'erstellen'].includes(a)) {
          setSheet(a as Sheet);
        }
        break;
    }
  };

  const unreadCount = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);
  const hideNotice = useCallback(() => setNotice(null), []);

  /** Alle Nachrichten eines Chats - fuer Medien, Markiertes und die Suche. */
  const nachrichtenVon = (chatId?: string): Message[] =>
    chatId ? [...(mockMessages[chatId] ?? []), ...(extraNachrichten[chatId] ?? [])] : [];

  /** Chat oeffnen und dabei alles mitgeben, was frueher hineingeteilt wurde. */
  const oeffneChat = (chat: Chat, zusatz?: Message[]) =>
    setOverlay({ kind: 'chat', chat, extra: [...(extraNachrichten[chat.id] ?? []), ...(zusatz ?? [])] });

  const openChatWith = (userId: string) => {
    const chat = chats.find((c) => c.userId === userId);
    if (chat) oeffneChat(chat);
    else setNotice('Noch kein Chat mit dieser Person');
  };

  /** Beitrag oder Video in den Chat mit dieser Person legen. */
  const teileMit = (userId: string, ziel: TeilenZiel) => {
    const person = mockUsers[userId];
    let chat = chats.find((c) => !c.isGroup && c.userId === userId);
    const vorschau = ziel.art === 'video' ? 'Video geteilt' : 'Beitrag geteilt';

    if (!chat) {
      chat = {
        id: `c${Date.now()}`,
        name: person.name,
        userId,
        isGroup: false,
        preview: vorschau,
        time: now(),
        unreadCount: 0,
      };
      setChats((prev) => [chat as Chat, ...prev]);
    } else {
      const id = chat.id;
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, preview: vorschau, time: now() } : c)));
    }

    const nachricht: Message = {
      id: `m${Date.now()}`,
      chatId: chat.id,
      senderId: 'me',
      text: vorschau,
      time: now(),
      geteilt: ziel,
    };
    setExtraNachrichten((prev) => ({ ...prev, [chat!.id]: [...(prev[chat!.id] ?? []), nachricht] }));
    profil.geteilt(ziel.id);
    setNotice(`An ${person.name} gesendet`);
  };

  const createGroup = (name: string, memberIds: string[], info?: string) => {
    const chat: Chat = {
      id: `c${Date.now()}`,
      name,
      isGroup: true,
      memberIds,
      preview: info ? info : 'Gruppe erstellt',
      time: now(),
      unreadCount: 0,
    };
    setChats((prev) => [chat, ...prev]);
    setSheet(null);
    setNotice(`Gruppe „${name}“ erstellt`);
    oeffneChat(chat);
  };

  /**
   * Kontaktanfrage. Bis zur Annahme ist genau die eine mitgeschickte Nachricht
   * erlaubt - der Chat dazu wird gleich angelegt und als 'pending' markiert.
   */
  const addContact = (contact: Contact, ersteNachricht?: string) => {
    setContacts((prev) => [...prev, contact]);
    setSheet(null);

    const chat: Chat = {
      id: `c${Date.now()}`,
      name: contact.name,
      userId: contact.id,
      isGroup: false,
      preview: ersteNachricht ?? 'Anfrage gesendet',
      time: now(),
      unreadCount: 0,
      requestState: 'pending',
    };
    setChats((prev) => [chat, ...prev]);

    if (ersteNachricht) {
      const message: Message = {
        id: `m${Date.now()}`,
        chatId: chat.id,
        senderId: 'me',
        text: ersteNachricht,
        time: now(),
      };
      oeffneChat(chat, [message]);
    }
  };

  /** Anfrage angenommen: der Chat ist ab jetzt frei benutzbar. */
  const acceptRequest = (chatId: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, requestState: 'accepted' as const } : c))
    );
    setOverlay((prev) =>
      prev?.kind === 'chat' && prev.chat.id === chatId
        ? { ...prev, chat: { ...prev.chat, requestState: 'accepted' as const } }
        : prev
    );
    setContacts((prev) =>
      prev.map((c) => {
        const chat = chats.find((x) => x.id === chatId);
        return chat && c.id === chat.userId
          ? { ...c, status: 'friend' as const, about: 'Kontakt' }
          : c;
      })
    );
    setNotice('Anfrage angenommen');
  };

  const befriend = (userId: string) => {
    const person = mockUsers[userId];
    if (contacts.some((c) => c.id === userId)) return setNotice(`${person.name} ist bereits in deinen Kontakten`);
    setContacts((prev) => [...prev, { id: userId, name: person.name, status: 'pending', about: 'Anfrage gesendet' }]);
    setNotice(`Anfrage an ${person.name} gesendet`);
  };

  // Aus dem Messenger heraus gehoert das Kontaktprofil dazu - Henrik wurde
  // vorher aus einem Chat heraus im Bereich Videos abgesetzt.
  const openProfile = (userId: string) =>
    setOverlay({ kind: 'profile', userId, variant: area === 'messenger' ? 'kontakt' : 'oeffentlich' });

  /** Ausdruecklich das oeffentliche Profil, unabhaengig vom Bereich. */
  const openPublicProfile = (userId: string) =>
    setOverlay({ kind: 'profile', userId, variant: 'oeffentlich' });

  const openStory = (story: Story) => {
    // Eigene Story: noch leer -> aufnehmen, sonst ansehen.
    if (story.own && !story.mediaUri) return setOverlay({ kind: 'camera' });
    setOverlay({ kind: 'story', story });
  };

  /** Aufnahme aus der Kamera landet in der eigenen Story. */
  const storyAufgenommen = (uri: string) => {
    setStories((prev) =>
      prev.map((s) =>
        s.own
          ? { ...s, mediaUri: uri, aufgenommen: Date.now(), viewed: false, name: 'Deine Story' }
          : s
      )
    );
    setOverlay(null);
    setNotice('Deine Story ist online');
  };

  // Antwort auf eine Story: sie landet im Chat mit dieser Person, und der Chat
  // oeffnet sich direkt — sonst waere die Antwort nirgends zu sehen.
  const replyToStory = (story: Story, text: string) => {
    const person = mockUsers[story.userId];
    let chat = chats.find((c) => !c.isGroup && c.userId === story.userId);

    if (!chat) {
      chat = {
        id: `c${Date.now()}`,
        name: person.name,
        userId: story.userId,
        isGroup: false,
        preview: text,
        time: now(),
        unreadCount: 0,
      };
      setChats((prev) => [chat as Chat, ...prev]);
    } else {
      const id = chat.id;
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, preview: text, time: now() } : c)));
    }

    const message: Message = {
      id: `m${Date.now()}`,
      chatId: chat.id,
      senderId: 'me',
      text,
      time: now(),
    };

    setNotice(`Antwort an ${person.name} gesendet`);
    oeffneChat(chat, [message]);
  };

  const openCommunity = (community: Community) => {
    oeffneChat({
      id: community.id,
      name: community.name,
      isGroup: true,
      memberIds: new Array(Math.max(community.members - 1, 0)).fill(''),
      preview: community.topic,
      time: '',
      unreadCount: 0,
    });
  };

  /* ---------------- Glocke, Plus und Menü im eigenen Profil -------------- */
  /*
   * Prototyp-Frames "VP + Mitteilung / erstellen / Einstellung" und die
   * Gegenstuecke "CP + ...". Das Menue springt in die Einstellungen zum
   * passenden Abschnitt - die Punkte stehen dort schon, eine zweite Liste
   * waere nur auseinandergelaufen.
   */
  const profilAktion = (key: string) => {
    const bereich: MitteilungsBereich = area === 'communities' ? 'communities' : 'videos';
    setProfilBereich(bereich);

    if (key === 'bell') return setSheet('mitteilungen');
    if (key === 'create') return setSheet('erstellen');
    setSettingsSprung(bereich === 'communities' ? 'communitys' : 'videos');
    setArea('settings');
  };

  /*
   * "Profil bearbeiten" fuehrt in die Einstellungen zum Abschnitt Konto -
   * dort steht das Formular, das Name, Info und Link wirklich aendert.
   * Ein eigenes Blatt im Profil waere ein zweites Formular fuer dieselben
   * Felder; so gibt es nur eine Stelle, an der sich das Profil aendert.
   */
  const profilBearbeiten = () => {
    setSettingsSprung('konto');
    setArea('settings');
  };

  /** Eine Mitteilung fuehrt dorthin, wo sie herkommt. */
  const mitteilungOeffnen = (ziel: MitteilungsZiel) => {
    if (ziel.art === 'profile') return openPublicProfile(ziel.id);
    if (ziel.art === 'community') {
      const community = profil.communities.find((c) => c.id === ziel.id);
      return community ? openCommunity(community) : setNotice('Diesen Kanal gibt es nicht mehr');
    }
    setArea('videos');
    setSubs((prev) => ({ ...prev, videos: ziel.art === 'post' ? 'home' : 'portrait' }));
  };

  const erstelle = async (punkt: ErstellenPunkt) => {
    setSheet(null);

    if (punkt === 'story') return setOverlay({ kind: 'camera' });
    if (punkt === 'livestream') return setOverlay({ kind: 'livestream' });

    if (punkt === 'highlight' || punkt === 'playlist') {
      const istHighlight = punkt === 'highlight';
      return setFormular({
        title: istHighlight ? 'Neues Highlight' : 'Neue Playlist',
        knopf: 'Anlegen',
        felder: [
          {
            key: 'name',
            label: 'Name',
            platzhalter: istHighlight ? 'z. B. Sommer' : 'z. B. Beste Clips',
            pflicht: true,
          },
        ],
        absenden: ({ name }) => {
          const fehler = istHighlight ? profil.highlightAnlegen(name) : profil.playlistAnlegen(name);
          if (fehler) return fehler;
          setNotice(`„${name}“ angelegt`);
          return null;
        },
      });
    }

    if (punkt === 'spende') {
      return setFormular({
        title: 'Spendenaktion',
        knopf: 'Starten',
        felder: [
          { key: 'titel', label: 'Wofür sammelst du?', platzhalter: 'z. B. Bäume für den Stadtpark', pflicht: true },
          { key: 'ziel', label: 'Spendenziel in Euro', typ: 'zahl', platzhalter: '500', pflicht: true },
          { key: 'text', label: 'Beschreibung (freiwillig)', typ: 'mehrzeilig', platzhalter: 'Worum geht es?' },
        ],
        absenden: ({ titel, ziel, text }) => {
          const betrag = Number(ziel.replace(',', '.'));
          if (!Number.isFinite(betrag) || betrag <= 0) return 'Bitte ein Spendenziel in Euro eingeben';
          profil.spendeSetzen({ titel, ziel: betrag, gesammelt: 0, text });
          setNotice('Spendenaktion läuft');
          return null;
        },
      });
    }

    if (punkt === 'kanal') {
      return setFormular({
        title: 'Neuen Kanal erstellen',
        knopf: 'Erstellen',
        felder: [
          { key: 'name', label: 'Name des Kanals', platzhalter: 'z. B. Ankündigungen', pflicht: true },
          { key: 'thema', label: 'Worum geht es?', platzhalter: 'Kurz beschrieben', pflicht: true },
        ],
        absenden: ({ name, thema }) => {
          const fehler = profil.kanalAnlegen(name, thema);
          if (fehler) return fehler;
          setNotice(`„${name}“ erstellt`);
          return null;
        },
      });
    }

    // Beitrag, Reels und Querformat: erst aufnehmen, dann beschreiben.
    const istBild = punkt === 'post';
    const uri = await aufnehmen(istBild ? 'photo' : 'video', setNotice);
    if (!uri) return;

    const quer = punkt === 'landscape';
    setFormular({
      title: { post: 'Neuer Beitrag', reels: 'Neues Reel', landscape: 'Neues Querformat-Video' }[
        punkt as 'post' | 'reels' | 'landscape'
      ],
      knopf: 'Veröffentlichen',
      felder: [
        { key: 'beschreibung', label: quer ? 'Titel' : 'Beschreibung', typ: quer ? 'text' : 'mehrzeilig', pflicht: true },
        { key: 'ort', label: 'Ort (freiwillig)', platzhalter: 'z. B. Köln' },
      ],
      absenden: ({ beschreibung, ort }) => {
        if (istBild) profil.beitragAnlegen({ beschreibung, ort, mediaUri: uri });
        else profil.videoAnlegen({ beschreibung, ort, quer, mediaUri: uri });

        // Gleich dorthin, wo das Neue jetzt steht.
        setArea('videos');
        setSubs((prev) => ({ ...prev, videos: istBild ? 'home' : quer ? 'landscape' : 'portrait' }));
        setNotice(istBild ? 'Beitrag veröffentlicht' : 'Video veröffentlicht');
        return null;
      },
    });
  };

  const teileBeitrag = (post: Post) =>
    setTeilenZiel({
      art: 'post',
      id: post.id,
      titel: post.description,
      autor: mockUsers[post.userId]?.name ?? 'Unbekannt',
    });

  const teileVideo = (video: Video) =>
    setTeilenZiel({
      art: 'video',
      id: video.id,
      titel: video.description,
      autor: mockUsers[video.userId]?.name ?? 'Unbekannt',
    });

  const switchArea = (next: AreaKey) => {
    setArea(next);
    setSubs((prev) => ({ ...prev, [next]: 'profile' as SubKey }));
  };

  if (overlay?.kind === 'chat') {
    return (
      <ChatDetailScreen
        chat={overlay.chat}
        extraMessages={overlay.extra}
        onBack={() => setOverlay(null)}
        onCall={(art) =>
          setOverlay(
            overlay.chat.userId
              ? { kind: 'call', userId: overlay.chat.userId, art }
              : {
                  kind: 'call',
                  gruppenName: overlay.chat.name,
                  teilnehmer: overlay.chat.memberIds ?? [],
                  art,
                }
          )
        }
        onCamera={() => setOverlay({ kind: 'camera' })}
        onOpenProfile={openProfile}
        onAcceptRequest={acceptRequest}
        contacts={contacts}
        onNotice={setNotice}
        onOpenStandort={(name) => {
          const platz = mockPlaces.find((p) => p.name === name);
          if (platz) setOverlay({ kind: 'explorer', ziel: { art: 'standort', wert: platz.id } });
        }}
      />
    );
  }

  if (overlay?.kind === 'profile') {
    if (overlay.variant === 'kontakt') {
      return (
        <ContactProfileScreen
          userId={overlay.userId}
          onBack={() => setOverlay(null)}
          onMessage={openChatWith}
          onCall={(id, art) => setOverlay({ kind: 'call', userId: id, art })}
          chat={chats.find((c) => !c.isGroup && c.userId === overlay.userId)}
          nachrichten={nachrichtenVon(chats.find((c) => !c.isGroup && c.userId === overlay.userId)?.id)}
          gruppen={chats.filter((c) => c.isGroup && (c.memberIds ?? []).includes(overlay.userId))}
          onOpenChat={oeffneChat}
          onOpenPublicProfile={openPublicProfile}
          onNotice={setNotice}
        />
      );
    }
    return (
      <UserProfileScreen
        userId={overlay.userId}
        onBack={() => setOverlay(null)}
        onMessage={openChatWith}
        onBlockiert={(userId, blockiert) => {
          // Blockieren hat Folgen: die Person faellt aus den Kontakten, beim
          // Aufheben kommt sie zurueck. Sonst waere der Knopf nur ein Wort.
          if (blockiert) {
            setContacts((prev) => prev.filter((c) => c.id !== userId));
          } else if (!contacts.some((c) => c.id === userId)) {
            const person = mockUsers[userId];
            setContacts((prev) => [...prev, { id: userId, name: person.name, status: 'friend', about: 'Kontakt' }]);
          }
        }}
        onNotice={setNotice}
      />
    );
  }

  if (overlay?.kind === 'story') {
    return (
      <StoryViewerScreen
        story={overlay.story}
        alle={stories}
        onClose={() => setOverlay(null)}
        onDelete={() => {
          setStories((prev) =>
            prev.map((s) =>
              s.own ? { ...s, mediaUri: undefined, aufgenommen: undefined } : s
            )
          );
          setNotice('Deine Story wurde gelöscht');
        }}
        onReply={replyToStory}
        contacts={contacts}
        onOpenProfile={openProfile}
        onNotice={setNotice}
      />
    );
  }

  if (overlay?.kind === 'contacts') {
    return (
      <ContactsScreen
        contacts={contacts}
        onBack={() => setOverlay(null)}
        onOpenContact={(contact: Contact) => openProfile(contact.id)}
        onAddContact={() => setSheet('contact')}
      />
    );
  }

  if (overlay?.kind === 'call') {
    return (
      <CallScreen
        userId={overlay.userId}
        gruppenName={overlay.gruppenName}
        teilnehmer={overlay.teilnehmer}
        art={overlay.art}
        onClose={() => setOverlay(null)}
        onNotice={setNotice}
      />
    );
  }

  if (overlay?.kind === 'camera') {
    return (
      <CameraScreen
        onClose={() => setOverlay(null)}
        onCaptured={storyAufgenommen}
        onNotice={setNotice}
      />
    );
  }

  if (overlay?.kind === 'explorer') {
    return (
      <ExplorerScreen
        ziel={overlay.ziel}
        onBack={() => setOverlay(null)}
        onOpenClip={(clipId) => setOverlay({ kind: 'clip', clipId })}
        onNotice={setNotice}
      />
    );
  }

  if (overlay?.kind === 'clip') {
    return (
      <ClipPlayerScreen
        clipId={overlay.clipId}
        onBack={() => setOverlay(null)}
        onOpenProfile={openPublicProfile}
        onOpenExplorer={(ziel) => setOverlay({ kind: 'explorer', ziel })}
        onShare={(clip) =>
          setTeilenZiel({
            art: 'video',
            id: clip.id,
            titel: clip.title,
            autor: mockUsers[clip.userId]?.name ?? 'Unbekannt',
          })
        }
        onNotice={setNotice}
      />
    );
  }

  if (overlay?.kind === 'livestream') {
    return (
      <LivestreamScreen
        onEnd={(sekunden, zuschauer) => {
          profil.aufzeichnungAnlegen(sekunden, zuschauer);
          setOverlay(null);
          setArea('videos');
          setSubs((prev) => ({ ...prev, videos: 'landscape' }));
          setNotice('Livestream beendet, die Aufzeichnung steht im Querformat');
        }}
      />
    );
  }

  const renderContent = () => {
    if (area === 'messenger') {
      if (sub === 'friendmap') return <FriendMapScreen onOpenProfile={openProfile} onNotice={setNotice} />;
      if (sub === 'camera') {
        return (
          <CameraScreen
            embedded
            onClose={() => setSub('chats')}
            onCaptured={(uri) => {
              storyAufgenommen(uri);
              setSub('chats');
            }}
            onNotice={setNotice}
          />
        );
      }
      if (sub === 'profile') {
        return (
          <MessengerProfileScreen
            onSwitchArea={switchArea}
            onSwitchAccount={() => setSheet('konto')}
            onOpenSettings={() => setArea('settings')}
            onNotice={setNotice}
          />
        );
      }
      return (
        <ChatListScreen
          allChats={chats}
          stories={stories}
          onOpenChat={(chat) => oeffneChat(chat)}
          onOpenStory={openStory}
          onNewChat={() => setSheet('new')}
        />
      );
    }

    if (area === 'videos') {
      if (sub === 'portrait') return <VideoFeedScreen onOpenProfile={openPublicProfile} onShare={teileVideo} onNotice={setNotice} />;
      if (sub === 'landscape')
        return (
          <LandscapeVideosScreen onOpenClip={(clipId) => setOverlay({ kind: 'clip', clipId })} onNotice={setNotice} />
        );
      if (sub === 'search')
        return (
          <VideoSearchScreen
            onOpenProfile={openPublicProfile}
            onOpenExplorer={(ziel) => setOverlay({ kind: 'explorer', ziel })}
            onNotice={setNotice}
          />
        );
      if (sub === 'profile') return <VideoProfileScreen onSwitchArea={switchArea} onAction={profilAktion} onBearbeiten={profilBearbeiten} onNotice={setNotice} />;
      return (
        <HomeFeedScreen
          stories={stories}
          onOpenStory={openStory}
          onOpenProfile={openPublicProfile}
          onShare={teileBeitrag}
          onNotice={setNotice}
        />
      );
    }

    if (area === 'communities') {
      if (sub === 'chats') return <CommunityChatsScreen onOpenCommunity={openCommunity} />;
      if (sub === 'search') {
        return (
          <CommunitySearchScreen
            contacts={contacts}
            onOpenCommunity={openCommunity}
            onOpenProfile={openProfile}
            onBefriend={befriend}
          />
        );
      }
      if (sub === 'profile') {
        return (
          <CommunityProfileScreen
            onSwitchArea={switchArea}
            onOpenCommunity={openCommunity}
            onAction={profilAktion}
            onBearbeiten={profilBearbeiten}
            onNotice={setNotice}
          />
        );
      }
      return <CommunitiesScreen onOpenCommunity={openCommunity} onNotice={setNotice} />;
    }

    return (
      <SettingsScreen
        onNotice={setNotice}
        onLogout={logout}
        onSwitchAccount={() => setSheet('konto')}
        sprung={settingsSprung}
        onSprungFertig={() => setSettingsSprung(null)}
      />
    );
  };

  return (
    // Kein SafeAreaView um die ganze Shell: Der Hintergrund soll bis in die
    // Ecken laufen, damit es wie eine echte App aussieht. Den Platz fuer Notch
    // und Home-Anzeige halten sich die obere und die untere Leiste selbst frei.
    <View style={styles.container}>
      {/* Im Dunkelmodus muss die Schrift der Statusleiste hell sein - sonst
          steht die Uhrzeit schwarz auf schwarzem Grund. */}
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <TopSwitcher area={area} active={sub} onChange={setSub} />
      <View style={styles.content}>{renderContent()}</View>
      <TabBar active={area} onChange={setArea} unreadCount={unreadCount} />

      <ActionSheet
        visible={sheet === 'new'}
        title="Neu"
        items={[
          { key: 'group', label: 'Neue Gruppe', icon: 'people-outline' },
          { key: 'contact', label: 'Kontakt hinzufügen', icon: 'person-add-outline' },
          { key: 'contacts', label: 'Kontakte', icon: 'person-outline' },
        ]}
        onSelect={(key) => {
          if (key === 'contacts') {
            setSheet(null);
            setOverlay({ kind: 'contacts' });
            return;
          }
          setSheet(key as Sheet);
        }}
        onClose={() => setSheet(null)}
      />
      <NewGroupSheet
        visible={sheet === 'group'}
        contacts={contacts}
        onClose={() => setSheet(null)}
        onCreate={createGroup}
        onNotice={setNotice}
      />
      <AddContactSheet
        visible={sheet === 'contact'}
        contacts={contacts}
        onClose={() => setSheet(null)}
        onAdd={addContact}
        onNotice={setNotice}
      />

      <KontoWechsel
        visible={sheet === 'konto'}
        onClose={() => setSheet(null)}
        onNotice={setNotice}
      />

      <TeilenSheet
        ziel={teilenZiel}
        contacts={contacts}
        onClose={() => setTeilenZiel(null)}
        onSend={teileMit}
      />

      <MitteilungenSheet
        visible={sheet === 'mitteilungen'}
        bereich={profilBereich}
        onClose={() => setSheet(null)}
        onOpen={mitteilungOeffnen}
        onNotice={setNotice}
      />
      <ErstellenSheet
        visible={sheet === 'erstellen'}
        bereich={profilBereich}
        onClose={() => setSheet(null)}
        onSelect={erstelle}
      />
      {formular && (
        <FormularSheet
          visible
          title={formular.title}
          felder={formular.felder}
          knopf={formular.knopf}
          onClose={() => setFormular(null)}
          onSubmit={formular.absenden}
          onNotice={setNotice}
        />
      )}

      <Toast message={notice} onHide={hideNotice} />
    </View>
  );
};

const Root = () => {
  const { isLoggedIn, sitzungGeladen } = useContext(AuthContext);

  /*
   * Solange die gespeicherte Sitzung noch geholt wird, zeigen wir eine leere
   * Flaeche in der App-Farbe. Ohne das blitzt der Anmeldebildschirm fuer
   * einen Bildaufbau auf und verschwindet wieder - das sieht aus, als waere
   * etwas schiefgegangen.
   *
   * Die Flaeche ist bewusst leer und nicht ein Kreisel: das Holen dauert
   * wenige Millisekunden, ein Kreisel wuerde nur kurz aufblitzen.
   */
  if (!sitzungGeladen) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  return isLoggedIn ? <Shell /> : <LoginScreen />;
};

const App = () => (
  <SafeAreaProvider>
    {/*
      Der ThemeProvider steht ganz aussen: er baut den Baum bei einem
      Themenwechsel neu auf, und das soll wirklich alles betreffen.
    */}
    <ThemeProvider>
      <SupabaseProvider>
        <AuthProvider>
          <RepostProvider>
            <ProfilProvider>
              <Root />
            </ProfilProvider>
          </RepostProvider>
        </AuthProvider>
      </SupabaseProvider>
    </ThemeProvider>
  </SafeAreaProvider>
);

const styles = themenStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1 },
}));

export default App;
