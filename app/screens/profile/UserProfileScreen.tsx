import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Motiv } from '../../components/Motiv';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';
import { oeffneLink } from '../../lib/links';
import { useAktionen } from '../../lib/useAktionen';
import { useProfil } from '../../contexts/ProfilContext';
import { ProfilOptionenSheet } from '../../components/ProfilOptionenSheet';
import { useKachelHoehe } from '../../lib/raster';
import { compactNumber } from '../../lib/zahlen';
import { useSupabase } from '../../contexts/SupabaseContext';
import * as Aktion from '../../lib/aktionen';

type Tab = 'grid' | 'repost' | 'tagged';


interface Props {
  userId: string;
  onBack: () => void;
  onMessage: (userId: string) => void;
  onAvatarPress?: () => void;
  /** Beim Blockieren: die Person aus den Kontakten nehmen. */
  onBlockiert?: (userId: string, blockiert: boolean) => void;
  onOpenFollowers?: (userId: string) => void;
  onOpenFollowing?: (userId: string) => void;
  /**
   * Eine Kachel im Raster öffnen — der Beitrag selbst, nicht ein Hinweis
   * darauf. Siehe `kachelOeffnen` in App.tsx.
   */
  onOpenKachel?: (kachel: { id: string; kind?: string }) => void;
  onNotice: (message: string) => void;
}

