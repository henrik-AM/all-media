import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
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
import { colors, radius, shadow, sizes, spacing, typography } from '../../constants/design';
import { antwortAuf } from '../../lib/antworten';
import { CURRENT_USER_ID, mockCommunityMessages, mockMessages, mockUsers } from '../../mocks';
import { AnhangSheet } from '../../components/AnhangSheet';
import { useProfil } from '../../contexts/ProfilContext';
import { Chat, Contact, Message } from '../../types';

const nowTime = () =>
  new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

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
  /** Offene Kontaktanfrage annehmen. */
  onAcceptRequest?: (chatId: string) => void;
}

export const ChatDetailScreen = ({
  chat,
  extraMessages,
  onBack,
  onCall,
  onCamera,
  onOpenProfile,
  onAcceptRequest,
  contacts = [],
  onNotice,
  onOpenStandort,
}: Props) => {
  const [anhangOffen, setAnhangOffen] = useState(false);
  const { istBlockiert, markierte, markieren } = useProfil();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>(() => [
    ...(mockMessages[chat.id] ?? mockCommunityMessages[chat.id] ?? []),
    ...(extraMessages ?? []),
  ]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  // Bis die Anfrage angenommen ist, bleibt es bei der einen Nachricht, die
  // schon mit der Anfrage rausging.
  // Gesperrt ist der Chat aus zwei Gruenden: die Anfrage laeuft noch, oder
  // die Person ist blockiert.
  const blockiert = !!chat.userId && istBlockiert(chat.userId);
  const gesperrt = chat.requestState === 'pending' || blockiert;

  const send = () => {
    const text = draft.trim();
    if (!text || gesperrt) return;

    const message: Message = {
      id: `m${Date.now()}`,
      chatId: chat.id,
      senderId: CURRENT_USER_ID,
      text,
      time: nowTime(),
      read: false,
    };
    setMessages((prev) => [...prev, message]);
    setDraft('');
    scrollToEnd();

    if (chat.isGroup || !chat.userId) return;

    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `r${Date.now()}`,
          chatId: chat.id,
          senderId: chat.userId!,
          text: antwortAuf(text, chat.name),
          time: nowTime(),
        },
      ]);
      scrollToEnd();
    }, 1400);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const out = item.senderId === CURRENT_USER_ID;
    const sender = mockUsers[item.senderId];

    return (
      // Lange druecken markiert eine Nachricht mit einem Stern - so fuellt
      // sich "Mit Stern markiert" in der Kontaktinfo wirklich.
      <Druck
        style={[styles.bubble, out ? styles.bubbleOut : styles.bubbleIn]}
        onLongPress={() => {
          const jetzt = markieren(item.id);
          onNotice?.(jetzt ? 'Nachricht markiert' : 'Markierung entfernt');
        }}
        delayLongPress={450}
      >
        {!out && chat.isGroup && <Text style={styles.sender}>{sender?.name ?? 'Unbekannt'}</Text>}

        {item.bildUri ? (
          <Image source={{ uri: item.bildUri }} style={styles.anhangBild} />
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
          // Weitergeleiteter Beitrag: kleine Karte statt nacktem Text.
          <View style={styles.geteilt}>
            <View style={styles.geteiltBild}>
              <Ionicons
                name={item.geteilt.art === 'video' ? 'play' : 'image-outline'}
                size={20}
                color={colors.text3}
              />
            </View>
            <View style={styles.geteiltText}>
              <Text style={styles.geteiltAutor} numberOfLines={1}>
                {item.geteilt.autor}
              </Text>
              <Text style={styles.geteiltTitel} numberOfLines={1}>
                {item.geteilt.titel}
              </Text>
            </View>
          </View>
        ) : item.media ? (
          <View style={styles.media}>
            <Ionicons
              name={item.media === 'image' ? 'image-outline' : 'mic-outline'}
              size={18}
              color={colors.text2}
            />
            <Text style={styles.mediaText}>
              {item.media === 'image' ? 'Foto' : 'Sprachnachricht · 0:14'}
            </Text>
          </View>
        ) : (
          <Text style={[styles.messageText, out && styles.messageTextOut]}>{item.text}</Text>
        )}

        <View style={styles.bubbleFoot}>
          {markierte.includes(item.id) && <Ionicons name="star" size={12} color="#F5A524" />}
          <Text style={[styles.time, out && styles.timeOut]}>{item.time}</Text>
          {out && <Ionicons name="checkmark-done" size={14} color={colors.bubbleOutMeta} />}
        </View>
      </Druck>
    );
  };

  return (
    // Vollbild bis in die Ecken; Kopf- und Eingabezeile halten sich den Platz
    // fuer Notch und Home-Anzeige selbst frei.
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Druck style={styles.headerBack} onPress={onBack} hitSlop={6}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Druck>
        <Avatar id={chat.userId ?? chat.id} name={chat.name} size={sizes.avatarSm} group={chat.isGroup} />
        <Druck
          style={styles.headerBody}
          onPress={() => chat.userId && onOpenProfile(chat.userId)}
          disabled={!chat.userId}
        >
          <Text style={styles.headerName} numberOfLines={1}>
            {chat.name}
          </Text>
          <Text style={[styles.headerStatus, chat.isGroup && styles.headerStatusMuted]}>
            {chat.isGroup
              ? `${((chat.memberIds?.length ?? 0) + 1).toLocaleString('de-DE')} Mitglieder`
              : 'Online'}
          </Text>
        </Druck>
        <Druck style={styles.headerAction} onPress={() => onCall('video')} hitSlop={4}>
          <Ionicons name="videocam-outline" size={22} color={colors.text2} />
        </Druck>
        <Druck style={styles.headerAction} onPress={() => onCall('audio')} hitSlop={4}>
          <Ionicons name="call-outline" size={20} color={colors.text2} />
        </Druck>
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
              <Text style={styles.dayDividerText}>Heute</Text>
            </View>
          }
          ListFooterComponent={
            typing ? (
              <View style={[styles.bubble, styles.bubbleIn, styles.typing]}>
                <Text style={styles.typingText}>schreibt …</Text>
              </View>
            ) : null
          }
        />

        {blockiert && (
          <View style={styles.anfrage}>
            <Text style={styles.anfrageText}>
              {chat.name} ist blockiert. Hebe die Blockierung im Profil auf, um wieder zu schreiben.
            </Text>
          </View>
        )}

        {gesperrt && !blockiert && (
          <View style={styles.anfrage}>
            <Text style={styles.anfrageText}>
              Deine Anfrage läuft noch. Weitere Nachrichten sind möglich,
              sobald {chat.name} sie angenommen hat.
            </Text>
            {/* In der Demo nimmt der Knopf die Anfrage stellvertretend an,
                damit sich der weitere Ablauf ausprobieren laesst. */}
            <Druck style={styles.anfrageBtn} onPress={() => onAcceptRequest?.(chat.id)}>
              <Text style={styles.anfrageBtnText}>Annahme simulieren</Text>
            </Druck>
          </View>
        )}

        <View style={[styles.composer, { paddingBottom: 8 + insets.bottom }]}>
          <Druck
            style={styles.composerIcon}
            onPress={() =>
              gesperrt
                ? onNotice?.(blockiert ? 'Diese Person ist blockiert' : 'Warte, bis die Anfrage angenommen wurde')
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
              placeholder={blockiert ? 'Blockiert' : gesperrt ? 'Warten auf Annahme …' : 'Nachricht'}
              placeholderTextColor={colors.text3}
              editable={!gesperrt}
              multiline
            />
            <Druck style={styles.composerIcon} onPress={onCamera} hitSlop={4}>
              <Ionicons name="camera-outline" size={21} color={colors.text2} />
            </Druck>
          </View>
          <Druck
            style={[styles.send, (!draft.trim() || gesperrt) && styles.sendDisabled]}
            onPress={send}
            disabled={!draft.trim() || gesperrt}
          >
            <Ionicons name="send" size={17} color={colors.white} />
          </Druck>
        </View>
      </KeyboardAvoidingView>

      <AnhangSheet
        visible={anhangOffen}
        contacts={contacts}
        ausserId={chat.userId}
        onClose={() => setAnhangOffen(false)}
        onAnhang={(teil) => {
          setMessages((prev) => [
            ...prev,
            { id: `m${Date.now()}`, chatId: chat.id, senderId: CURRENT_USER_ID, time: nowTime(), ...teil },
          ]);
          scrollToEnd();
        }}
        onNotice={(text) => onNotice?.(text)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
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
  headerBody: { flex: 1, minWidth: 0 },
  headerName: { color: colors.text, ...typography.name },
  headerStatus: { marginTop: 1, color: colors.success, ...typography.small },
  headerStatusMuted: { color: colors.text3 },
  headerAction: { width: 34, alignItems: 'center' },

  messages: { flex: 1, backgroundColor: colors.surface2 },
  messagesContent: { padding: 14, paddingBottom: spacing.sm, gap: 3 },

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
  geteilt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  geteiltBild: {
    width: 42,
    height: 42,
    borderRadius: 9,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
});
