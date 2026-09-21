import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import {
  brandGradient,
  colors,
  radius,
  sizes,
  spacing,
  themenStyles,
  typography,
} from '../../constants/design';
import { haptic } from '../../lib/haptics';
import { useDaten } from '../../contexts/DatenContext';
import { useEinstellungen } from '../../contexts/EinstellungenContext';
import { Chat } from '../../types';

type Filter = 'all' | 'chats' | 'groups';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'chats', label: 'Chats' },
  { key: 'groups', label: 'Gruppen' },
];

interface Props {
  /** Einen dieser Chats öffnen. */
  onOpenChat: (chat: Chat) => void;
  /** Das Plus rechts oben — Leute aus den eigenen Communitys finden. */
  onNewChat?: () => void;
  /** Langes Drücken: dieselben Optionen wie in der Messenger-Chatliste. */
  onChatOptionen?: (chat: Chat) => void;
}

/*
 * Prototyp-Frame "Community - Chats".
 *
 * WAS HIER BIS ZUM 18.09.2026 STAND — UND WARUM ES FALSCH WAR
 *
 * Diese Liste zeigte die Communitys, denen man beigetreten ist. Die stehen
 * aber schon unter „Home"; die Seite war eine zweite Ausgabe derselben Liste.
 *
 * Henriks Vorgabe dazu ist eindeutig: „Hier nur persönliche Chats zwischen
 * Nutzern anzeigen, keine Community-Chats. Messenger = Chat über
 * Telefonnummer/Kontakt. Community-Chat = Kommunikation ohne Telefonnummer."
 * Die Website macht das seit jeher so (renderCommunityChats in
 * web/public/app.js).
 *
 * Die Folge war schlimmer als eine doppelte Liste: `daten.communityChats`
 * wurde in der App zwar geladen, aber von keinem einzigen Bildschirm
 * angezeigt. Wer einen Beitrag aus dem Bereich Communitys an jemanden
 * schickte, legte damit einen Chat an, den die App danach nirgends mehr
 * zeigte. Auf der Website war er da. Zwei Fassungen, ein Bestand,
 * verschiedene Wirklichkeiten.
 */
export const CommunityChatsScreen = ({ onOpenChat, onNewChat, onChatOptionen }: Props) => {
  const { communityChats } = useDaten();
  // „Vorschau anzeigen" — dieselbe Regel wie in der Messenger-Chatliste.
  const { an } = useEinstellungen();
  const vorschauZeigen = an('vorschau', true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const liste = useMemo(() => {
    const q = query.trim().toLowerCase();
    return communityChats.filter((chat) => {
      if (chat.archiviert) return false;
      if (filter === 'chats' && chat.isGroup) return false;
      if (filter === 'groups' && !chat.isGroup) return false;
      if (!q) return true;
      return (
        chat.name.toLowerCase().includes(q) || (chat.preview || '').toLowerCase().includes(q)
      );
    });
  }, [communityChats, filter, query]);

  const renderChat = ({ item }: { item: Chat }) => {
    const unread = item.unreadCount > 0;
    return (
      <Druck
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => onOpenChat(item)}
        onLongPress={
          onChatOptionen
            ? () => {
                haptic.light();
                onChatOptionen(item);
              }
            : undefined
        }
      >
        <Avatar
          id={item.userId ?? item.id}
          name={item.name}
          size={sizes.avatarLg}
          group={item.isGroup}
        />
        <View style={styles.body}>
          <View style={styles.rowTop}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.time, unread && styles.timeUnread]}>{item.time}</Text>
          </View>
          <View style={styles.rowBottom}>
            <Text style={[styles.sub, unread && styles.subUnread]} numberOfLines={1}>
              {vorschauZeigen ? item.preview : item.preview ? 'Neue Nachricht' : ''}
            </Text>
            {item.muted && <Ionicons name="volume-mute-outline" size={15} color={colors.text3} />}
            {unread && (
              <LinearGradient
                colors={brandGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.badge}
              >
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </LinearGradient>
            )}
          </View>
        </View>
      </Druck>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Suche hier nach Kontakten/Gruppen..."
          onAdd={onNewChat}
        />
      </View>

      <View style={styles.pills}>
        {FILTERS.map(({ key, label }) => {
          const on = filter === key;
          return (
            <Druck key={key} onPress={() => setFilter(key)}>
              {on ? (
                <LinearGradient
                  colors={brandGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pill}
                >
                  <Text style={[styles.pillText, styles.pillTextActive]}>{label}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.pill, styles.pillIdle]}>
                  <Text style={styles.pillText}>{label}</Text>
                </View>
              )}
            </Druck>
          );
        })}
      </View>

      {liste.length === 0 ? (
        <EmptyState
          icon="chatbubble-outline"
          title={query ? 'Kein Chat gefunden' : 'Noch keine Unterhaltung'}
          text={
            query
              ? `Für „${query}" gibt es keinen Treffer.`
              : 'Über das Plus rechts oben findest du Leute aus deinen Communitys.'
          }
        />
      ) : (
        <FlatList
          data={liste}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={renderChat}
        />
      )}
    </View>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },

  pills: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: 8 },
  pill: {
    height: 33,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillIdle: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pillText: { color: colors.text2, fontSize: 13.5, fontWeight: '600', letterSpacing: -0.1 },
  pillTextActive: { color: colors.white },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
  },
  rowPressed: { backgroundColor: colors.surface2 },
  body: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  name: { flex: 1, ...typography.name, color: colors.text },
  time: { color: colors.text3, ...typography.small },
  timeUnread: { color: colors.brand, fontWeight: '600' },
  sub: { flex: 1, ...typography.preview, color: colors.text2 },
  subUnread: { color: colors.text, fontWeight: '500' },

  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11.5, fontWeight: '700' },
}));
