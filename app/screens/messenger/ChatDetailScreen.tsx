import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Druck } from '../../components/Druck';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { Motiv } from '../../components/Motiv';
// Henrik 7.9.: Medien im Chat als Vorschau in echter Groesse, antippen fuehrt
// ins Vollformat. Videoflaeche entscheidet an der Adresse selbst, ob ein
// Video laeuft oder ein Standbild steht.
import { Videoflaeche, istVideo } from '../../components/Videoflaeche';
import { colors, radius, shadow, sizes, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';
import { useSupabase } from '../../contexts/SupabaseContext';
import { ICH as CURRENT_USER_ID, chatZeit, ladeChatZustand, ladeKanalNachrichten, ladeNachrichten } from '../../lib/daten';
import { AnhangSheet } from '../../components/AnhangSheet';
import { CameraScreen } from './CameraScreen';
import { NachrichtSheet, NachrichtAktion } from '../../components/NachrichtSheet';
import { WeiterleitenSheet } from '../../components/WeiterleitenSheet';
import { useAktionen } from '../../lib/useAktionen';
import { useProfil } from '../../contexts/ProfilContext';
import { useEinstellungen } from '../../contexts/EinstellungenContext';
import { Chat, Contact, Message } from '../../types';
import { haptic } from '../../lib/haptics';
import { nachrichtTon } from '../../lib/toene';
// Dieselbe mm:ss-Schreibweise wie im Anrufbildschirm — sonst stuende im Chat
// eine andere Dauer als waehrend des Gespraechs.
import { dauerText } from './CallScreen';
import * as Aktion from '../../lib/aktionen';

const nowTime = () =>
  new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/**
 * Dateigroesse in etwas, das man lesen kann.
 *
 * Null Bytes heisst nicht "leere Datei", sondern "die Groesse kam nicht mit"
 * — bei manchen Quellen liefert die Auswahl sie nicht. Dann lieber nichts
 * behaupten als "0 B" hinschreiben.
 */
const groesseText = (bytes: number) => {
  if (!bytes) return 'Datei';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
};

interface Props {
  chat: Chat;
  /** Nachrichten, die ausserhalb des Chats entstanden sind (Story-Antwort). */
  extraMessages?: Message[];
  onBack: () => void;
  onCall: (kind: 'audio' | 'video') => void;
  onCamera: () => void;
  /** Kontakte fuer den Anhang "Kontakt senden". */
  contacts?: Contact[];
  onNotice?: (message: string) => void;
  /** Standort-Karte im Chat antippen. */
  onOpenStandort?: (name: string) => void;
  onOpenProfile: (userId: string) => void;
  onOpenGroupSettings?: (chatId: string) => void;
  /** Offene Kontaktanfrage annehmen. */
  /** Über eine eingegangene Anfrage entscheiden — annehmen oder ablehnen. */
  onAnfrageEntscheiden?: (chatId: string, annehmen: boolean) => void;
  /*
   * Die Messenger-Anfrage aus einem Community-Chat (Schema 57). Ob gefragt
   * werden darf, weiß die Shell — sie kennt Kontakte und Chatlisten.
   */
  messengerAnfrageMoeglich?: boolean;
  onMessengerAnfragen?: () => void;
  onMessengerAntworten?: (annehmen: boolean) => void;
  onZumMessenger?: () => void;
  /** Der frisch geladene Anfragezustand — die Shell übernimmt ihn. */
  onZustandGeladen?: (zustand: Pick<Chat, 'requestState' | 'messengerAnfrage'>) => void;
}

export const ChatDetailScreen = ({
  chat,
  extraMessages,
  onBack,
  onCall,
  onCamera,
  onOpenProfile,
  onOpenGroupSettings,
  onAnfrageEntscheiden,
  messengerAnfrageMoeglich = false,
  onMessengerAnfragen,
  onMessengerAntworten,
  onZumMessenger,
  onZustandGeladen,
  contacts = [],
  onNotice,
  onOpenStandort,
}: Props) => {
  const [anhangOffen, setAnhangOffen] = useState(false);
  const [kameraAuf, setKameraAuf] = useState(false);
  const { users: alleNutzer, ichId, communities, chats: alleChats } = useDaten();
  // „Mit Enter senden" — siehe SCHALTER_STANDARD im EinstellungenContext.
  const { an } = useEinstellungen();
  const enterSendet = an('entersenden');
  const { supabase } = useSupabase();
  const { istBlockiert, markierte, markieren } = useProfil();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>(extraMessages ?? []);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Message>>(null);
  const aktionen = useAktionen(onNotice);

  /*
   * Die Nachrichten-Werkzeuge aus dem Handbuch (01.09.2026).
   *
   * `gewaehlt` ist die Nachricht, auf der das Menue gerade offen ist.
   * `bezug` haelt fest, worauf sich die naechste Nachricht bezieht — als
   * Antwort oder als Zitat. Beides getrennt, weil eine Antwort nur den Bezug
   * anzeigt und ein Zitat den Text mitnimmt.
   * `bearbeitet` ist die Nachricht, deren Text gerade in der Eingabezeile
   * steht und beim Senden ueberschrieben wird statt neu angelegt.
   */
  const [gewaehlt, setGewaehlt] = useState<Message | null>(null);
  const [bezug, setBezug] = useState<{ art: 'antwort' | 'zitat'; nachricht: Message } | null>(null);
  const [bearbeitet, setBearbeitet] = useState<Message | null>(null);
  const [weiterleiten, setWeiterleiten] = useState<Message | null>(null);

  /*
   * Henrik 07.09.2026: „Medien im Chat nur als Icon statt Vorschau in echter
   * Groesse; gilt auch fuer Videos-Beitraege (aktuell gar nicht oeffenbar);
   * antippen → Vollformat."
   *
   * `vollbild` haelt fest, was gerade formatfuellend zu sehen ist. Ein
   * eigener Bildschirm dafuer waere zu viel: der Chat soll darunter stehen
   * bleiben, damit Zuruecktippen wieder an derselben Stelle im Verlauf
   * landet. Gleiches Verhalten auf der Website (`oeffneVollformat` in
   * web/public/app.js).
   */
  const [vollbild, setVollbild] = useState<{ id: string; uri: string } | null>(null);

  /*
   * Der Verlauf kommt aus der Datenbank, nicht aus einer Liste im Quelltext.
   *
   * Ein Chat kann aus dem Messenger kommen oder ein Unterthema einer
   * Community sein. Beide haben einen Verlauf, sie liegen nur in
   * verschiedenen Tabellen — welche es ist, steht hier fest, damit es der
   * Aufrufer nicht wissen muss.
   */
  const istKanal = communities.some((c) =>
    (c.unterthemen ?? []).some((u) => u.id === chat.id)
  );

  /*
   * "Zuletzt online". Hier stand bis zum 03.09.2026 fest das Wort "Online" —
   * bei jedem Menschen, zu jeder Zeit, ohne dass irgendwo festgehalten war,
   * wann jemand zuletzt da war.
   *
   * Bleibt leer, wenn die Person ihren Status verbirgt: die Leseregel auf
   * `presence` gibt dann keine Zeile heraus. Das sieht aus wie "war noch nie
   * da", und das ist Absicht.
   */
  const [praesenz, setPraesenz] = useState('');

  useEffect(() => {
    setPraesenz('');
    if (!supabase || chat.isGroup || !chat.userId) return;
    let abgebrochen = false;
    Aktion.praesenzLesen(supabase, chat.userId)
      .then((zeit) => {
        if (!abgebrochen) setPraesenz(Aktion.praesenzText(zeit));
      })
      .catch(() => {
        /* Kein Status ist besser als ein falscher. */
      });
    return () => {
      abgebrochen = true;
    };
  }, [supabase, chat.userId, chat.isGroup]);

  useEffect(() => {
    if (!supabase || !ichId) return;
    let abgebrochen = false;
    const holen = istKanal
      ? ladeKanalNachrichten(supabase, ichId, chat.id)
      : ladeNachrichten(supabase, chat.id, ichId);

    holen
      .then((geladen) => {
        if (!abgebrochen) setMessages([...geladen, ...(extraMessages ?? [])]);
      })
      .catch((e) => console.error('Verlauf laden fehlgeschlagen:', e?.message ?? e));

    // Der Zustand aus der Chatliste kann alt sein — siehe ladeChatZustand.
    if (!istKanal && !chat.isGroup) {
      ladeChatZustand(supabase, chat.id, ichId)
        .then((zustand) => {
          if (!abgebrochen && zustand) onZustandGeladen?.(zustand);
        })
        .catch(() => {
          /* Dann bleibt der Stand der Liste. */
        });
    }

    return () => {
      abgebrochen = true;
    };
    // extraMessages absichtlich nicht in der Liste: es ist bei jedem Aufbau
    // ein neues Feld und würde eine Endlosschleife auslösen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, ichId, chat.id, istKanal]);

  /*
   * Gelesen ist, was offen auf dem Bildschirm steht. Der Aufruf geht an
   * `chat_gelesen` (Schema 40); ob daraus wirklich eine Bestaetigung wird,
   * entscheidet die Datenbank anhand des Schalters „lesebestaetigung" des
   * Lesers — nicht dieser Bildschirm. Genau dieselbe Zeile steht auf der
   * Website, damit beide Seiten nicht auseinanderlaufen koennen.
   */
  useEffect(() => {
    if (!supabase || !ichId) return;
    Aktion.chatGelesen(supabase, chat.id).catch(() => {
      /* Eine ausgebliebene Lesebestaetigung ist nichts, womit man den
         Nutzer behelligt. */
    });
  }, [supabase, ichId, chat.id]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  // Bis die Anfrage angenommen ist, bleibt es bei der einen Nachricht, die
  // schon mit der Anfrage rausging.
  // Gesperrt ist der Chat aus zwei Gruenden: die Anfrage laeuft noch, oder
  // die Person ist blockiert.
  const blockiert = !!chat.userId && istBlockiert(chat.userId);
  /*
   * Gesperrt ist das Eingabefeld aus vier Gruenden: die eigene Anfrage
   * laeuft noch ('pending'), sie wurde abgelehnt ('declined'), die Person
   * ist blockiert, oder sie empfaengt gar keine Nachrichten. Eine
   * EINGEGANGENE Anfrage ('incoming') sperrt nicht — zurueckschreiben ist
   * erlaubt und nimmt sie damit an.
   */
  /*
   * Der vierte Grund, und der einzige, der schon beim Betreten feststeht:
   * die Person hat "Nachrichten senden" abgeschaltet (Sichtbarkeitsbereich
   * `dm`, Schema 22). Neue Chats kommen damit gar nicht erst zustande — aber
   * ein Chat, der schon da war, bleibt in der Liste stehen, und die
   * Einstellung kann jederzeit nachtraeglich gesetzt werden.
   *
   * Ohne diese Abfrage stuende ein offenes Eingabefeld da, und erst das
   * Senden liefe in eine Ablehnung aus der Datenbank.
   *
   * In Gruppen und Kanaelen gilt die Einstellung nicht (`chat.userId` ist
   * dort leer) — dasselbe wie in `darf_schreiben()`.
   */
  const [dmGesperrt, setDmGesperrt] = useState(false);

  useEffect(() => {
    if (!supabase || !ichId || !chat.userId || chat.userId === ichId) return;
    let abgebrochen = false;
    Aktion.darfAngeschriebenWerden(supabase, chat.userId, ichId)
      .then((erlaubt) => {
        if (!abgebrochen) setDmGesperrt(!erlaubt);
      })
      .catch(() => {
        /* Im Zweifel offen lassen: die Datenbank weist ohnehin ab, und ein
           gesperrtes Feld nach einem Netzfehler waere nicht erklaerbar. */
      });
    return () => {
      abgebrochen = true;
    };
  }, [supabase, ichId, chat.userId]);

  const gesperrt =
    chat.requestState === 'pending' ||
    chat.requestState === 'declined' ||
    blockiert ||
    dmGesperrt;

  /*
   * Senden.
   *
   * Hier stand bis zum 31.08.2026 eine Antwort, die sich der Chat selbst gab:
   * nach 1,4 Sekunden schrieb „Anna" von allein zurück (lib/antworten.ts).
   * Das ging nur, solange der Verlauf im Arbeitsspeicher lag. Jetzt steht er
   * in der Datenbank, und dort kann niemand eine Nachricht in fremdem Namen
   * einstellen — die Regeln lassen nur `sender_id = ich` zu. Das ist richtig
   * so: Anna ist kein Mensch, der antworten könnte.
   */
  const send = async () => {
    const text = draft.trim();
    if (!text || gesperrt || !supabase || !ichId) return;
    /*
     * Der Sendeton. „Toene" aus den Einstellungen war bis zum 17.09.2026 ohne
     * Wirkung, weil es ueberhaupt keinen Ton gab (Audit vom 17.09.2026,
     * Befund 1). `lib/toene.ts` schweigt von selbst, wenn der Schalter aus
     * ist. Gleiche Regel in web/public/app.js (sendMessage).
     */
    nachrichtTon();

    /*
     * Bearbeiten laeuft ueber denselben Knopf wie Senden.
     *
     * Ein eigener "Speichern"-Knopf waere ein zweiter Zustand der
     * Eingabezeile, den man erst begreifen muss. Solange oben "Nachricht
     * bearbeiten" steht, ueberschreibt der Sendeknopf — das ist die
     * naheliegende Erwartung.
     */
    if (bearbeitet) {
      const alt = bearbeitet;
      setBearbeitet(null);
      setDraft('');
      setMessages((prev) =>
        prev.map((m) => (m.id === alt.id ? { ...m, text, bearbeitet: true } : m))
      );
      await aktionen.nachrichtBearbeiten(alt.id, text, () =>
        setMessages((prev) => prev.map((m) => (m.id === alt.id ? alt : m)))
      );
      return;
    }

    haptic.success();
    setDraft('');

    /*
     * Geschrieben wird ueber lib/aktionen.ts. Hier stand die Abfrage frueher
     * ausgeschrieben — und beim Anhang weiter unten ein zweites Mal, mit
     * einer anderen Spaltenliste. Zwei Stellen, die dasselbe tun sollen,
     * laufen irgendwann auseinander; die Website hat dafuer auch nur eine.
     */
    let data;
    try {
      // Ein Unterthema einer Community ist kein gewoehnlicher Chat: seine
      // Nachrichten stehen in einer eigenen Tabelle. Gelesen wurde von dort
      // schon immer (ladeKanalNachrichten oben), geschrieben bis hierher
      // nicht — das Geschriebene war beim naechsten Oeffnen weg.
      data = istKanal
        ? await Aktion.kanalNachricht(supabase, ichId, chat.id, text)
        : await Aktion.nachrichtSenden(supabase, ichId, chat.id, text, {
            antwortAuf: bezug?.art === 'antwort' ? bezug.nachricht.id : null,
            zitatVon: bezug?.art === 'zitat' ? bezug.nachricht.id : null,
          });
    } catch (e: any) {
      console.error('Nachricht senden fehlgeschlagen:', e?.message ?? e);
      onNotice?.('Die Nachricht ging nicht raus');
      setDraft(text);
      return;
    }

    const bezugText = bezug
      ? {
          id: bezug.nachricht.id,
          text: bezug.nachricht.text,
          autor:
            bezug.nachricht.senderId === CURRENT_USER_ID
              ? 'Du'
              : alleNutzer[bezug.nachricht.senderId]?.name ?? '',
        }
      : undefined;

    setMessages((prev) => [
      ...prev,
      {
        id: data.id,
        chatId: chat.id,
        senderId: CURRENT_USER_ID,
        text,
        time: chatZeit(data.created_at),
        read: false,
        antwortAuf: bezug?.art === 'antwort' ? bezugText : undefined,
        zitat: bezug?.art === 'zitat' ? bezugText : undefined,
      },
    ]);
    setBezug(null);
    scrollToEnd();
  };

  /*
   * Was das Menue an einer Nachricht ausloest.
   *
   * Alles laeuft ueber lib/useAktionen.ts, also mit Rueckweg: schaltet die
   * Anzeige um und stellt sie zurueck, wenn das Schreiben scheitert. Eine
   * Blase, die "bearbeitet" zeigt, obwohl in der Datenbank der alte Text
   * steht, waere schlimmer als gar keine Aenderung.
   */
  const nachrichtAktion = async (was: NachrichtAktion) => {
    const m = gewaehlt;
    setGewaehlt(null);
    if (!m) return;

    if (was === 'antworten') return setBezug({ art: 'antwort', nachricht: m });
    if (was === 'zitieren') return setBezug({ art: 'zitat', nachricht: m });
    if (was === 'weiterleiten') return setWeiterleiten(m);

    if (was === 'bearbeiten') {
      setBearbeitet(m);
      setDraft(m.text);
      return;
    }

    if (was === 'markieren') {
      const jetzt = markieren(m.id);
      return onNotice?.(jetzt ? 'Nachricht markiert' : 'Markierung entfernt');
    }

    if (was === 'zuruecknehmen') {
      const vorher = messages;
      setMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, text: '', zurueckgenommen: true } : x))
      );
      await aktionen.nachrichtZuruecknehmen(m.id, () => setMessages(vorher));
    }
  };

  /** Eine Reaktion setzen, wechseln oder wegnehmen. */
  const reaktionSetzen = async (emoji: string) => {
    const m = gewaehlt;
    setGewaehlt(null);
    if (!m) return;

    const vorher = messages;
    const bisher = (m.reaktionen ?? []).find((r) => r.userId === CURRENT_USER_ID)?.emoji;
    const ohneMich = (m.reaktionen ?? []).filter((r) => r.userId !== CURRENT_USER_ID);
    const neu =
      bisher === emoji ? ohneMich : [...ohneMich, { userId: CURRENT_USER_ID, emoji }];

    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, reaktionen: neu } : x)));
    await aktionen.nachrichtReaktion(m.id, emoji, () => setMessages(vorher));
  };

  const tagTrenner = (() => {
    const erste = messages[0];
    if (!erste?.time) return 'Heute';
    return /^\d{1,2}:\d{2}$/.test(erste.time.trim()) ? 'Heute' : erste.time;
  })();

  const renderMessage = ({ item }: { item: Message }) => {
    const out = item.senderId === CURRENT_USER_ID;
    const sender = alleNutzer[item.senderId];
    // Der Anhang, den es wirklich zu sehen gibt (Henrik 7.9.): frisch vom
    // Geraet oder vom Server. Ohne Adresse bleibt es beim grauen Kaestchen —
    // eine Sprachnachricht hat kein Bild.
    const anhang =
      item.bildUri ??
      (item.mediaUrl && item.media !== 'audio' && item.media !== 'file'
        ? item.mediaUrl
        : undefined);

    /*
     * Henrik 07.09.2026: „Anrufe sollen als Chatnachricht protokolliert werden
     * (wie WhatsApp)."
     *
     * Der Eintrag ist keine Blase, sondern eine Zeile in der Mitte — wie bei
     * WhatsApp. Eine Sprechblase wuerde behaupten, jemand haette etwas
     * geschrieben. Gleiche Darstellung auf der Website (paintMessages).
     */
    if (item.anruf) {
      const verpasst = item.anruf.status !== 'beendet';
      return (
        <View style={styles.anruf}>
          <Ionicons
            name={item.anruf.art === 'video' ? 'videocam-outline' : 'call-outline'}
            size={14}
            color={verpasst ? colors.danger : colors.text2}
          />
          <Text style={[styles.anrufText, verpasst && styles.anrufVerpasst]}>
            {out ? 'Ausgehender ' : ''}
            {item.anruf.art === 'video' ? 'Videoanruf' : 'Anruf'}
            {verpasst
              ? item.anruf.status === 'abgelehnt'
                ? ' · abgelehnt'
                : ' · verpasst'
              : ` · ${dauerText(item.anruf.dauer)}`}
            {' · '}
            {item.time}
          </Text>
        </View>
      );
    }

    return (
      // Lange druecken markiert eine Nachricht mit einem Stern - so fuellt
      // sich "Mit Stern markiert" in der Kontaktinfo wirklich.
      <Druck
        style={[
          styles.bubble,
          out ? styles.bubbleOut : styles.bubbleIn,
          item.media === 'sticker' && styles.bubbleSticker,
        ]}
        onLongPress={() => {
          haptic.medium();
          // Bis zum 01.09.2026 setzte langes Druecken nur einen Stern. Jetzt
          // steht dahinter das ganze Menue aus dem Handbuch — der Stern ist
          // einer von sechs Punkten.
          setGewaehlt(item);
        }}
        delayLongPress={450}
      >
        {!out && chat.isGroup && <Text style={styles.sender}>{sender?.name ?? 'Unbekannt'}</Text>}

        {/* Weitergeleitet: ohne diese Zeile saehe sie aus wie selbst geschrieben. */}
        {item.weitergeleitetVon ? (
          <View style={styles.weiter}>
            <Ionicons name="arrow-redo-outline" size={12} color={colors.text3} />
            <Text style={styles.weiterText}>Weitergeleitet von {item.weitergeleitetVon}</Text>
          </View>
        ) : null}

        {/*
          * Antwort und Zitat sehen verschieden aus, weil sie verschiedenes
          * sind: die Antwort zeigt nur den Bezug an (schmaler Balken, eine
          * Zeile), das Zitat nimmt den Text mit und bleibt lesbar, auch wenn
          * das Original zurueckgenommen wird.
          */}
        {item.antwortAuf ? (
          <View style={styles.bezug}>
            <View style={styles.bezugBalken} />
            <View style={styles.bezugText}>
              <Text style={styles.bezugAutor}>{item.antwortAuf.autor}</Text>
              <Text style={styles.bezugZeile} numberOfLines={1}>
                {item.antwortAuf.text || 'Zurückgenommen'}
              </Text>
            </View>
          </View>
        ) : null}

        {item.zitat ? (
          <View style={styles.zitat}>
            <Text style={styles.zitatAutor}>{item.zitat.autor} schrieb:</Text>
            <Text style={styles.zitatText}>„{item.zitat.text}"</Text>
          </View>
        ) : null}

        {anhang ? (
          /*
           * Der Anhang in echter Groesse (Henrik 7.9.). `bildUri` ist der
           * gerade aufgenommene Anhang vom Geraet, `mediaUrl` derselbe Anhang
           * beim naechsten Laden — beide werden gleich dargestellt, sonst
           * saehe die eigene Nachricht nach dem Neuladen anders aus als
           * beim Senden.
           */
          <Druck onPress={() => setVollbild({ id: item.id, uri: anhang })}>
            <Videoflaeche
              id={item.id}
              quelle={anhang}
              laeuft={false}
              stumm
              fuellen="cover"
              style={styles.anhangBild}
            />
            {istVideo(anhang) ? (
              <View style={styles.anhangPlay}>
                <Ionicons name="play" size={20} color={colors.white} />
              </View>
            ) : null}
          </Druck>
        ) : item.story ? (
          /*
           * Der Bezug auf eine Story — ein Herz darauf oder eine Antwort
           * (Henrik 18.09., Schema 41).
           *
           * Der Text muss darunter stehen bleiben. Diese Kette ist
           * ausschliessend: bis zum 18.09.2026 endete der Zweig mit dem Bild,
           * und bei einer Story-Antwort verschwand damit genau das, was
           * geschrieben worden war. Beim Herz waere das Emoji weggefallen und
           * uebrig geblieben ein Bild ohne erkennbaren Grund.
           */
          <View>
            <View style={styles.storyContainer}>
              {item.story.mediaUri ? (
                <Image source={{ uri: item.story.mediaUri }} style={styles.anhangBild} />
              ) : (
                <Motiv id={item.story.id} icon="image-outline" iconSize={20} style={styles.anhangBild} />
              )}
              <View style={styles.storyBadge}>
                <Ionicons name="albums" size={13} color={colors.white} />
                <Text style={styles.storyBadgeText}>Story</Text>
              </View>
            </View>
            {item.text ? (
              <Text style={[styles.messageText, styles.storyText, out && styles.messageTextOut]}>
                {item.text}
              </Text>
            ) : null}
          </View>
        ) : item.standort ? (
          <Druck style={styles.ortKarte} onPress={() => onOpenStandort?.(item.standort!.name)}>
            <View style={styles.ortBild}>
              <View style={[styles.ortNadel, { left: `${item.standort.x ?? 50}%`, top: `${item.standort.y ?? 50}%` }]}>
                <Ionicons name="location" size={22} color={colors.danger} />
              </View>
            </View>
            <Text style={styles.ortName}>{item.standort.name}</Text>
            <Text style={styles.ortSub} numberOfLines={1}>
              {item.standort.adresse ?? item.standort.koordinaten}
            </Text>
          </Druck>
        ) : item.kontakt ? (
          <Druck style={styles.kontaktKarte} onPress={() => onOpenProfile(item.kontakt!.id)}>
            <Avatar id={item.kontakt.id} name={item.kontakt.name} size={sizes.avatarMd} />
            <View style={styles.kontaktText}>
              <Text style={styles.kontaktName}>{item.kontakt.name}</Text>
              <Text style={styles.kontaktHandle}>{item.kontakt.handle}</Text>
            </View>
          </Druck>
        ) : item.geteilt ? (
          /*
           * Ein geteilter Beitrag (Henrik 7.9.). Bis dahin war das eine
           * Zeile mit einem grauen Kaestchen daneben und liess sich nicht
           * oeffnen — ein weitergeleitetes Video war damit im Chat nichts
           * weiter als sein Titel. Jetzt steht der Beitrag selbst da und
           * geht beim Antippen ins Vollformat.
           */
          <Druck
            style={styles.geteiltKarte}
            onPress={() =>
              item.geteilt?.bild
                ? setVollbild({ id: item.geteilt.id, uri: item.geteilt.bild })
                : onNotice?.('Zu diesem Beitrag gibt es keine Datei')
            }
          >
            <Videoflaeche
              id={item.geteilt.id}
              quelle={item.geteilt.bild}
              laeuft={false}
              stumm
              icon={item.geteilt.art === 'video' ? 'play' : 'image-outline'}
              iconSize={20}
              fuellen="cover"
              style={styles.anhangBild}
            />
            <View style={styles.geteiltZeile}>
              <Ionicons
                name={item.geteilt.art === 'video' ? 'play-circle-outline' : 'image-outline'}
                size={16}
                color={colors.text3}
              />
              <View style={styles.geteiltText}>
                <Text style={styles.geteiltAutor} numberOfLines={1}>
                  {item.geteilt.autor}
                </Text>
                <Text style={styles.geteiltTitel} numberOfLines={1}>
                  {item.geteilt.titel}
                </Text>
              </View>
            </View>
          </Druck>
        ) : item.media === 'sticker' ? (
          /*
           * Ein Sticker steht ohne Blase und ohne Rahmen da — sonst waere er
           * nur ein sehr grosses Zeichen in einer Nachricht. Die Blase selbst
           * wird darum in `bubble` durchsichtig geschaltet.
           */
          <Text style={styles.sticker}>{item.text}</Text>
        ) : item.media === 'file' ? (
          <View style={styles.datei}>
            <View style={styles.dateiSymbol}>
              <Ionicons name="document-text-outline" size={20} color={colors.white} />
            </View>
            <View style={styles.dateiText}>
              <Text style={styles.dateiName} numberOfLines={1}>
                {item.datei?.name ?? item.text}
              </Text>
              {/* Ohne Groesse weiss niemand, ob das Antippen zwei Sekunden
                  oder zwei Minuten Mobilfunk kostet. */}
              <Text style={styles.dateiGroesse}>{groesseText(item.datei?.groesse ?? 0)}</Text>
            </View>
          </View>
        ) : item.media ? (
          <View style={styles.media}>
            <Ionicons
              name={
                item.media === 'image'
                  ? 'image-outline'
                  : item.media === 'gif'
                    ? 'film-outline'
                    : item.media === 'video'
                      ? 'videocam-outline'
                      : 'mic-outline'
              }
              size={18}
              color={colors.text2}
            />
            <Text style={styles.mediaText}>
              {item.media === 'image'
                ? 'Foto'
                : item.media === 'gif'
                  ? 'Gif'
                  : item.media === 'video'
                    ? 'Video'
                    : 'Sprachnachricht · 0:14'}
            </Text>
          </View>
        ) : item.zurueckgenommen ? (
          /*
           * Die Zeile bleibt stehen. Sie ganz verschwinden zu lassen waere
           * bequemer, aber dann verloeren Antworten und Zitate ihren Bezug —
           * und die Gegenseite fragte sich, ob sie sich das Gelesene
           * eingebildet hat.
           */
          <Text style={styles.zurueck}>Diese Nachricht wurde zurückgenommen</Text>
        ) : (
          <Text style={[styles.messageText, out && styles.messageTextOut]}>{item.text}</Text>
        )}

        <View style={styles.bubbleFoot}>
          {markierte.includes(item.id) && <Ionicons name="star" size={12} color="#F5A524" />}
          {/* "bearbeitet" muss dastehen. Eine stille Aenderung ist schlimmer
              als gar keine: das Gegenueber erinnert sich an einen anderen
              Text und findet ihn nicht wieder. */}
          {item.bearbeitet && !item.zurueckgenommen ? (
            <Text style={[styles.time, out && styles.timeOut]}>bearbeitet ·</Text>
          ) : null}
          <Text style={[styles.time, out && styles.timeOut]}>{item.time}</Text>
          {/* Ein Haken heisst zugestellt, zwei heissen gelesen. Vorher stand
              hier immer der doppelte — also „gelesen" fuer etwas, das nie
              jemand gelesen hatte. */}
          {out && (
            <Ionicons
              name={item.read ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={colors.bubbleOutMeta}
            />
          )}
        </View>

        {/* Reaktionen haengen unten an der Blase, nicht darin — sonst
            waeren sie Teil des Textes. */}
        {item.reaktionen?.length ? (
          <View style={styles.reaktionen}>
            {Object.entries(
              item.reaktionen.reduce<Record<string, number>>((zaehler, r) => {
                zaehler[r.emoji] = (zaehler[r.emoji] ?? 0) + 1;
                return zaehler;
              }, {})
            ).map(([emoji, anzahl]) => (
              <View key={emoji} style={styles.reaktion}>
                <Text style={styles.reaktionEmoji}>{emoji}</Text>
                {anzahl > 1 && <Text style={styles.reaktionZahl}>{anzahl}</Text>}
              </View>
            ))}
          </View>
        ) : null}
      </Druck>
    );
  };

  /**
   * Einen Anhang wegschicken — aus dem Anhang-Blatt oder aus der Kamera.
   *
   * Stand bis zum 20.09.2026 mitten im JSX. Die Kamera braucht denselben
   * Weg, und zweimal derselbe Rumpf waere zweimal dieselbe Pflege.
   */
  const anhangSenden = async (
    { ortId, personId, dateiName, dateiGroesse, ...teil }: Partial<Message> & {
      text: string;
      ortId?: string;
      personId?: string;
      dateiName?: string;
      dateiGroesse?: number;
    }
  ) => {
    /*
     * Ein Anhang gehört in die Datenbank, nicht nur in den Bildschirm.
     *
     * Bis zum 01.09.2026 landete er ausschließlich im Arbeitsspeicher:
     * nach dem nächsten Start war er weg, und in der Website tauchte er
     * nie auf. Gespeichert wird der Bezug (place_id, contact_user_id) —
     * die Karte baut die Oberfläche daraus.
     */
    let id = `m${Date.now()}`;
    if (supabase && ichId) {
      try {
        /*
         * Im Unterthema einer Community fuehrt derselbe Weg ins Leere.
         *
         * `messages.chat_id` zeigt auf `chats`; eine Kanal-Kennung
         * steht dort nicht, und die Regel „Nachricht senden" verlangt
         * eine Mitgliedschaft in genau diesem Chat. Bis zum 04.09.2026
         * ging deshalb jeder Anhang im Kanal mit 42501 zurueck — der
         * Text nahm die richtige Abzweigung (kanalNachricht), der
         * Anhang nicht.
         */
        const anhang = {
          typ: teil.media ?? null,
          standortId: ortId ?? null,
          kontaktId: personId ?? null,
          dateiName: dateiName ?? null,
          dateiGroesse: dateiGroesse ?? null,
        };
        const data = istKanal
          ? await Aktion.kanalNachricht(supabase, ichId, chat.id, teil.text ?? '', anhang)
          : await Aktion.nachrichtSenden(supabase, ichId, chat.id, teil.text ?? '', anhang);
        id = data.id;
      } catch (e: any) {
        console.error('Anhang senden fehlgeschlagen:', e?.message ?? e);
        onNotice?.('Der Anhang ging nicht raus');
        return;
      }
    }

    setMessages((prev) => [
      ...prev,
      { id, chatId: chat.id, senderId: CURRENT_USER_ID, time: nowTime(), ...teil },
    ]);
    scrollToEnd();
  };

  return (
    // Vollbild bis in die Ecken; Kopf- und Eingabezeile halten sich den Platz
    // fuer Notch und Home-Anzeige selbst frei.
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Druck style={styles.headerBack} onPress={onBack} hitSlop={6} accessibilityLabel="Zurück">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Druck>
        <Avatar id={chat.userId ?? chat.id} name={chat.name} size={sizes.avatarSm} group={chat.isGroup} />
        <Druck
          style={styles.headerBody}
          onPress={() => {
            if (!chat.isGroup && chat.userId) {
              onOpenProfile(chat.userId);
            }
          }}
          onLongPress={() => {
            if (chat.isGroup) {
              onOpenGroupSettings?.(chat.id);
            }
          }}
          delayLongPress={500}
          disabled={!chat.userId && !chat.isGroup}
        >
          <Text style={styles.headerName} numberOfLines={1}>
            {chat.name}
          </Text>
          <Text style={[styles.headerStatus, chat.isGroup && styles.headerStatusMuted]}>
            {chat.isGroup
              ? `${((chat.memberIds?.length ?? 0) + 1).toLocaleString('de-DE')} Mitglieder`
              : praesenz}
          </Text>
        </Druck>
        <Druck style={styles.headerAction} onPress={() => onCall('video')} hitSlop={4}>
          <Ionicons name="videocam-outline" size={22} color={colors.text2} />
        </Druck>
        <Druck style={styles.headerAction} onPress={() => onCall('audio')} hitSlop={4}>
          <Ionicons name="call-outline" size={20} color={colors.text2} />
        </Druck>
        {/* Leerraum, damit der Name wirklich in der Mitte des Kopfes steht —
            siehe headerAusgleich. */}
        <View style={styles.headerAusgleich} pointerEvents="none" />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={listRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          onContentSizeChange={scrollToEnd}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.dayDivider}>
              {/*
                Stand hier immer "Heute" - auch wenn darunter jede Nachricht
                "Gestern" trug. Jetzt aus der Zeitangabe der ersten Nachricht:
                eine Uhrzeit heisst heute, alles andere steht selbst da.
                Gleiche Regel auf der Website (paintMessages).
              */}
              <Text style={styles.dayDividerText}>{tagTrenner}</Text>
            </View>
          }
        />

        {blockiert && (
          <View style={styles.anfrage}>
            <Text style={styles.anfrageText}>
              {chat.name} ist blockiert. Hebe die Blockierung im Profil auf, um wieder zu schreiben.
            </Text>
          </View>
        )}

        {dmGesperrt && !blockiert && (
          <View style={styles.anfrage}>
            <Text style={styles.anfrageText}>
              {chat.name} empfängt keine Nachrichten. Was hier steht, bleibt
              lesbar — schreiben kannst du nicht mehr.
            </Text>
          </View>
        )}

        {/*
          * Die drei Zustaende einer Chat-Anfrage.
          *
          * Hier stand bis zum 03.09.2026 ein Knopf „Annahme simulieren" — im
          * Chat des ABSENDERS. Er nahm die eigene Anfrage an. Wer
          * angeschrieben wurde, sah davon nichts und hatte keine Wahl.
          */}
        {chat.requestState === 'pending' && !blockiert && (
          <View style={styles.anfrage}>
            <Text style={styles.anfrageText}>
              Deine Anfrage läuft noch. Weitere Nachrichten sind möglich,
              sobald {chat.name} sie angenommen hat.
            </Text>
          </View>
        )}

        {chat.requestState === 'declined' && !blockiert && (
          <View style={styles.anfrage}>
            <Text style={styles.anfrageText}>
              {chat.name} hat deine Anfrage abgelehnt. In diesem Chat kannst du
              nicht mehr schreiben.
            </Text>
          </View>
        )}

        {chat.requestState === 'incoming' && !blockiert && (
          <View style={styles.anfrage}>
            <Text style={styles.anfrageText}>
              {chat.name} möchte dir schreiben. Bis du entscheidest, bleibt es
              bei dieser einen Nachricht.
            </Text>
            <View style={styles.anfrageKnoepfe}>
              <Druck
                style={styles.anfrageBtn}
                onPress={() => onAnfrageEntscheiden?.(chat.id, true)}
              >
                <Text style={styles.anfrageBtnText}>Annehmen</Text>
              </Druck>
              <Druck
                style={[styles.anfrageBtn, styles.anfrageBtnAus]}
                onPress={() => onAnfrageEntscheiden?.(chat.id, false)}
              >
                <Text style={[styles.anfrageBtnText, styles.anfrageBtnTextAus]}>Ablehnen</Text>
              </Druck>
            </View>
          </View>
        )}

        {/*
          * Die Messenger-Anfrage (Feedback 21.09., Kasten 3).
          *
          * Fragen lässt sich erst, wenn beide hier geschrieben haben — „nach
          * etwas Austausch". Dieselbe Bedingung prüft Schema 57; hier steht
          * sie nur, damit kein Knopf erscheint, der dann abgewiesen wird.
          * Gleiche Leiste auf der Website (messengerLeiste).
          */}
        {!blockiert && !dmGesperrt && messengerAnfrageMoeglich &&
          (chat.messengerAnfrage ?? 'keine') === 'keine' &&
          messages.some((m) => m.senderId === CURRENT_USER_ID) &&
          messages.some((m) => m.senderId !== CURRENT_USER_ID && m.senderId === chat.userId) && (
          <View style={styles.anfrage}>
            <Text style={styles.anfrageText}>
              Ihr schreibt euch unter Communitys. Möchtest du {chat.name} fragen,
              ob ihr in den Messenger wechselt?
            </Text>
            <View style={styles.anfrageKnoepfe}>
              <Druck style={styles.anfrageBtn} onPress={() => onMessengerAnfragen?.()}>
                <Text style={styles.anfrageBtnText}>Messenger-Anfrage senden</Text>
              </Druck>
            </View>
          </View>
        )}

        {chat.messengerAnfrage === 'gesendet' && !blockiert && (
          <View style={styles.anfrage}>
            <Text style={styles.anfrageText}>
              Deine Messenger-Anfrage an {chat.name} läuft. Bis zur Antwort
              schreibt ihr hier weiter.
            </Text>
          </View>
        )}

        {chat.messengerAnfrage === 'eingegangen' && !blockiert && (
          <View style={styles.anfrage}>
            <Text style={styles.anfrageText}>
              {chat.name} möchte mit dir in den Messenger wechseln. Lehnst du ab,
              bleibt alles hier unter Communitys.
            </Text>
            <View style={styles.anfrageKnoepfe}>
              <Druck style={styles.anfrageBtn} onPress={() => onMessengerAntworten?.(true)}>
                <Text style={styles.anfrageBtnText}>Annehmen</Text>
              </Druck>
              <Druck
                style={[styles.anfrageBtn, styles.anfrageBtnAus]}
                onPress={() => onMessengerAntworten?.(false)}
              >
                <Text style={[styles.anfrageBtnText, styles.anfrageBtnTextAus]}>Ablehnen</Text>
              </Druck>
            </View>
          </View>
        )}

        {chat.messengerAnfrage === 'abgelehnt' && !blockiert && (
          <View style={styles.anfrage}>
            <Text style={styles.anfrageText}>
              {chat.name} bleibt lieber hier unter Communitys. Schreiben könnt
              ihr weiter wie bisher.
            </Text>
          </View>
        )}

        {chat.messengerAnfrage === 'angenommen' && !blockiert && (
          <View style={styles.anfrage}>
            <Text style={styles.anfrageText}>
              Ihr seid jetzt auch im Messenger verbunden.
            </Text>
            <View style={styles.anfrageKnoepfe}>
              <Druck style={styles.anfrageBtn} onPress={() => onZumMessenger?.()}>
                <Text style={styles.anfrageBtnText}>Zum Messenger</Text>
              </Druck>
            </View>
          </View>
        )}

        {/*
          * Worauf sich die naechste Nachricht bezieht — oder welche gerade
          * bearbeitet wird. Ohne diese Zeile tippt man in eine Eingabe, die
          * sich unsichtbar anders verhaelt als sonst.
          */}
        {(bezug || bearbeitet) && (
          <View style={styles.bezugLeiste}>
            <View style={styles.bezugBalken} />
            <View style={styles.bezugText}>
              <Text style={styles.bezugAutor}>
                {bearbeitet
                  ? 'Nachricht bearbeiten'
                  : bezug?.art === 'zitat'
                    ? 'Zitieren'
                    : 'Antworten'}
              </Text>
              <Text style={styles.bezugZeile} numberOfLines={1}>
                {(bearbeitet ?? bezug?.nachricht)?.text || 'Anhang'}
              </Text>
            </View>
            <Druck
              hitSlop={8}
              onPress={() => {
                if (bearbeitet) setDraft('');
                setBearbeitet(null);
                setBezug(null);
              }}
            >
              <Ionicons name="close" size={20} color={colors.text2} />
            </Druck>
          </View>
        )}

        <View style={[styles.composer, { paddingBottom: 8 + insets.bottom }]}>
          <Druck
            style={styles.composerIcon}
            onPress={() =>
              gesperrt
                ? onNotice?.(
                    blockiert
                      ? 'Diese Person ist blockiert'
                      : dmGesperrt
                        ? `${chat.name} empfängt keine Nachrichten`
                        : 'Warte, bis die Anfrage angenommen wurde'
                  )
                : setAnhangOffen(true)
            }
            hitSlop={4}
          >
            <Ionicons name="add" size={24} color={colors.text2} />
          </Druck>
          <View style={styles.composerField}>
            <TextInput
              style={styles.composerInput}
              value={draft}
              onChangeText={setDraft}
              placeholder={
                blockiert
                  ? 'Blockiert'
                  : dmGesperrt
                    ? 'Empfängt keine Nachrichten'
                    : gesperrt
                      ? 'Warten auf Annahme …'
                      : 'Nachricht'
              }
              placeholderTextColor={colors.text3}
              editable={!gesperrt}
              multiline
              /*
               * „Mit Enter senden" aus den Einstellungen. Der Schalter war
               * bis zum 17.09.2026 ohne Wirkung: die Eingabe kannte nur die
               * neue Zeile (Audit vom 17.09.2026, Befund 1). Bei
               * mehrzeiligen Feldern schickt `submitBehavior="submit"` in RN
               * 0.86 ein Absende-Ereignis statt eines Zeilenumbruchs.
               * Gleiche Regel in web/public/app.js (keydown am Composer).
               */
              submitBehavior={enterSendet ? 'submit' : 'newline'}
              returnKeyType={enterSendet ? 'send' : 'default'}
              onSubmitEditing={enterSendet ? () => send() : undefined}
            />
            <Druck style={styles.composerIcon} onPress={onCamera} hitSlop={4} accessibilityLabel="Kamera">
              <Ionicons name="camera-outline" size={21} color={colors.text2} />
            </Druck>
          </View>
          <Druck
            style={[styles.send, (!draft.trim() || gesperrt) && styles.sendDisabled]}
            onPress={send}
            disabled={!draft.trim() || gesperrt}
            accessibilityLabel="Senden"
          >
            <Ionicons name="send" size={17} color={colors.white} />
          </Druck>
        </View>
      </KeyboardAvoidingView>

      <NachrichtSheet
        visible={!!gewaehlt}
        eigene={gewaehlt?.senderId === CURRENT_USER_ID}
        markiert={!!gewaehlt && markierte.includes(gewaehlt.id)}
        reaktion={
          (gewaehlt?.reaktionen ?? []).find((r) => r.userId === CURRENT_USER_ID)?.emoji ?? null
        }
        onAktion={nachrichtAktion}
        onReaktion={reaktionSetzen}
        onClose={() => setGewaehlt(null)}
      />

      <WeiterleitenSheet
        visible={!!weiterleiten}
        chats={alleChats}
        ausserId={chat.id}
        onClose={() => setWeiterleiten(null)}
        onWeiterleiten={async (chatIds) => {
          const m = weiterleiten;
          setWeiterleiten(null);
          if (!m) return;
          const anzahl = await aktionen.nachrichtWeiterleiten(m.id, chatIds);
          if (anzahl) {
            onNotice?.(`An ${anzahl} ${anzahl === 1 ? 'Chat' : 'Chats'} weitergeleitet`);
          }
        }}
      />

      <AnhangSheet
        visible={anhangOffen}
        contacts={contacts}
        ausserId={chat.userId}
        ohne={istKanal ? ['standortAnfragen'] : []}
        onClose={() => setAnhangOffen(false)}
        onKamera={() => setKameraAuf(true)}
        onStandortAnfragen={async () => {
          if (!chat.userId) return onNotice?.('In einer Gruppe geht das nicht');
          const id = await aktionen.standortAnfragen(chat.id, chat.userId);
          if (id) onNotice?.(`Standort bei ${chat.name} angefragt`);
        }}
        onAnhang={anhangSenden}
        onNotice={(text) => onNotice?.(text)}
      />

      {/*
        Die eigene Kamera aus dem Anhang-Blatt heraus.

        `direktZu` heisst: das Ziel steht fest. Wer im Chat auf "Foto
        aufnehmen" tippt, hat gerade gesagt, wohin die Aufnahme soll — die
        Frage "Was moechtest du damit machen" danach waere eine Rueckfrage
        nach etwas Gesagtem.
      */}
      <Modal
        visible={kameraAuf}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setKameraAuf(false)}
      >
        <CameraScreen
          onClose={() => setKameraAuf(false)}
          direktZu={(uri) => {
            setKameraAuf(false);
            void anhangSenden({ text: 'Foto', media: 'image', bildUri: uri });
          }}
          onNotice={(text) => onNotice?.(text)}
        />
      </Modal>

      {/*
        Das Vollformat (Henrik 7.9.). Ein Bild steht ganz da — `contain`, nicht
        `cover`: beschnitten waere es nicht mehr das Vollformat. Ein Video
        laeuft sofort und mit Ton; wer es nur kurz ansehen will, tippt auf das
        Kreuz, und der Verlauf steht unveraendert darunter.
      */}
      <Modal
        visible={!!vollbild}
        animationType="fade"
        transparent={false}
        statusBarTranslucent
        onRequestClose={() => setVollbild(null)}
      >
        <View style={styles.vollbild}>
          {vollbild ? (
            <Videoflaeche
              id={vollbild.id}
              quelle={vollbild.uri}
              laeuft={istVideo(vollbild.uri)}
              stumm={false}
              schleife
              fuellen="contain"
              dunkel
              style={styles.vollbildFlaeche}
            />
          ) : null}
          <Druck
            style={[styles.vollbildZu, { top: insets.top + spacing.sm }]}
            onPress={() => setVollbild(null)}
          >
            <Ionicons name="close" size={24} color={colors.white} />
          </Druck>
        </View>
      </Modal>
    </View>
  );
};