export const UserProfileScreen = ({ userId, onBack, onMessage, onAvatarPress, onBlockiert, onOpenFollowers, onOpenFollowing, onOpenKachel, onNotice }: Props) => {
  const { profile: alleProfile, users: alleNutzer, ichId } = useDaten();
  const kachelHoehe = useKachelHoehe();
  const { istStumm, istBlockiert } = useProfil();
  const [optionenOffen, setOptionenOffen] = useState(false);
  const person = alleNutzer[userId];
  const [profile, setProfile] = useState(alleProfile[userId]);
  const [tab, setTab] = useState<Tab>('grid');

  // Nachziehen, sobald das Profil aus der Datenbank da ist — und beim
  // Wechsel auf eine andere Person. Siehe HomeFeedScreen.
  useEffect(() => {
    setProfile(alleProfile[userId]);
  }, [alleProfile, userId]);

  /*
   * Den Aufruf vermerken — einmal je geoeffnetem Profil.
   *
   * Ohne das bleibt die Profilstatistik in den Einstellungen dauerhaft bei
   * null: sie kann nur zaehlen, was jemand aufschreibt. Das eigene Profil
   * zaehlt nicht mit, darum kuemmert sich `profilAufrufVermerken`.
   */
  /*
   * Die drei Reiter, aus der Datenbank.
   *
   * Bis zum 03.09.2026 stand im ersten Reiter eine Konstante mit zwoelf
   * Kacheln — bei jedem Menschen dieselben zwoelf, ob er nun drei Beitraege
   * hatte oder gar keinen. Direkt darueber stand die echte Zahl aus
   * `profile_zahlen`; die Anzeige widersprach sich also selbst. Die beiden
   * anderen Reiter waren fest leer, obwohl es `reposts` und `post_tags`
   * inzwischen gibt.
   *
   * Geladen wird erst beim Oeffnen des jeweiligen Reiters: das Raster sieht
   * jeder sofort, Reposts und Markierungen sieht kaum jemand an.
   */
  const { supabase } = useSupabase();
  const [kacheln, setKacheln] = useState<Record<Tab, Aktion.Rasterkachel[] | null>>({
    grid: null,
    repost: null,
    tagged: null,
  });

  useEffect(() => {
    setKacheln({ grid: null, repost: null, tagged: null });
  }, [userId]);

  useEffect(() => {
    if (!supabase || kacheln[tab] !== null) return;
    let abgebrochen = false;
    const holen =
      tab === 'grid'
        ? Aktion.beitraegeVon
        : tab === 'repost'
          ? Aktion.repostsVon
          : Aktion.markierteBeitraege;
    holen(supabase, userId)
      .then((liste) => {
        if (!abgebrochen) setKacheln((vorher) => ({ ...vorher, [tab]: liste }));
      })
      .catch((e) => console.error('Profilraster laden fehlgeschlagen:', e?.message ?? e));
    return () => {
      abgebrochen = true;
    };
  }, [supabase, userId, tab, kacheln]);

  /*
   * "Nachrichten senden deaktivieren" — Sichtbarkeitsbereich `dm`.
   *
   * Gefragt wird, bevor der Knopf dasteht. Dasselbe Argument wie bei
   * "Auf dem Geraet sichern" in StoryOptionenSheet: ein Knopf, der beim
   * Antippen "darfst du nicht" sagt, ist die schlechtere Antwort als einer,
   * der von vornherein gesperrt ist und den Grund danebenschreibt.
   *
   * Anfangswert `true` — sonst blitzt der Knopf bei jedem Profil kurz
   * gesperrt auf, waehrend die Antwort noch unterwegs ist. Schreiben kann
   * ohnehin nur, wen die Datenbank laesst (Schema 22).
   */
  const [darfSchreiben, setDarfSchreiben] = useState(true);

  useEffect(() => {
    if (!supabase || !ichId || userId === ichId) return;
    let abgebrochen = false;
    Aktion.darfAngeschriebenWerden(supabase, userId, ichId)
      .then((erlaubt) => {
        if (!abgebrochen) setDarfSchreiben(erlaubt);
      })
      .catch(() => setDarfSchreiben(false));
    return () => {
      abgebrochen = true;
    };
  }, [supabase, ichId, userId]);

  const aktionen = useAktionen(onNotice);
  useEffect(() => {
    void aktionen.profilAufruf(userId);
    // Absichtlich nur an `userId` haengend: `aktionen` wird bei jedem
    // Zeichnen neu gebaut, und dann zaehlte ein Scrollen als Aufruf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!person || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState icon="person-outline" title="Profil nicht verfügbar" />
      </SafeAreaView>
    );
  }

  const toggleFollow = () => {
    setProfile((prev) => ({
      ...prev,
      isFollowing: !prev.isFollowing,
      followers: prev.followers + (prev.isFollowing ? -1 : 1),
    }));
    onNotice(profile.isFollowing ? `${person.name} nicht mehr gefolgt` : `Du folgst ${person.name}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Druck style={styles.back} onPress={onBack} hitSlop={6}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Druck>
        <Text style={styles.handle}>{person.handle}</Text>
        <Druck onPress={() => setOptionenOffen(true)} hitSlop={6}>
          <Ionicons name="information-circle-outline" size={22} color={colors.text2} />
        </Druck>
      </View>

      <ScrollView>
        <View style={styles.top}>
          <Druck style={styles.ring} onPress={() => onAvatarPress?.()}>
            <Avatar id={userId} name={person.name} size={82} />
          </Druck>
          <View style={styles.stats}>
            {[
              { value: profile.posts, label: 'Beiträge' },
              { value: profile.followers, label: 'Follower' },
              { value: profile.following, label: 'Gefolgt' },
            ].map((stat) => (
              <Druck key={stat.label} style={styles.stat} onPress={() => {
                if (stat.label === 'Follower') onOpenFollowers?.(userId);
                else if (stat.label === 'Gefolgt') onOpenFollowing?.(userId);
                else onNotice(stat.label);
              }}>
                <Text style={styles.statValue}>{compactNumber(stat.value)}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </Druck>
            ))}
          </View>
        </View>

        <View style={styles.about}>
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.bio}>{profile.bio}</Text>
          {/*
            Henrik: "Links in Profilbeschreibungen muessen anklickbar sein."
            Im eigenen Profil und auf der Website ging der Link laengst auf;
            hier, auf einem fremden Profil, blendete er bis zum 02.09.2026 nur
            seine eigene Adresse als Hinweis ein.
          */}
          {!!profile.link && (
            <Druck onPress={() => oeffneLink(profile.link, onNotice)}>
              <Text style={styles.link}>{profile.link}</Text>
            </Druck>
          )}
        </View>

        {istBlockiert(userId) ? (
          <View style={styles.hinweis}>
            <Ionicons name="ban-outline" size={17} color={colors.text2} />
            <Text style={styles.hinweisText}>
              {person.name} ist blockiert. Ihr könnt euch keine Nachrichten schreiben.
            </Text>
          </View>
        ) : !darfSchreiben ? (
          /*
            Der dritte Grund, aus dem hier kein Chat zustande kommt — und der
            einzige, der nicht von mir ausgeht: die Person hat "Nachrichten
            senden" fuer mich abgeschaltet (Sichtbarkeitsbereich `dm`).

            Bewusst ohne Angabe, welche Stufe dahintersteckt. Ob "Niemand"
            oder "Alle bis auf dich" — das zu unterscheiden waere eine
            Auskunft ueber eine Liste, die absichtlich privat ist.
          */
          <View style={styles.hinweis}>
            <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.text2} />
            <Text style={styles.hinweisText}>
              {person.name} empfängt keine Nachrichten.
            </Text>
          </View>
        ) : istStumm(userId) ? (
          <View style={styles.hinweis}>
            <Ionicons name="volume-mute-outline" size={17} color={colors.text2} />
            <Text style={styles.hinweisText}>{person.name} ist stummgeschaltet.</Text>
          </View>
        ) : null}

        <View style={styles.buttons}>
          <Druck
            style={[styles.button, !profile.isFollowing && styles.buttonPrimary]}
            onPress={toggleFollow}
          >
            <Text style={[styles.buttonText, !profile.isFollowing && styles.buttonTextPrimary]}>
              {profile.isFollowing ? 'Gefolgt' : 'Folgen'}
            </Text>
          </Druck>
          <Druck
            style={[styles.button, (istBlockiert(userId) || !darfSchreiben) && styles.buttonAus]}
            disabled={istBlockiert(userId) || !darfSchreiben}
            onPress={() => onMessage(userId)}
          >
            <Text style={styles.buttonText}>Nachricht</Text>
          </Druck>
        </View>

        {profile.highlights.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
            {profile.highlights.map((highlight) => (
              <Druck key={highlight} style={styles.highlight} onPress={() => onNotice(`Highlight „${highlight}"`)}>
                <View style={styles.highlightRing}>
                  {/*
                    Highlights sind Bilder, keine Personen. Vorher stand hier
                    eine Flaeche in EINER Farbe (die des Profils) mit den ersten
                    zwei Buchstaben darin - alle Highlights sahen also gleich
                    aus. Die Website zeichnet laengst je Highlight ein eigenes
                    Motiv; die App hatte den Wechsel nicht mitgemacht.
                  */}
                  <Motiv
                    id={`hl-${highlight}`}
                    icon="image-outline"
                    iconSize={18}
                    style={styles.highlightInner}
                  />
                </View>
                <Text style={styles.highlightLabel} numberOfLines={1}>
                  {highlight}
                </Text>
              </Druck>
            ))}
          </ScrollView>
        )}

        <View style={styles.tabs}>
          {([
            { key: 'grid', icon: 'grid-outline' },
            { key: 'repost', icon: 'repeat' },
            { key: 'tagged', icon: 'person-outline' },
          ] as { key: Tab; icon: React.ComponentProps<typeof Ionicons>['name'] }[]).map((item) => (
            <Druck
              key={item.key}
              style={[styles.tab, tab === item.key && styles.tabActive]}
              onPress={() => setTab(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={22}
                color={tab === item.key ? colors.text : colors.text3}
              />
            </Druck>
          ))}
        </View>

        {(kacheln[tab] ?? []).length > 0 ? (
          <View style={styles.grid}>
            {(kacheln[tab] ?? []).map((eintrag) => (
              <Druck
                key={`${tab}-${eintrag.id}`}
                style={[styles.gridItem, { height: kachelHoehe }]}
                onPress={() => onOpenKachel?.(eintrag)}
              >
                {/*
                  Bei einem Video steht in mediaUrl eine .mp4 — ins Raster
                  gehoert das Standbild dazu. Motiv nimmt, was da ist, und
                  zeichnet sonst die Farbflaeche.
                */}
                <Motiv
                  id={eintrag.id}
                  bild={eintrag.thumbnail ?? eintrag.mediaUrl ?? undefined}
                  icon={eintrag.kind === 'post' ? 'image-outline' : 'play-outline'}
                  iconSize={20}
                  style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                />
                {eintrag.kind !== 'post' && (
                  <View style={styles.gridBadge}>
                    <Ionicons name="play" size={13} color={colors.white} />
                  </View>
                )}
                {tab !== 'grid' && (
                  <View style={styles.gridMarke}>
                    <Ionicons name={tab === 'repost' ? 'repeat' : 'person'} size={12} color={colors.white} />
                  </View>
                )}
              </Druck>
            ))}
          </View>
        ) : (
          <EmptyState
            icon={tab === 'grid' ? 'image-outline' : tab === 'repost' ? 'repeat' : 'person-outline'}
            title={
              kacheln[tab] === null
                ? 'Wird geladen …'
                : tab === 'grid'
                  ? 'Noch keine Beiträge'
                  : tab === 'repost'
                    ? 'Keine Reposts'
                    : 'Keine Markierungen'
            }
            /*
              Bei Reposts und Markierungen sagt „nichts da" absichtlich nicht,
              ob es nichts gibt oder ob die Person es verbirgt. Ein „verborgen"
              waere selbst die Auskunft, die die Einstellung verhindern soll.
            */
            text={kacheln[tab] === null ? '' : 'Hier ist noch nichts.'}
          />
        )}
      </ScrollView>

      <ProfilOptionenSheet
        visible={optionenOffen}
        userId={userId}
        onClose={() => setOptionenOffen(false)}
        onNotice={onNotice}
        onBlockiert={onBlockiert}
      />
    </SafeAreaView>
  );
};

