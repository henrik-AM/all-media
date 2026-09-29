import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { StoryAvatar } from './StoryAvatar';
import { colors, sizes, spacing, themenStyles, typography } from '../constants/design';

interface Stat {
  label: string;
  value: string | number;
}

interface Props {
  handle: string;
  stats: Stat[];
  name: string;
  bio: string;
  link: string;
  onAction: (key: string) => void;
  onLink: () => void;
  onStat?: (label: string) => void;
  onBearbeiten?: () => void;
  onAvatarPress?: () => void;
  /** Kasten 11.2: Bereich, dessen eigene Story als Ring am Bild steht. */
  storyBereich?: 'videos' | 'messenger';
  /**
   * Der gruene Punkt am Profilbild (Kasten 12.6). Mit Handler ist er ein
   * eigener Knopf, der das Fenster zur Online-Sichtbarkeit oeffnet.
   */
  onOnlinePunkt?: () => void;
  /**
   * Ob der Online-Status gerade fuer irgendwen sichtbar ist. `false` (Stufe
   * „Niemand") zeichnet den Punkt grau — sonst stuende dort gruen, was
   * niemand sieht.
   */
  onlineSichtbar?: boolean;
  ungelesen?: number;
}

/**
 * Kopf von "Videos - Profil" und "Community - Profil": @Nutzername mit
 * Glocke/Plus/Menü, darunter Bild links neben den Zahlen, dann Name,
 * Biografie und Link linksbündig.
 */
export const OwnProfileHead = ({ handle, stats, name, bio, link, onAction, onLink, onStat, onBearbeiten, onAvatarPress, storyBereich, onOnlinePunkt, onlineSichtbar = true, ungelesen = 0 }: Props) => (
  <View>
    {/*
      * Kasten 12.2: Henrik am 21.09.2026 „Nutzername sitzt waagerecht zu weit
      * links statt mittig." Der Name stand mit flex:1 in derselben Zeile wie
      * die drei Knoepfe — zentriert wurde er also in der Restbreite links
      * davon, nicht im Bildschirm. Jetzt liegt er ueber die volle Breite mit
      * gleichem Rand links und rechts; die Knoepfe liegen darueber. So macht
      * es die Website seit jeher (.oprof__handle, position:absolute).
      */}
    <View style={styles.bar}>
      <Text style={styles.handle} numberOfLines={1} testID="profil-handle">{handle}</Text>
      <View style={styles.actions}>
        <Druck
          onPress={() => onAction('bell')}
          hitSlop={8}
          accessibilityLabel={ungelesen ? `Mitteilungen, ${ungelesen} ungelesen` : 'Mitteilungen'}
        >
          <Ionicons name={ungelesen > 0 ? "notifications" : "notifications-off-outline"} size={21} color={ungelesen > 0 ? colors.text : colors.text3} />
          {ungelesen > 0 && <View style={styles.dot} />}
        </Druck>
        <Druck onPress={() => onAction('create')} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={21} color={colors.text} />
        </Druck>
        <Druck onPress={() => onAction('menu')} hitSlop={8}>
          <Ionicons name="settings-outline" size={21} color={colors.text} />
        </Druck>
      </View>
    </View>

    <View style={styles.top}>
      <Druck disabled={!onAvatarPress} onPress={onAvatarPress}>
        <View>
          {/* Der Name stand hier fest als "Du" - die Initiale im Kreis war
              deshalb "D", waehrend direkt darunter "Henrik" steht. Jetzt kommt
              der Name von aussen, wie ueberall sonst. */}
          {/* Kasten 11.2: die eigene Story als Ring am eigenen Profil. Nur
              wenn der Bereich Storys hat (Videos); Communitys haben keine. */}
          {storyBereich ? (
            <StoryAvatar
              id="me"
              name={name}
              size={sizes.avatarXl + 6}
              bereich={storyBereich}
              onPressOhneStory={onAvatarPress}
            />
          ) : (
            <Avatar id="me" name={name} size={sizes.avatarXl} />
          )}
          {onOnlinePunkt ? null : <View style={[styles.online, !onlineSichtbar && styles.onlineAus]} />}
        </View>
      </Druck>
      {/*
        * Der Punkt als eigener Knopf ueber dem Bild, nicht im Knopf des
        * Bildes: sonst oeffnete ein Tipp auf den Punkt das Profilbild.
        */}
      {onOnlinePunkt ? (
        <Druck
          style={[styles.online, styles.onlineKnopf, !onlineSichtbar && styles.onlineAus]}
          onPress={onOnlinePunkt}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={onlineSichtbar ? 'Online-Status: sichtbar. Sichtbarkeit ändern' : 'Online-Status: verborgen. Sichtbarkeit ändern'}
          testID="online-punkt"
        />
      ) : null}
      <View style={styles.stats}>
        {stats.map((stat) => (
          <Druck
            key={stat.label}
            style={styles.stat}
            onPress={() => onStat?.(stat.label)}
          >
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
          </Druck>
        ))}
      </View>
    </View>

    <View style={styles.about}>
      <Text style={styles.name}>{name}</Text>
      {!!bio && <Text style={styles.bio}>{bio}</Text>}
      {!!link && (
        <Druck onPress={onLink}>
          <Text style={styles.link}>{link}</Text>
        </Druck>
      )}
    </View>

    {onBearbeiten && (
      <Druck style={styles.bearbeiten} onPress={onBearbeiten}>
        <Text style={styles.bearbeitenText}>Profil bearbeiten</Text>
      </Druck>
    )}
  </View>
);

const styles = themenStyles((colors) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 30,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 2,
  },
  /*
   * Ueber die volle Breite, mit gleichem Rand links und rechts. Der Rand ist
   * so breit wie die drei Knoepfe (3 × 21 + 2 × Abstand + Seitenrand), damit
   * ein langer Name nicht unter sie laeuft — und weil er auf BEIDEN Seiten
   * steht, bleibt die Mitte die Bildschirmmitte.
   */
  handle: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 2,
    paddingHorizontal: spacing.lg + 3 * 21 + 2 * spacing.md + 4,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  online: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#34C759',
    borderWidth: 2.5,
    borderColor: colors.surface,
  },
  /* Das Profilbild ist sizes.avatarXl breit und sitzt am linken Rand von
     `top` — der Knopf liegt an derselben Stelle wie der alte Punkt. */
  onlineKnopf: {
    left: spacing.lg + sizes.avatarXl - 3 - 18,
    right: undefined,
    bottom: spacing.sm + 3,
  },
  onlineAus: { backgroundColor: colors.text3 },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 4, maxWidth: 120 },
  statLabel: { ...typography.small, color: colors.text2, textAlign: 'center' },
  statValue: { fontSize: 17, fontWeight: '700', color: colors.text },
  about: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  name: { ...typography.h2, color: colors.text },
  bio: { ...typography.message, color: colors.text, marginTop: 3 },
  link: { ...typography.message, color: colors.brand, marginTop: 4 },
  /* Kante statt Graufüllung: eine graue Fläche über die volle Breite liest
     sich wie ein Platzhalter, eine Kante wie ein Knopf. */
  bearbeiten: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  bearbeitenText: { fontSize: 14, fontWeight: '600', color: colors.text, letterSpacing: -0.1 },
}));