const styles = themenStyles((colors) => ({
  bubbleSticker: { backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0 },
  sticker: { fontSize: 54, lineHeight: 62 },
  datei: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateiSymbol: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateiText: { flex: 1 },
  dateiName: { ...typography.name, color: colors.text },
  dateiGroesse: { ...typography.tiny, color: colors.text3 },

  /* --- Nachrichten-Werkzeuge, Handbuch-Abgleich 01.09.2026 --- */
  weiter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  weiterText: { ...typography.tiny, color: colors.text3, fontStyle: 'italic' },
  bezug: { flexDirection: 'row', gap: spacing.sm, marginBottom: 5 },
  bezugBalken: { width: 3, borderRadius: 2, backgroundColor: colors.brand },
  bezugText: { flex: 1 },
  bezugAutor: { ...typography.tiny, color: colors.brand },
  bezugZeile: { ...typography.small, color: colors.text2 },
  zitat: {
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
    marginBottom: 5,
  },
  zitatAutor: { ...typography.tiny, color: colors.text3 },
  zitatText: { ...typography.small, color: colors.text2, fontStyle: 'italic' },
  zurueck: { ...typography.message, color: colors.text3, fontStyle: 'italic' },
  reaktionen: { flexDirection: 'row', gap: 4, marginTop: 5 },
  reaktion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface3,
  },
  reaktionEmoji: { fontSize: 13 },
  reaktionZahl: { ...typography.tiny, color: colors.text2 },
  bezugLeiste: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface2,
  },

  anfrage: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
    gap: spacing.sm,
  },
  anfrageText: { color: colors.text2, ...typography.small },
  anfrageBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  anfrageBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  anfrageKnoepfe: { flexDirection: 'row', gap: spacing.sm },
  // Ablehnen ist die stille Wahl: gleich gross, aber ohne Signalfarbe.
  anfrageBtnAus: { backgroundColor: colors.surface3 },
  anfrageBtnTextAus: { color: colors.text },

  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerBack: { width: 30, alignItems: 'center' },
  /*
   * Henrik, 07.09.2026: "Name im Chat-Header nicht zentriert."
   *
   * Zentriert wird nicht im Rest-Platz, sondern im ganzen Kopf. Das geht nur,
   * wenn links und rechts gleich viel steht: links Zurueck (30) und Avatar
   * (sizes.avatarSm) mit den zwei Zwischenraeumen, rechts die zwei
   * Knoepfe (2 x 34) plus ein Ausgleich. Ohne den Ausgleich sitzt der Name
   * sichtbar zu weit rechts — und "fast mittig" sieht schlechter aus als
   * ehrlich linksbuendig.
   */
  headerBody: { flex: 1, minWidth: 0, alignItems: 'center' },
  headerName: { color: colors.text, textAlign: 'center', ...typography.name },
  headerStatus: { marginTop: 1, color: colors.success, textAlign: 'center', ...typography.small },
  headerStatusMuted: { color: colors.text3 },
  headerAction: { width: 34, alignItems: 'center' },
  /* 30 + 11 (Abstand) + Avatar − 2 x 34 = der Rest, der rechts fehlt. */
  headerAusgleich: { width: Math.max(0, 30 + 11 + sizes.avatarSm - 68) },

  messages: { flex: 1, backgroundColor: colors.surface2 },
  messagesContent: { padding: 14, paddingBottom: spacing.sm, gap: 3 },

  /* Der Anrufeintrag steht mittig zwischen den Blasen — siehe renderMessage. */
  anruf: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surface3,
  },
  anrufText: { color: colors.text2, ...typography.small },
  anrufVerpasst: { color: colors.danger },

  dayDivider: { alignSelf: 'center', marginBottom: 10 },
  dayDividerText: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface3,
    color: colors.text2,
    fontSize: 11.5,
    fontWeight: '600',
    overflow: 'hidden',
  },

  bubble: { maxWidth: '76%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 7, borderRadius: 18 },
  /*
   * Kein Rahmen mehr, sondern ein weicher Schatten: die Blase liegt dann auf
   * dem grauen Grund statt als Karte darin zu stecken. Ein 1px-Rahmen um jede
   * einzelne Nachricht macht einen Verlauf unruhig.
   */
  bubbleIn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bubbleIn,
    borderBottomLeftRadius: 6,
    ...shadow.sm,
  },
  bubbleOut: {
    alignSelf: 'flex-end',
    backgroundColor: colors.bubbleOut,
    borderBottomRightRadius: 6,
    ...shadow.sm,
  },
  sender: { marginBottom: 2, color: colors.brand, fontSize: 12.5, fontWeight: '700' },
  messageText: { color: colors.text, ...typography.message, lineHeight: 20 },
  messageTextOut: { color: colors.bubbleOutText },
  media: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  mediaText: { color: colors.text2, ...typography.preview },
  anhangBild: { width: 210, height: 150, borderRadius: 12, marginBottom: 4 },
  ortKarte: { width: 210, borderRadius: 12, overflow: 'hidden', marginBottom: 4, backgroundColor: 'rgba(0,0,0,0.05)' },
  /* Der Wiedergabeknopf liegt auf der Vorschau — siehe renderMessage. */
  anhangPlay: {
    position: 'absolute',
    top: 55,
    left: 85,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  vollbild: { flex: 1, backgroundColor: colors.black },
  vollbildFlaeche: { flex: 1 },
  vollbildZu: {
    position: 'absolute',
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  ortBild: { height: 96, backgroundColor: colors.surface2 },
  ortNadel: { position: 'absolute', transform: [{ translateX: -11 }, { translateY: -22 }] },
  ortName: { ...typography.small, fontWeight: '600', color: colors.text, paddingHorizontal: 10, paddingTop: 7 },
  ortSub: { ...typography.tiny, color: colors.text2, paddingHorizontal: 10, paddingBottom: 8, paddingTop: 1 },
  kontaktKarte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: 210,
    padding: 8,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  kontaktText: { flex: 1, minWidth: 0 },
  kontaktName: { ...typography.small, fontWeight: '600', color: colors.text },
  kontaktHandle: { ...typography.tiny, color: colors.text2, marginTop: 2 },
  /*
   * Die Karte fuer einen geteilten Beitrag (Henrik 7.9.): oben der Beitrag in
   * derselben Groesse wie jeder andere Anhang, darunter eine Zeile mit Autor
   * und Titel. Vorher war es umgekehrt — Text mit einem 42px-Kaestchen davor.
   */
  geteiltKarte: { marginBottom: 4 },
  geteiltZeile: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 210 },
  geteiltText: { flex: 1, minWidth: 0 },
  geteiltAutor: { ...typography.small, fontWeight: '600', color: colors.text },
  geteiltTitel: { ...typography.small, color: colors.text2, marginTop: 2 },
  bubbleFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  time: { color: colors.text3, ...typography.tiny },
  timeOut: { color: colors.bubbleOutMeta },

  typing: { paddingVertical: 10 },
  typingText: { color: colors.text3, ...typography.preview, fontStyle: 'italic' },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  composerIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  composerField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    backgroundColor: colors.surface3,
    paddingLeft: 14,
    paddingRight: 2,
  },
  composerInput: {
    flex: 1,
    maxHeight: 108,
    paddingVertical: 10,
    color: colors.text,
    ...typography.body,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  storyContainer: { position: 'relative', marginBottom: 4 },
  storyBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  storyBadgeText: { color: colors.white, ...typography.tiny, fontWeight: '600' },
  // Der Text unter der Story-Vorschau, nicht daneben. Ein Herz steht damit
  // gross unter dem Bild, auf das es sich bezieht.
  storyText: { marginTop: 6 },
}));