const styles = themenStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: { width: 30, alignItems: 'center' },
  handle: { flex: 1, color: colors.text, ...typography.h3 },

  top: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: spacing.lg, paddingTop: 18, paddingBottom: 12 },
  ring: { padding: 3, borderRadius: 47, borderWidth: 2.5, borderColor: colors.brand },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 2 },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '700' },
  statLabel: { color: colors.text2, ...typography.preview },

  about: { paddingHorizontal: spacing.lg, paddingBottom: 12 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  bio: { marginTop: 3, color: colors.text, ...typography.message, lineHeight: 20 },
  link: { marginTop: 4, color: colors.brand, ...typography.message },

  buttons: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: 14 },
  button: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: colors.brand },
  buttonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  buttonTextPrimary: { color: colors.white },

  highlights: { gap: 14, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  highlight: { width: sizes.storyRing, alignItems: 'center' },
  highlightRing: {
    width: sizes.storyRing,
    height: sizes.storyRing,
    borderRadius: sizes.storyRing / 2,
    borderWidth: 2.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightInner: {
    width: sizes.storyRing - 11,
    height: sizes.storyRing - 11,
    borderRadius: (sizes.storyRing - 11) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightLabel: { marginTop: 6, color: colors.text2, fontSize: 11.5 },

  hinweis: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  hinweisText: { flex: 1, ...typography.preview, color: colors.text2 },
  buttonAus: { opacity: 0.45 },

  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.text },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: {
    width: '33.333%',
    borderWidth: 1,
    borderColor: colors.surface,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gridBadge: { position: 'absolute', top: 6, right: 6 },
  gridMarke: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
