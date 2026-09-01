import React, { useEffect, useCallback, useContext, useRef, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext, AuthProvider } from './contexts/AuthContext';
import { ThemeContext, ThemeProvider } from './contexts/ThemeContext';
import { SupabaseProvider } from './contexts/SupabaseContext';
import { DatenProvider } from './contexts/DatenContext';
import { RepostProvider } from './contexts/RepostContext';
import { ProfilProvider, useProfil } from './contexts/ProfilContext';
import { ActionSheet } from './components/ActionSheet';
import { AddContactSheet } from './components/AddContactSheet';
import { ErstellenSheet, ErstellenPunkt } from './components/ErstellenSheet';
import { FormularFeld, FormularSheet } from './components/FormularSheet';
import { MitteilungenSheet } from './components/MitteilungenSheet';
import { NewGroupSheet } from './components/NewGroupSheet';
import { TeilenSheet, TeilenZiel } from './components/TeilenSheet';
import { useAktionen } from './lib/useAktionen';
import { KontoWechsel } from './components/KontoWechsel';
import { TabBar } from './components/TabBar';
import { INSEL_ABSTAND, INSEL_HOEHE, TopSwitcher } from './components/TopSwitcher';
import { Toast } from './components/Toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AreaKey, NAV, SubKey, areaOf, defaultSub } from './constants/navigation';
import { LoginScreen } from './screens/LoginScreen';
import { ChatListScreen } from './screens/messenger/ChatListScreen';
import { ChatDetailScreen } from './screens/messenger/ChatDetailScreen';
import { ContactsScreen } from './screens/messenger/ContactsScreen';
import { ContactProfileScreen } from './screens/messenger/ContactProfileScreen';
import { FriendMapScreen } from './screens/messenger/FriendMapScreen';
import { EditSelectedContactsScreen } from './screens/messenger/EditSelectedContactsScreen';
import { AvatarViewerScreen } from './screens/AvatarViewerScreen';
import { MessengerProfileScreen } from './screens/messenger/MessengerProfileScreen';
import { StoryViewerScreen } from './screens/messenger/StoryViewerScreen';
import { CameraScreen } from './screens/messenger/CameraScreen';
import { CallScreen } from './screens/messenger/CallScreen';
import { CommunitiesScreen } from './screens/communities/CommunitiesScreen';
import { CommunityChatsScreen } from './screens/communities/CommunityChatsScreen';
import { CommunityDetailScreen } from './screens/communities/CommunityDetailScreen';
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
import { FollowersScreen } from './screens/profile/FollowersScreen';
import { FollowingScreen } from './screens/profile/FollowingScreen';
import { colors, themenStyles } from './constants/design';
import { aufnehmen } from './lib/aufnehmen';
import { useDaten } from './contexts/DatenContext';
import { Chat, Community, Contact, Message, MitteilungsBereich, MitteilungsZiel, Post, Story, Unterthema, Video } from './types';

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
  /**
   * `zielChat` gesetzt heißt: die Kamera kam aus einem Chat. Dann steht das
   * Ziel schon fest und die Aufnahme geht ohne Rückfrage dorthin — wer aus
   * einem Chat die Kamera aufmacht, will das Bild diesem Chat schicken.
   */
  | { kind: 'camera'; zielChat?: Chat }
  | { kind: 'call'; userId?: string; gruppenName?: string; teilnehmer?: string[]; art: 'audio' | 'video' }
  | { kind: 'livestream' }
  | { kind: 'explorer'; ziel: ExplorerZiel }
  | { kind: 'clip'; clipId: string }
  /**
   * Die Seite einer Community — Prototyp-Frame "CH + Kanal". Vorher fuehrte
   * eine Community direkt in einen Gruppenchat; die Seite dazwischen gab es
   * in der App gar nicht.
   */
  | { kind: 'community'; communityId: string }
  | { kind: 'editSelectedContacts' }
  | { kind: 'avatarViewer'; userId: string; name: string }
  | { kind: 'followers'; userId: string }
  | { kind: 'following'; userId: string }
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
  const insets = useSafeAreaInsets();

  // Jeder Bereich merkt sich seinen zuletzt offenen Unterpunkt — genau wie im
  // Prototyp, wo die obere Leiste zum Bereich gehoert.
  const [area, setArea] = useState<AreaKey>('messenger');
  const [subs, setSubs] = useState<Record<AreaKey, SubKey>>(defaultSub);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /*
   * Chats, Kontakte und Storys liegen in der Schale, damit eine Aenderung an
   * einer Stelle ueberall ankommt. Ihr Ausgangsstand kommt aus der Datenbank.
   */
  const daten = useDaten();
  // Alles, was die App in die Datenbank schreibt, laeuft hierueber.
  const aktion = useAktionen(setNotice);
  const [chats, setChats] = useState<Chat[]>([]);
  /*
   * Der Chat, dessen Optionen-Blatt offen ist. Auf der Website gibt es das
   * Blatt seit jeher (chatOptionen in web/public/app.js); in der App fuehrte
   * langes Druecken auf einen Chat bis zum 01.09.2026 ins Leere, und
   * Archivieren, Als gelesen markieren und Chat loeschen gab es gar nicht.
   */
  const [chatOptionen, setChatOptionen] = useState<Chat | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stories, setStories] = useState<Story[]>([]);

  useEffect(() => {
    if (!daten.geladen) return;
    setChats(daten.chats);
    setContacts(daten.contacts);
    setStories(daten.stories);
  }, [daten.geladen]);

  // Die drei Knoepfe oben rechts im eigenen Profil gehoeren zu genau einem
  // Bereich - Videos oder Communitys. Beide haben eigene Mitteilungen und ein
  // eigenes Erstellen-Menue, so wie im Prototyp.
  const [profilBereich, setProfilBereich] = useState<MitteilungsBereich>('videos');
  const [formular, setFormular] = useState<Formular | null>(null);
  /** Abschnitt, bei dem die Einstellungen aufgehen sollen. */
  const [settingsSprung, setSettingsSprung] = useState<string | null>(null);
  /** Bereich, von dem man zu den Settings kam (messenger/videos/communities). */
  const [settingsVonBereich, setSettingsVonBereich] = useState<AreaKey | null>(null);
  const [teilenZiel, setTeilenZiel] = useState<TeilenZiel | null>(null);
  /** Aufnahme aus der Kamera, die auf die Wahl eines Chats wartet. */
  const [aufnahmeFuerChat, setAufnahmeFuerChat] = useState<string | null>(null);
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
   * Bereichswechsel unten: jeder Bereich faengt auf seiner Hauptseite an.
   *
   * Vorher merkte sich jeder Bereich seinen zuletzt offenen Unterpunkt. Wer
   * den Messenger auf der Kamera verlassen hatte, stand beim naechsten Mal
   * wieder in der Kamera statt in der Chatliste. Erneutes Tippen auf den
   * bereits offenen Bereich springt ebenfalls zurueck - so wie in jeder App
   * mit unterer Leiste.
   */
  const wechsleBereich = (next: AreaKey) => {
    setArea(next);
    setSubs((prev) => ({ ...prev, [next]: defaultSub[next] }));
  };

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
   *   messenger/chats                         die Chatliste
   *   messenger/chats#chat:Anna Schmidt        ein offener Chat darin
   *   videos/profile#profil:Anna Schmidt       ein fremdes Profil
   *
   * Angegeben wird der NAME, nicht die Kennung. Kennungen vergibt die
   * Datenbank beim Anlegen; die frueheren festen Werte (c1, u1, s1, q1, k1)
   * gab es nach dem Umzug nach Supabase nicht mehr. Die Ueberlagerung ging
   * dann still nicht auf, und `npm run mac:bilder` legte fuer acht
   * Detailbildschirme in Wahrheit das Bild der Einstiegsseite ab.
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
  /*
   * Erst laufen lassen, wenn die Daten da sind.
   *
   * Vorher hing der Effekt an [] und lief einmal beim Aufbau - da war
   * `daten` noch leer, und jede Ueberlagerung fiel durch, weil sie ihren
   * Chat, ihre Story oder ihr Profil nicht fand.
   */
  const pruefbildGesetzt = useRef(false);
  // Wahr, sobald der Bildschirm ueber den Pruefschalter aufgemacht wurde.
  // Der Story-Betrachter blaettert dann nicht von selbst weiter.
  const [pruefStandbild, setPruefStandbild] = useState(false);
  useEffect(() => {
    if (!__DEV__ || pruefbildGesetzt.current) return;
    if (daten.chats.length === 0 && Object.keys(daten.users).length === 0) return;
    pruefbildGesetzt.current = true;
    AsyncStorage.getItem('all-media.pruefbild')
      .then((roh) => {
        if (!roh) return;
        const [pfad, ueberlagerung] = roh.split('#');
        const [zielArea, zielSub] = pfad.split('/') as [AreaKey, SubKey | undefined];
        if (!NAV.some((a) => a.key === zielArea)) return;
        setArea(zielArea);
        if (zielSub) setSubs((prev) => ({ ...prev, [zielArea]: zielSub }));
        if (ueberlagerung) {
          setPruefStandbild(true);
          pruefUeberlagerung(ueberlagerung);
        }
      })
      .catch(() => {
        // Kein Schalter gesetzt oder Speicher nicht lesbar: normal starten.
      });
  }, [daten]);

  /**
   * Den Teil hinter der Raute in eine Überlagerung übersetzen. Bewusst
   * nachsichtig: eine unbekannte Angabe lässt schlicht den Grundbildschirm
   * stehen, statt die App beim Start abstürzen zu lassen.
   */
  const pruefUeberlagerung = (angabe: string) => {
    const [art, a, b] = angabe.split(':');
    // Kennung ODER Name: die Kennungen vergibt die Datenbank, die Namen
    // stehen in den Beispielinhalten und aendern sich nicht.
    const nutzerId = (wert: string) =>
      daten.users[wert]
        ? wert
        : Object.keys(daten.users).find((id) => daten.users[id]?.name === wert);

    switch (art) {
      case 'chat': {
        const chat = daten.chats.find((c) => c.id === a || c.name === a);
        if (chat) setOverlay({ kind: 'chat', chat, extra: [] });
        break;
      }
      case 'story': {
        // Die Kachel traegt nur den Vornamen ("Anna"), gesucht wird aber
        // gerne mit dem vollen Namen - beides zulassen.
        const story = daten.stories.find(
          (s) => s.id === a || s.name === a || daten.users[s.userId]?.name === a
        );
        if (story) setOverlay({ kind: 'story', story });
        break;
      }
      case 'profil': {
        const id = nutzerId(a);
        if (id) setOverlay({ kind: 'profile', userId: id, variant: 'oeffentlich' });
        break;
      }
      case 'kontakt': {
        const id = nutzerId(a);
        if (id) setOverlay({ kind: 'profile', userId: id, variant: 'kontakt' });
        break;
      }
      case 'kontakte':
        setOverlay({ kind: 'contacts' });
        break;
      case 'community': {
        const com = daten.communities.find((c) => c.id === a || c.name === a);
        if (com) setOverlay({ kind: 'community', communityId: com.id });
        break;
      }
      case 'anruf': {
        const id = nutzerId(a);
        if (id) setOverlay({ kind: 'call', userId: id, art: b === 'video' ? 'video' : 'audio' });
        break;
      }
      case 'clip': {
        const clip = daten.clips.find((c) => c.id === a || c.title === a);
        if (clip) setOverlay({ kind: 'clip', clipId: clip.id });
        break;
      }
      case 'blatt':
        if (['new', 'group', 'contact', 'konto', 'mitteilungen', 'erstellen'].includes(a)) {
          setSheet(a as Sheet);
        }
        break;
    }
  };

  const unreadCount = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);
  const hideNotice = useCallback(() => setNotice(null), []);

  /*
   * Platz und Zaehler der Dynamic Island.
   *
   * Zaehler: eine neue Nachricht stand bisher nur unten am Bereich, nicht
   * oben am Unterpunkt, zu dem sie gehoert. Beide zeigen sie jetzt — im
   * Messenger unter "Chats", im Bereich Communitys unter "Chats".
   */
  const hatInsel = areaOf(area).subs.length > 0;
  const inselPlatz = insets.top + INSEL_ABSTAND + INSEL_HOEHE + INSEL_ABSTAND;
  const inselZaehler: Partial<Record<SubKey, number>> =
    area === 'messenger' ? { chats: unreadCount } : {};

  /** Alle Nachrichten eines Chats - fuer Medien, Markiertes und die Suche. */
  const nachrichtenVon = (chatId?: string): Message[] =>
    chatId ? [...(extraNachrichten[chatId] ?? [])] : [];

  /** Chat oeffnen und dabei alles mitgeben, was frueher hineingeteilt wurde. */
  const oeffneChat = (chat: Chat, zusatz?: Message[]) =>
    setOverlay({ kind: 'chat', chat, extra: [...(extraNachrichten[chat.id] ?? []), ...(zusatz ?? [])] });

  const openChatWith = (userId: string) => {
    const person = daten.users[userId];
    let chat = chats.find((c) => !c.isGroup && c.userId === userId);

    if (!chat) {
      chat = {
        id: `c${Date.now()}`,
        name: person.name,
        userId,
        isGroup: false,
        preview: 'Chat gestartet',
        time: now(),
        unreadCount: 0,
      };
      setChats((prev) => [chat as Chat, ...prev]);
    }

    oeffneChat(chat);
  };

  /** Beitrag oder Video in den Chat mit dieser Person legen. */
  const teileMit = (userId: string, ziel: TeilenZiel) => {
    const person = daten.users[userId];
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

    /*
     * Und wirklich senden.
     *
     * Bis zum 01.09.2026 endete diese Funktion hier. Die Karte lag im Chat,
     * die Meldung stand da — nur war beides ausschliesslich in diesem einen
     * Bildschirm. Der Empfaenger bekam nie etwas, und beim naechsten Start
     * war der Chat wieder leer. Die Website hat es die ganze Zeit richtig
     * gemacht (web/server/sync-handlers.js, handleShareToChats), was den
     * Unterschied zwischen beiden Fassungen erklaerte.
     *
     * Danach neu laden: die Nachricht bekommt in der Datenbank ihre eigene
     * Kennung, und die Zahl unter dem Beitrag steigt.
     */
    aktion.teilen(ziel.id, [userId], vorschau).then((ok) => {
      if (ok) daten.neuLaden();
    });
  };

  /*
   * Punkt 17: eine Aufnahme aus der Kamera in einen Chat schicken. Läuft über
   * dieselbe Personenauswahl wie das Teilen — nur landet hier ein Bild in der
   * Nachricht statt einer Beitragskarte.
   */
  const aufnahmeAnPerson = (userId: string, uri: string) => {
    const person = daten.users[userId];
    let chat = chats.find((c) => !c.isGroup && c.userId === userId);

    if (!chat) {
      chat = {
        id: `c${Date.now()}`,
        name: person.name,
        userId,
        isGroup: false,
        preview: 'Foto',
        time: now(),
        unreadCount: 0,
      };
      setChats((prev) => [chat as Chat, ...prev]);
    } else {
      const id = chat.id;
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, preview: 'Foto', time: now() } : c)));
    }

    const nachricht: Message = {
      id: `m${Date.now()}`,
      chatId: chat.id,
      senderId: 'me',
      text: 'Foto',
      time: now(),
      bildUri: uri,
    };
    setExtraNachrichten((prev) => ({ ...prev, [chat!.id]: [...(prev[chat!.id] ?? []), nachricht] }));
    setNotice(`An ${person.name} gesendet`);
  };

  /** Aufnahme in einen schon feststehenden Chat legen und ihn wieder öffnen. */
  const aufnahmeInChat = (chat: Chat, uri: string) => {
    const nachricht: Message = {
      id: `m${Date.now()}`,
      chatId: chat.id,
      senderId: 'me',
      text: 'Foto',
      time: now(),
      bildUri: uri,
    };
    setExtraNachrichten((prev) => ({ ...prev, [chat.id]: [...(prev[chat.id] ?? []), nachricht] }));
    setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, preview: 'Foto', time: now() } : c)));
    setOverlay({ kind: 'chat', chat });
    setNotice('Foto gesendet');
  };

  /** Punkt 17: eine Aufnahme direkt als Beitrag veröffentlichen. */
  const aufnahmeAlsBeitrag = (uri: string) => {
    setOverlay(null);
    setFormular({
      title: 'Neuer Beitrag',
      knopf: 'Veröffentlichen',
      felder: [
        { key: 'beschreibung', label: 'Beschreibung', typ: 'mehrzeilig', pflicht: true },
        { key: 'ort', label: 'Ort (freiwillig)', platzhalter: 'z. B. Köln' },
      ],
      absenden: ({ beschreibung, ort }) => {
        profil.beitragAnlegen({ beschreibung, ort, mediaUri: uri });
        setArea('videos');
        setSubs((prev) => ({ ...prev, videos: 'home' as SubKey }));
        setNotice('Beitrag veröffentlicht');
        return null;
      },
    });
  };

  /*
   * Eine Gruppe anlegen.
   *
   * Die Kennung kommt aus der Datenbank, nicht aus `Date.now()`. Vorher tat
   * sie das nicht: die Gruppe stand in der Liste, aber nirgends sonst — in
   * sie liess sich keine Nachricht schreiben, die Website sah sie nie, und
   * nach dem naechsten Start war sie weg.
   *
   * Deshalb wird hier auf die Datenbank gewartet, statt die Anzeige
   * vorlaufen zu lassen. Ein Chat, den man sofort oeffnen kann und der beim
   * ersten Wort scheitert, ist der schlechtere Tausch.
   */
  const createGroup = async (name: string, memberIds: string[], info?: string) => {
    const id = await aktion.gruppeAnlegen(name, memberIds);
    if (!id) return;

    const chat: Chat = {
      id,
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

  /*
   * Jemanden als Kontakt aufnehmen.
   *
   * Auch hier kommt die Kennung des Chats aus der Datenbank — und mit ihr
   * der Chat selbst, falls es ihn schon gab. Vorher entstand bei jedem
   * Hinzufuegen ein neuer Chat mit erfundener Kennung; der Eintrag in
   * `contacts` fehlte ganz, und die Website wusste von der Anfrage nichts.
   */
  const addContact = async (contact: Contact) => {
    const ergebnis = await aktion.kontaktHinzufuegen(contact.id, contact.status === 'pending');
    if (!ergebnis) return;

    setContacts((prev) => [...prev, contact]);
    setSheet(null);

    const vorhanden = chats.find((c) => c.id === ergebnis.chatId);
    const chat: Chat = vorhanden ?? {
      id: ergebnis.chatId,
      name: contact.name,
      userId: contact.id,
      isGroup: false,
      preview: 'Anfrage gesendet',
      time: now(),
      unreadCount: 0,
      requestState: ergebnis.status === 'friend' ? 'accepted' : 'pending',
    };
    if (!vorhanden) setChats((prev) => [chat, ...prev]);
    /* Punkt 5: Nach Kontakt hinzufügen direkt zum Chat leiten,
       nicht sofort nach Nachricht fragen. */
    oeffneChat(chat);
  };

  /**
   * Eine Einstellung am Chat umlegen — und sie merken.
   *
   * Die Liste schaltet sofort um, das Schreiben laeuft nebenher. Geht es
   * schief, wird zurueckgestellt: eine Liste, die "Archiviert" behauptet,
   * waehrend in der Datenbank nichts steht, ist der schlechtere Fall.
   */
  const chatUmlegen = (chat: Chat, was: 'archiv' | 'stumm' | 'gelesen') => {
    const felder: Record<string, Partial<Chat>> = {
      archiv: { archiviert: !chat.archiviert },
      stumm: { muted: !chat.muted },
      gelesen: { unreadCount: chat.unreadCount > 0 ? 0 : 1 },
    };
    const neu = felder[was];
    const alt: Partial<Chat> = {
      archiv: { archiviert: chat.archiviert },
      stumm: { muted: chat.muted },
      gelesen: { unreadCount: chat.unreadCount },
    }[was];

    const setzen = (werte: Partial<Chat>) =>
      setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, ...werte } : c)));

    setzen(neu);
    setNotice(
      was === 'archiv'
        ? chat.archiviert ? 'Aus dem Archiv geholt' : 'Chat archiviert'
        : was === 'stumm'
          ? chat.muted ? 'Stummschaltung aufgehoben' : 'Chat stummgeschaltet'
          : chat.unreadCount > 0 ? 'Als gelesen markiert' : 'Als ungelesen markiert'
    );

    // "gelesen" ist in der Datenbank herum: is_read true heisst gelesen,
    // unreadCount 0 heisst dasselbe.
    const wert =
      was === 'archiv' ? !chat.archiviert : was === 'stumm' ? !chat.muted : chat.unreadCount > 0;
    aktion.chatEinstellung(chat.id, was, wert, () => setzen(alt));
  };

  /** Chat verlassen — die Unterhaltung bleibt beim Gegenueber stehen. */
  const chatLoeschen = (chat: Chat) => {
    const vorher = chats;
    setChats((prev) => prev.filter((c) => c.id !== chat.id));
    setNotice('Chat gelöscht');
    aktion.chatVerlassen(chat.id, () => setChats(vorher));
  };

  /** Anfrage angenommen: der Chat ist ab jetzt frei benutzbar. */
  const acceptRequest = (chatId: string) => {
    /*
     * Und in die Datenbank: `contacts.status` geht von "pending" auf
     * "friend". Ohne das stand der Chat nach dem naechsten Start wieder
     * gesperrt da, und auf der Website blieb die Anfrage offen.
     */
    const zielId = chats.find((c) => c.id === chatId)?.userId;
    if (zielId) {
      aktion.anfrageAnnehmen(zielId, () => {
        setChats((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, requestState: 'pending' as const } : c))
        );
        setContacts((prev) =>
          prev.map((c) => (c.id === zielId ? { ...c, status: 'pending' as const } : c))
        );
      });
    }

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
    const person = daten.users[userId];
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
    /* Story als viewed markieren, wenn sie angesehen wird */
    if (!story.viewed) {
      setStories((prev) =>
        prev.map((s) => (s.id === story.id ? { ...s, viewed: true } : s))
      );
    }
    setOverlay({ kind: 'story', story });
  };

  /**
   * Aufnahme aus der Kamera landet in der eigenen Story.
   *
   * „Deine Story ist online" stimmte bis hierher nicht: die Aufnahme lag im
   * Arbeitsspeicher der App. Niemand konnte sie sehen, und nach dem naechsten
   * Start war sie weg. Jetzt geht sie in den Speicher von Supabase und in die
   * Tabelle `stories` — die Kennung von dort ersetzt die oertliche.
   */
  const storyAufgenommen = async (uri: string) => {
    setStories((prev) =>
      prev.map((s) =>
        s.own
          ? { ...s, mediaUri: uri, aufgenommen: Date.now(), viewed: false, name: 'Deine Story' }
          : s
      )
    );
    setOverlay(null);

    const id = await aktion.storyAnlegen({ mediaUrl: uri, mediaTyp: 'image' });
    if (!id) {
      // Die Aufnahme wieder herausnehmen: eine Story, die es nirgends gibt,
      // soll auch im eigenen Ring nicht stehen.
      setStories((prev) =>
        prev.map((s) => (s.own ? { ...s, mediaUri: undefined, aufgenommen: undefined } : s))
      );
      return;
    }
    setStories((prev) => prev.map((s) => (s.own ? { ...s, id } : s)));
    setNotice('Deine Story ist online');
  };

  // Antwort auf eine Story: sie landet im Chat mit dieser Person, und der Chat
  // oeffnet sich direkt — sonst waere die Antwort nirgends zu sehen.
  /*
   * Auf eine Story antworten.
   *
   * Die Antwort ist eine ganz gewoehnliche Nachricht im Chat mit dieser
   * Person — die Datenbank kennt keine Story-Antwort. Vorher blieb sie im
   * Bildschirm: der Chat, den die App dafuer aufmachte, hatte eine erfundene
   * Kennung, und beim Empfaenger kam nie etwas an.
   */
  const replyToStory = async (story: Story, text: string) => {
    const person = daten.users[story.userId];
    const chatId = await aktion.storyAntwort(story.id, text);
    if (!chatId) return;

    const vorhanden = chats.find((c) => c.id === chatId);
    const chat: Chat = vorhanden
      ? { ...vorhanden, preview: text, time: now() }
      : {
          id: chatId,
          name: person.name,
          userId: story.userId,
          isGroup: false,
          preview: text,
          time: now(),
          unreadCount: 0,
        };
    setChats((prev) =>
      vorhanden ? prev.map((c) => (c.id === chatId ? chat : c)) : [chat, ...prev]
    );

    setNotice(`Antwort an ${person.name} gesendet`);
    // Ohne die Nachricht als Zusatz: sie steht jetzt in der Datenbank und
    // kommt beim Oeffnen des Chats von dort — sonst staende sie doppelt da.
    oeffneChat(chat);
  };

  /*
   * Eine Community oeffnet ihre Seite, nicht mehr direkt einen Chat.
   * Prototyp-Frame "CH + Kanal": erst Kopfbild, Biografie und die
   * Unterthemen, und ein Chat steckt hinter einem Unterthema.
   */
  const openCommunity = (community: Community) =>
    setOverlay({ kind: 'community', communityId: community.id });

  /** Der Chat eines Unterthemas. */
  const oeffneUnterthema = (community: Community, unterthema: Unterthema) =>
    oeffneChat({
      id: unterthema.id,
      name: `${community.name} · ${unterthema.name}`,
      isGroup: true,
      memberIds: new Array(Math.max(community.members - 1, 0)).fill(''),
      preview: unterthema.themen.join(' · '),
      time: '',
      unreadCount: 0,
    });

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
    setSettingsVonBereich(area);
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
    setSettingsVonBereich(area);
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
        // Punkt 38: Musik zum Beitrag - dieselbe Liste wie hinter den
        // Sound-Seiten.
        {
          key: 'music',
          label: 'Musik',
          typ: 'auswahl',
          auswahl: ['Originalton', ...daten.sounds.map((s) => `${s.title} – ${s.artist}`)],
        },
      ],
      absenden: ({ beschreibung, ort, music }) => {
        if (istBild) profil.beitragAnlegen({ beschreibung, ort, mediaUri: uri, music });
        else profil.videoAnlegen({ beschreibung, ort, quer, mediaUri: uri, music });

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
      autor: daten.users[post.userId]?.name ?? 'Unbekannt',
    });

  const teileVideo = (video: Video) =>
    setTeilenZiel({
      art: 'video',
      id: video.id,
      titel: video.description,
      autor: daten.users[video.userId]?.name ?? 'Unbekannt',
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
        onCamera={() => setOverlay({ kind: 'camera', zielChat: overlay.chat })}
        onOpenProfile={openProfile}
        onOpenGroupSettings={(chatId) => setNotice(`Gruppeneinstellungen: ${overlay.chat.name}`)}
        onAcceptRequest={acceptRequest}
        contacts={contacts}
        onNotice={setNotice}
        onOpenStandort={(name) => {
          const platz = daten.places.find((p) => p.name === name);
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
        onAvatarPress={() => {
          const person = daten.users[overlay.userId];
          setOverlay({ kind: 'avatarViewer', userId: overlay.userId, name: person?.name ?? 'Profil' });
        }}
        onOpenFollowers={(userId) => setOverlay({ kind: 'followers', userId })}
        onOpenFollowing={(userId) => setOverlay({ kind: 'following', userId })}
        onBlockiert={(userId, blockiert) => {
          // Blockieren hat Folgen: die Person faellt aus den Kontakten, beim
          // Aufheben kommt sie zurueck. Sonst waere der Knopf nur ein Wort.
          if (blockiert) {
            setContacts((prev) => prev.filter((c) => c.id !== userId));
          } else if (!contacts.some((c) => c.id === userId)) {
            const person = daten.users[userId];
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
        standbild={pruefStandbild}
        onStoryViewed={(storyId) => {
          // Nichts anfassen, wenn sie schon gesehen ist: sonst entsteht bei
          // jedem Melden ein neues Feld, und der Betrachter baut sich neu auf.
          setStories((prev) =>
            prev.some((s) => s.id === storyId && !s.viewed)
              ? prev.map((s) => (s.id === storyId ? { ...s, viewed: true } : s))
              : prev
          );

          /*
           * Und in die Datenbank. Die App las story_views bisher nur
           * (lib/daten.ts, ladeStorys) und schrieb nie hinein: der Ring wurde
           * grau, solange der Betrachter offen war, und war beim naechsten
           * Start wieder bunt.
           */
          aktion.storyGesehen(storyId, () =>
            setStories((prev) => prev.map((s) => (s.id === storyId ? { ...s, viewed: false } : s)))
          );
        }}
        onClose={() => {
          setOverlay(null);
        }}
        onDelete={() => {
          const eigene = stories.find((s) => s.own);
          const vorher = eigene ? { ...eigene } : null;
          setStories((prev) =>
            prev.map((s) =>
              s.own ? { ...s, mediaUri: undefined, aufgenommen: undefined } : s
            )
          );
          setNotice('Deine Story wurde gelöscht');
          // Und wirklich loeschen. Vorher verschwand sie nur aus dem eigenen
          // Ring und stand bei allen anderen weiter da.
          if (eigene?.id) {
            aktion.storyLoeschen(eigene.id, () =>
              setStories((prev) => prev.map((s) => (s.own && vorher ? vorher : s)))
            );
          }
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
    const zielChat = overlay.zielChat;
    return (
      <CameraScreen
        // Kam die Kamera aus einem Chat, ist das Ziel klar - dann keine Frage.
        direktZu={zielChat ? (uri) => aufnahmeInChat(zielChat, uri) : undefined}
        onClose={() => setOverlay(null)}
        onCaptured={storyAufgenommen}
        onAnChat={(uri) => {
          setOverlay(null);
          setAufnahmeFuerChat(uri);
        }}
        onAlsBeitrag={aufnahmeAlsBeitrag}
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
            autor: daten.users[clip.userId]?.name ?? 'Unbekannt',
          })
        }
        onNotice={setNotice}
      />
    );
  }

  if (overlay?.kind === 'community') {
    const community = profil.communities.find((c) => c.id === overlay.communityId);
    // Sie kann verschwunden sein, wenn man sie in der Zwischenzeit verlassen
    // hat - dann schlicht zurueck zur Liste, statt auf einer leeren Seite zu
    // stehen.
    if (!community) {
      setOverlay(null);
    } else {
      return (
        <CommunityDetailScreen
          community={community}
          onBack={() => setOverlay(null)}
          onOpenUnterthema={(ut) => oeffneUnterthema(community, ut)}
          onEinstellungen={() => setNotice(`Einstellungen zu „${community.name}“`)}
          onBeitreten={() => {
            profil.kanalBeitreten(community.id);
            setNotice(community.joined ? `„${community.name}“ verlassen` : `„${community.name}“ beigetreten`);
          }}
          onNeuesUnterthema={() =>
            setFormular({
              title: 'Neues Unterthema',
              knopf: 'Anlegen',
              felder: [
                {
                  key: 'name',
                  label: 'Name des Unterthemas',
                  platzhalter: 'z. B. Ankündigungen',
                  pflicht: true,
                },
              ],
              absenden: ({ name }) => {
                const fehler = profil.unterthemaAnlegen(community.id, name);
                if (fehler) return fehler;
                setNotice(`„${name}“ angelegt`);
                return null;
              },
            })
          }
          onNotice={setNotice}
        />
      );
    }
  }

  if (overlay?.kind === 'livestream') {
    return (
      <LivestreamScreen
        onStart={() => aktion.livestream('Livestream')}
        onEnd={(sekunden, zuschauer) => {
          // Der Stream ist vorbei — das gehoert auch ins eigene Profil,
          // sonst steht man auf der Website ewig als "live".
          aktion.livestream(null);
          profil.aufzeichnungAnlegen(sekunden, zuschauer);
          setOverlay(null);
          setArea('videos');
          setSubs((prev) => ({ ...prev, videos: 'landscape' }));
          setNotice('Livestream beendet, die Aufzeichnung steht im Querformat');
        }}
      />
    );
  }

  if (overlay?.kind === 'editSelectedContacts') {
    return (
      <EditSelectedContactsScreen
        onBack={() => setOverlay(null)}
        onNotice={setNotice}
      />
    );
  }

  if (overlay?.kind === 'avatarViewer') {
    return (
      <AvatarViewerScreen
        id={overlay.userId}
        name={overlay.name}
        onBack={() => setOverlay(null)}
      />
    );
  }

  if (overlay?.kind === 'followers') {
    return (
      <FollowersScreen
        userId={overlay.userId}
        onBack={() => setOverlay(null)}
        onOpenProfile={openPublicProfile}
        onNotice={setNotice}
      />
    );
  }

  if (overlay?.kind === 'following') {
    return (
      <FollowingScreen
        userId={overlay.userId}
        onBack={() => setOverlay(null)}
        onOpenProfile={openPublicProfile}
        onNotice={setNotice}
      />
    );
  }

  const renderContent = () => {
    if (area === 'messenger') {
      if (sub === 'friendmap') return <FriendMapScreen onOpenProfile={openProfile} onEditSelectedContacts={() => setOverlay({ kind: 'editSelectedContacts' })} onNotice={setNotice} />;
      if (sub === 'camera') {
        return (
          <CameraScreen
            embedded
            onClose={() => setSub('chats')}
            onCaptured={(uri) => {
              storyAufgenommen(uri);
              setSub('chats');
            }}
            onAnChat={setAufnahmeFuerChat}
            onAlsBeitrag={aufnahmeAlsBeitrag}
            onNotice={setNotice}
          />
        );
      }
      if (sub === 'profile') {
        return (
          <MessengerProfileScreen
            onSwitchArea={switchArea}
            onSwitchAccount={() => setSheet('konto')}
            onOpenSettings={() => { setSettingsVonBereich('messenger'); setArea('settings'); }}
            onBearbeiten={profilBearbeiten}
            onAvatarPress={() => setOverlay({ kind: 'avatarViewer', userId: 'me', name: profil.eigenesProfil.name })}
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
          onChatOptionen={setChatOptionen}
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
            onAvatarPress={() => setOverlay({ kind: 'avatarViewer', userId: 'me', name: profil.eigenesProfil.name })}
            onNotice={setNotice}
          />
        );
      }
      return <CommunitiesScreen onOpenCommunity={openCommunity} onNotice={setNotice} onCreateChannel={() => setSheet('erstellen')} />;
    }

    return (
      <SettingsScreen
        onNotice={setNotice}
        onLogout={logout}
        onSwitchAccount={() => setSheet('konto')}
        sprung={settingsSprung}
        onSprungFertig={() => setSettingsSprung(null)}
        onBack={() => {
          if (settingsVonBereich) {
            setArea(settingsVonBereich);
            setSubs((prev) => ({ ...prev, [settingsVonBereich]: 'profile' }));
            setSettingsVonBereich(null);
          }
        }}
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
      {/*
        Die Insel steht ausserhalb des Flusses, deshalb haelt der Inhalt sich
        den Platz darunter selbst frei — sonst laege der oberste Teil jedes
        Bildschirms dauerhaft dahinter. In Einstellungen gibt es keine Insel
        und damit auch keinen Abstand.
      */}
      <View style={[styles.content, hatInsel && { paddingTop: inselPlatz }]}>{renderContent()}</View>
      <TopSwitcher area={area} active={sub} onChange={setSub} zaehler={inselZaehler} />
      <TabBar active={area} onChange={wechsleBereich} unreadCount={unreadCount} />

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
      {/*
        * Die Optionen zu einem Chat. Dieselben Punkte in derselben
        * Reihenfolge wie auf der Website, das Loeschen abgesetzt.
        */}
      <ActionSheet
        visible={Boolean(chatOptionen)}
        title={chatOptionen?.name ?? ''}
        untertitel={
          chatOptionen
            ? chatOptionen.isGroup
              ? `${(chatOptionen.memberIds?.length ?? 0) + 1} Mitglieder`
              : chatOptionen.archiviert
                ? 'Im Archiv'
                : chatOptionen.muted
                  ? 'Stummgeschaltet'
                  : 'Online'
            : undefined
        }
        items={[
          {
            key: 'archiv',
            label: chatOptionen?.archiviert ? 'Aus dem Archiv holen' : 'Archivieren',
            icon: 'archive-outline',
          },
          {
            key: 'stumm',
            label: chatOptionen?.muted ? 'Stummschaltung aufheben' : 'Stummschalten',
            icon: 'volume-mute-outline',
          },
          {
            key: 'gelesen',
            label:
              (chatOptionen?.unreadCount ?? 0) > 0
                ? 'Als gelesen markieren'
                : 'Als ungelesen markieren',
            icon: 'checkmark-done-outline',
          },
          { key: 'einstellungen', label: 'Chat-Einstellungen', icon: 'settings-outline' },
          { key: 'loeschen', label: 'Chat löschen', icon: 'trash-outline', gefahr: true },
        ]}
        onSelect={(key) => {
          const chat = chatOptionen;
          setChatOptionen(null);
          if (!chat) return;

          if (key === 'einstellungen') {
            // Die Kontaktinfo ist die Chat-Einstellung — dort stehen
            // Benachrichtigungen, Sperre und Chat leeren.
            if (chat.userId) return openProfile(chat.userId);
            return setNotice('Für Gruppen gibt es die Einstellungen noch nicht');
          }
          if (key === 'loeschen') return chatLoeschen(chat);
          chatUmlegen(chat, key as 'archiv' | 'stumm' | 'gelesen');
        }}
        onClose={() => setChatOptionen(null)}
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

      {/* Dieselbe Personenauswahl, aber für eine Aufnahme aus der Kamera. */}
      <TeilenSheet
        ziel={aufnahmeFuerChat ? { art: 'post', id: 'aufnahme', titel: 'Foto', autor: 'Du' } : null}
        contacts={contacts}
        titel="An welchen Chat?"
        onClose={() => setAufnahmeFuerChat(null)}
        onSend={(userId) => {
          if (aufnahmeFuerChat) aufnahmeAnPerson(userId, aufnahmeFuerChat);
          setAufnahmeFuerChat(null);
        }}
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
          {/*
            Der DatenProvider steht zwischen Anmeldung und allem anderen: er
            braucht die Kennung des angemeldeten Nutzers, und alles darunter
            braucht die Inhalte, die er lädt.
          */}
          <DatenProvider>
            <RepostProvider>
              <ProfilProvider>
                <Root />
              </ProfilProvider>
            </RepostProvider>
          </DatenProvider>
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
