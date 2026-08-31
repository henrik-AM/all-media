import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Motiv } from '../../components/Motiv';
import { EmptyState } from '../../components/EmptyState';
import { OwnProfileHead } from '../../components/OwnProfileHead';
import { SwitchBar } from '../../components/SwitchBar';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { AreaKey } from '../../constants/navigation';
import { useDaten } from '../../contexts/DatenContext';
import { useReposts } from '../../contexts/RepostContext';
import { useProfil } from '../../contexts/ProfilContext';
import { oeffneLink } from '../../lib/links';
import { useKachelHoehe } from '../../lib/raster';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Tab = 'grid' | 'repost' | 'tagged' | 'saved';

interface Props {
  onSwitchArea: (area: AreaKey) => void;
  /** Glocke, Plus und Menü oben rechts. */
  onAction: (key: string) => void;
  /** Fuehrt zum Formular, das Name, Info und Link aendert. */
  onBearbeiten: () => void;
  onNotice: (message: string) => void;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k` : String(n);

const TABS: { key: Tab; icon: IconName }[] = [
  { key: 'grid', icon: 'grid-outline' },
  { key: 'repost', icon: 'repeat-outline' },
  { key: 'tagged', icon: 'person-outline' },
  { key: 'saved', icon: 'bookmark-outline' },
];

/** Prototyp-Frame "Videos - Profil". */
export const VideoProfileScreen = ({ onSwitchArea, onAction, onBearbeiten, onNotice }: Props) => {
  const { profile: alleProfile, users: alleNutzer } = useDaten();
  const kachelHoehe = useKachelHoehe();
  const { reposts } = useReposts();
  const { ungelesen, highlights, playlists, spende, raster, eigeneBeitraege, gefolgt, eigenesProfil } =
    useProfil();
  const [tab, setTab] = useState<Tab>('grid');
  const me = alleProfile.me;

  /*
   * Solange die Daten laden, gibt es das eigene Profil noch nicht.
   *
   * Vorher stand hier direkt `alleNutzer.me.handle` — beim ersten Aufbau ist
   * `alleNutzer` aber ein leeres Objekt, und die App stürzte mit "Cannot read
   * property 'handle' of undefined" ab. Aufgefallen ist das erst im
   * Simulator: die Prüfläufe der Website kommen an diesem Bildschirm nicht
   * vorbei, und `tsc` sieht den Fall nicht, weil ein Index-Zugriff in
   * TypeScript als vorhanden gilt.
   */
  const ich = alleNutzer.me;
  if (!ich || !me) {
    return <View style={styles.screen}><SwitchBar onPress={() => onSwitchArea('messenger')} /></View>;
  }

  return (
    <View style={styles.screen}>
      <SwitchBar onPress={() => onSwitchArea('messenger')} />

      <ScrollView contentContainerStyle={styles.content}>
        <OwnProfileHead
          handle={ich.handle}
          stats={[
            { label: 'Beiträge', value: compact(me.posts + eigeneBeitraege.length) },
            { label: 'Follower', value: compact(me.followers) },
            { label: 'Gefolgt', value: compact(gefolgt.length) },
          ]}
          name={eigenesProfil.name}
          bio={eigenesProfil.bio}
          link={eigenesProfil.link}
          ungelesen={ungelesen('videos')}
          onAction={onAction}
          onBearbeiten={onBearbeiten}
          onLink={() => oeffneLink(eigenesProfil.link, onNotice)}
          onStat={(label) => onNotice(`${label}: ${label === 'Beiträge' ? 'Deine Posts' : label === 'Follower' ? 'Deine Follower' : 'Denen du folgst'}`)}
          onAvatarPress={() => onNotice('Dein Profilbild')}
        />

        {spende && (
          <View style={styles.spende}>
            <Text style={styles.spendeTitel}>{spende.titel}</Text>
            {!!spende.text && <Text style={styles.spendeText}>{spende.text}</Text>}
            <View style={styles.spendeBalken}>
              <View
                style={[
                  styles.spendeFuellung,
                  { width: `${Math.min(100, Math.round((spende.gesammelt / spende.ziel) * 100))}%` },
                ]}
              />
            </View>
            <Text style={styles.spendeZahlen}>
              {spende.gesammelt} € von {spende.ziel} € gesammelt
            </Text>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
          {playlists.map((label) => (
            <Druck key={`pl-${label}`} style={styles.highlight} onPress={() => onNotice(`Playlist „${label}“`)}>
              <View style={[styles.ring, styles.ringPlaylist]}>
                <Motiv id={`pl-${label}`} icon="play-outline" iconSize={22} style={styles.ringInhalt} />
              </View>
              <View style={[styles.abzeichen, styles.abzeichenPlaylist]}>
                <Ionicons name="play" size={10} color={colors.white} />
              </View>
              <Text style={styles.highlightLabel} numberOfLines={1}>
                {label}
              </Text>
            </Druck>
          ))}
          {highlights.map((label) => (
            <Druck key={`hl-${label}`} style={styles.highlight} onPress={() => onNotice(`Highlight „${label}“`)}>
              <View style={[styles.ring, styles.ringHighlight]}>
                <Motiv id={`hl-${label}`} icon="image-outline" iconSize={22} style={styles.ringInhalt} />
              </View>
              <View style={[styles.abzeichen, styles.abzeichenHighlight]}>
                <Ionicons name="star" size={10} color={colors.white} />
              </View>
              <Text style={styles.highlightLabel} numberOfLines={1}>
                {label}
              </Text>
            </Druck>
          ))}
        </ScrollView>

        <View style={styles.tabs}>
          {TABS.map((item) => (
            <Druck
              key={item.key}
              style={[styles.tab, tab === item.key && styles.tabActive]}
              onPress={() => setTab(item.key)}
            >
              <Ionicons name={item.icon} size={22} color={tab === item.key ? colors.text : colors.text3} />
            </Druck>
          ))}
        </View>

        {tab === 'grid' ? (
          <View style={styles.grid}>
            {raster.map((eintrag) => (
              <Druck key={eintrag.id} style={[styles.gridItem, { height: kachelHoehe }]} onPress={() => onNotice(`Beitrag: ${eintrag.id}`)}>
                {eintrag.mediaUri ? (
                  // Selbst aufgenommen: das echte Bild statt des Platzhalters.
                  <Image source={{ uri: eintrag.mediaUri }} style={styles.gridBild} />
                ) : (
                  <Motiv
                    id={eintrag.id}
                    icon={eintrag.kind === 'video' ? 'play-outline' : 'image-outline'}
                    iconSize={20}
                    style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                  />
                )}
              </Druck>
            ))}
          </View>
        ) : tab === 'repost' && reposts.length > 0 ? (
          // Der Reiter war immer leer. Jetzt stehen hier die Beitraege und
          // Videos, die man selbst repostet hat.
          <View style={styles.grid}>
            {reposts.map((r) => (
              <Druck key={`${r.art}-${r.id}`} style={[styles.gridItem, { height: kachelHoehe }]} onPress={() => onNotice(`Repost: ${r.id}`)}>
                <Motiv
                  id={`${r.art}-${r.id}`}
                  icon={r.art === 'video' ? 'play-outline' : 'image-outline'}
                  iconSize={20}
                  style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                />
                <View style={styles.repostMarke}>
                  <Ionicons name="repeat" size={12} color={colors.white} />
                </View>
              </Druck>
            ))}
          </View>
        ) : (
          <EmptyState
            icon={TABS.find((t) => t.key === tab)!.icon}
            title={tab === 'repost' ? 'Noch nichts repostet' : 'Noch nichts hier'}
            text={
              tab === 'repost'
                ? 'Tippe im Feed auf den Repost-Knopf, dann erscheint es hier.'
                : 'Dieser Bereich füllt sich, sobald du ihn benutzt.'
            }
          />
        )}
      </ScrollView>
    </View>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  repostMarke: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingBottom: spacing.xl },

  spende: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
  },
  spendeTitel: { ...typography.name, color: colors.text },
  spendeText: { ...typography.preview, color: colors.text2, marginTop: 3 },
  spendeBalken: {
    marginTop: 9,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface3,
    overflow: 'hidden',
  },
  spendeFuellung: { height: '100%', backgroundColor: colors.brand },
  spendeZahlen: { ...typography.small, color: colors.text3, marginTop: 6 },

  highlights: { gap: 14, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  highlight: { alignItems: 'center', gap: 6, width: 68 },
  /*
   * Punkt 39: Playlist und Highlight muessen auseinanderzuhalten sein. Hier
   * unterschied sie nur ein blasses Symbol im Kreis — auf einem Bildschirm
   * nebeneinander sah man keinen Unterschied. Die Website loest es seit dem
   * 26.08.2026 ueber die Form: eine Playlist ist ein abgerundetes Quadrat mit
   * einem Dreieck, ein Highlight ein Kreis mit einem Stern. Dieselbe Sprache
   * jetzt auch hier.
   */
  ring: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  ringPlaylist: { borderRadius: 18 },
  ringHighlight: { borderRadius: 31 },
  ringInhalt: { width: 58, height: 58 },
  /* Das Abzeichen sitzt unten rechts auf dem Rand — deshalb absolut, mit
     einem Rand in der Flaechenfarbe, damit es sich abhebt. */
  abzeichen: {
    position: 'absolute',
    right: 2,
    top: 44,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  abzeichenPlaylist: { backgroundColor: colors.brand },
  abzeichenHighlight: { backgroundColor: '#F0397E' },
  highlightLabel: { ...typography.small, color: colors.text2 },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.text },
  /*
   * Das Raster hatte nur zwei Spalten statt drei. Grund: 3 × 33 % plus zwei
   * Luecken von je 2px sind zusammen breiter als die Zeile — das dritte Feld
   * rutschte um. Abstand jetzt ueber einen Rand in Hintergrundfarbe statt
   * ueber gap, dann bleibt die Breite exakt ein Drittel. Genauso macht es
   * UserProfileScreen, wo es immer richtig war.
   */
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
  gridBild: { width: '100%', height: '100%' },
}));
