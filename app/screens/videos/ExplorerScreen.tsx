import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius, sizes, spacing, typography } from '../../constants/design';
import { mockPlaces, mockPosts, mockSounds, mockUsers, mockVideos } from '../../mocks';
import { useProfil } from '../../contexts/ProfilContext';
import { Clip, Post, Video } from '../../types';

export type ExplorerArt = 'hashtag' | 'standort' | 'sound';

export interface ExplorerZiel {
  art: ExplorerArt;
  /** Hashtag mit Raute, sonst die id von Standort bzw. Sound. */
  wert: string;
}

interface Props {
  ziel: ExplorerZiel;
  onBack: () => void;
  /** Oeffnet den Querformat-Player. */
  onOpenClip: (clipId: string) => void;
  onNotice: (message: string) => void;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k` : String(n);

/**
 * Was hinter einem Hashtag, einem Standort und einem Sound steckt.
 * Prototyp-Frames "VS# - Hashtagoptionen", "VSS + Standort" und
 * "VSSo + Sound". Alle drei sind gleich aufgebaut: ein eigener Kopf und
 * darunter die Abschnitte Reels, Querformat und Beiträge.
 */
export const ExplorerScreen = ({ ziel, onBack, onOpenClip, onNotice }: Props) => {
  const insets = useSafeAreaInsets();
  const { clips, eigeneBeitraege, eigeneVideos } = useProfil();

  const platz = ziel.art === 'standort' ? mockPlaces.find((p) => p.id === ziel.wert) : undefined;
  const sound = ziel.art === 'sound' ? mockSounds.find((s) => s.id === ziel.wert) : undefined;

  const treffer = useMemo(() => {
    const alleBeitraege = [...eigeneBeitraege, ...mockPosts];
    const alleVideos = [...eigeneVideos, ...mockVideos];

    const passt = (e: { tags?: string[]; location?: string; music?: string }) => {
      if (ziel.art === 'hashtag') return (e.tags ?? []).includes(ziel.wert);
      if (ziel.art === 'standort') return !!platz && e.location === platz.ort;
      return !!sound && typeof e.music === 'string' && e.music.startsWith(sound.title);
    };

    return {
      reels: alleVideos.filter(passt),
      clips: clips.filter(passt),
      beitraege: alleBeitraege.filter(passt),
    };
  }, [ziel, platz, sound, clips, eigeneBeitraege, eigeneVideos]);

  const leer = !treffer.reels.length && !treffer.clips.length && !treffer.beitraege.length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable onPress={onBack} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        {ziel.art === 'hashtag' && <HashtagKopf tag={ziel.wert} />}
        {ziel.art === 'standort' && platz && <StandortKopf platz={platz} onNotice={onNotice} anzahl={treffer.beitraege.length + treffer.clips.length + treffer.reels.length} />}
        {ziel.art === 'sound' && sound && <SoundKopf sound={sound} />}

        {leer ? (
          <EmptyState icon="search-outline" title="Noch nichts hier" text="Dazu gibt es bisher keine Beiträge." />
        ) : (
          <>
            {treffer.reels.length > 0 && (
              <>
                <Text style={styles.abschnitt}>Reels →</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reels}>
                  {treffer.reels.map((v: Video) => (
                    <Pressable key={v.id} style={styles.reel} onPress={() => onNotice(v.description)}>
                      {v.mediaUri ? (
                        <Image source={{ uri: v.mediaUri }} style={styles.voll} />
                      ) : (
                        <Ionicons name="play-outline" size={30} color={colors.text3} />
                      )}
                      <Text style={styles.reelText} numberOfLines={2}>
                        {v.description}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            {treffer.clips.length > 0 && (
              <>
                <Text style={styles.abschnitt}>Querformat →</Text>
                {treffer.clips.map((c: Clip) => (
                  <Pressable key={c.id} style={styles.clip} onPress={() => onOpenClip(c.id)}>
                    <View style={styles.clipBild}>
                      <Ionicons name="tv-outline" size={30} color={colors.text3} />
                      <View style={styles.clipZeit}>
                        <Text style={styles.clipZeitText}>{c.duration}</Text>
                      </View>
                    </View>
                    <View style={styles.clipMeta}>
                      <Avatar id={c.userId} name={mockUsers[c.userId].name} size={sizes.avatarSm} />
                      <View style={styles.clipTexte}>
                        <Text style={styles.clipTitel} numberOfLines={2}>
                          {c.title}
                        </Text>
                        <Text style={styles.clipSub}>
                          {mockUsers[c.userId].name} · {compact(c.views)} Aufrufe
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </>
            )}

            {treffer.beitraege.length > 0 && (
              <>
                <Text style={styles.abschnitt}>Beiträge →</Text>
                <View style={styles.raster}>
                  {treffer.beitraege.map((p: Post) => (
                    <Pressable key={p.id} style={styles.rasterFeld} onPress={() => onNotice(p.description)}>
                      {p.mediaUri ? (
                        <Image source={{ uri: p.mediaUri }} style={styles.voll} />
                      ) : (
                        <Ionicons name="image-outline" size={26} color={colors.text3} />
                      )}
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

/* --------------------------------------------------------------- Koepfe */

const HashtagKopf = ({ tag }: { tag: string }) => (
  <View style={[styles.kopf, styles.kopfMitte]}>
    <Text style={styles.titel}>{tag}</Text>
  </View>
);

const StandortKopf = ({
  platz,
  anzahl,
  onNotice,
}: {
  platz: (typeof mockPlaces)[number];
  anzahl: number;
  onNotice: (message: string) => void;
}) => (
  <View style={styles.kopf}>
    <View style={styles.ortZeile}>
      <Ionicons name="location-outline" size={22} color={colors.text} />
      <Text style={styles.titelKlein}>{platz.name}</Text>
      <Text style={styles.zahl}>{compact(platz.posts)} Beiträge</Text>
    </View>
    <Text style={styles.adresse}>{platz.adresse}</Text>
    <Text style={styles.koordinaten}>{platz.koordinaten}</Text>

    {/*
      Selbst gezeichnet, wie schon bei der Friend-Map: react-native-maps
      braucht nativen Code und laeuft in Expo Go nicht.
    */}
    <View style={styles.karte}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={`w${i}`} style={[styles.linie, { top: `${i * 16}%` }]} />
      ))}
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={`s${i}`} style={[styles.linie, styles.linieSenkrecht, { left: `${i * 16}%` }]} />
      ))}
      <View style={[styles.nadel, { left: `${platz.x ?? 50}%`, top: `${platz.y ?? 50}%` }]}>
        <Ionicons name="location" size={28} color={colors.danger} />
      </View>
    </View>

    <Pressable
      onPress={() => onNotice(anzahl ? `${anzahl} Aufnahmen von diesem Ort stehen unten` : 'Von diesem Ort gibt es noch nichts')}
    >
      <Text style={styles.link}>Alle Fotos ansehen →</Text>
    </Pressable>
  </View>
);

const SoundKopf = ({ sound }: { sound: (typeof mockSounds)[number] }) => {
  const [laeuft, setLaeuft] = useState(false);
  const [bei, setBei] = useState(0);
  const stand = useRef(0);

  const [min, sek] = String(sound.dauer ?? '3:00').split(':').map(Number);
  const gesamt = min * 60 + sek;

  useEffect(() => {
    if (!laeuft) return;
    const uhr = setInterval(() => {
      stand.current = (stand.current + 1) % (gesamt + 1);
      setBei(stand.current);
    }, 1000);
    return () => clearInterval(uhr);
  }, [laeuft, gesamt]);

  const balken = 40;
  const bis = Math.round((bei / gesamt) * balken);

  return (
    <View style={[styles.kopf, styles.kopfMitte]}>
      <View style={styles.cover}>
        <Ionicons name="musical-notes-outline" size={52} color={colors.text3} />
      </View>
      <Text style={styles.titel}>{sound.title}</Text>
      <Text style={styles.zahl}>
        {sound.artist} · {compact(sound.uses)} Beiträge
      </Text>

      <View style={styles.welle}>
        <Pressable style={styles.play} onPress={() => setLaeuft((v) => !v)} accessibilityLabel={laeuft ? 'Pause' : 'Abspielen'}>
          <Ionicons name={laeuft ? 'pause' : 'play'} size={16} color={colors.text} />
        </Pressable>
        <View style={styles.wellenBalken}>
          {Array.from({ length: balken }, (_, i) => (
            <View
              key={i}
              style={[
                styles.balken,
                { height: `${20 + Math.round(60 * Math.abs(Math.sin(i * 1.1)))}%` },
                i < bis && styles.balkenGespielt,
              ]}
            />
          ))}
        </View>
        <Text style={styles.wellenZeit}>
          {Math.floor(bei / 60)}:{String(bei % 60).padStart(2, '0')} / {sound.dauer}
        </Text>
      </View>

      <Text style={styles.lyrics}>{sound.lyrics}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  bar: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },

  kopf: { padding: spacing.lg },
  kopfMitte: { alignItems: 'center' },
  titel: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: spacing.md },
  titelKlein: { fontSize: 21, fontWeight: '700', color: colors.text },
  zahl: { ...typography.preview, color: colors.text2, marginTop: 3 },

  ortZeile: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  adresse: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...typography.message,
    color: colors.text,
  },
  koordinaten: { ...typography.small, color: colors.text3, marginTop: 2 },

  karte: {
    position: 'relative',
    marginTop: spacing.md,
    height: 150,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  linie: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  linieSenkrecht: { top: 0, bottom: 0, right: undefined, width: StyleSheet.hairlineWidth, height: undefined },
  nadel: { position: 'absolute', transform: [{ translateX: -14 }, { translateY: -28 }] },
  link: { ...typography.name, color: colors.brand, marginTop: spacing.md },

  cover: {
    width: 148,
    height: 148,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    marginTop: spacing.md,
    padding: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
  },
  play: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wellenBalken: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 34 },
  balken: { flex: 1, borderRadius: 1, backgroundColor: colors.text3, opacity: 0.45 },
  balkenGespielt: { backgroundColor: colors.brand, opacity: 1 },
  wellenZeit: { ...typography.small, color: colors.text2, fontVariant: ['tabular-nums'] },
  lyrics: { ...typography.preview, color: colors.text2, marginTop: 10 },

  abschnitt: { ...typography.h3, color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },

  reels: { gap: 8, paddingHorizontal: spacing.lg },
  reel: {
    width: 108,
    height: 168,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reelText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 7,
    ...typography.tiny,
    color: colors.white,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  voll: { width: '100%', height: '100%' },

  clip: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  clipBild: {
    height: 150,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipZeit: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  clipZeitText: { ...typography.tiny, color: colors.white },
  clipMeta: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  clipTexte: { flex: 1 },
  clipTitel: { ...typography.name, color: colors.text },
  clipSub: { ...typography.small, color: colors.text2, marginTop: 2 },

  raster: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 2 },
  rasterFeld: {
    width: '33%',
    aspectRatio: 1,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
