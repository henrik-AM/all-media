import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Motiv } from '../../components/Motiv';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../../constants/design';
import { mockPlaces, mockPosts, mockSounds, mockUsers, mockVideos } from '../../mocks';
import { useProfil } from '../../contexts/ProfilContext';
import { aufnehmen } from '../../lib/aufnehmen';
import { Clip, Post, Video } from '../../types';
import { useKachelHoehe } from '../../lib/raster';

export type ExplorerArt = 'reels' | 'querformat' | 'beitraege' | 'profile' | 'hashtag' | 'standort' | 'sound';

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
  const kachelHoehe = useKachelHoehe();
  const insets = useSafeAreaInsets();
  const { clips, eigeneBeitraege, eigeneVideos } = useProfil();

  const [nurFotos, setNurFotos] = useState(false);
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

  /*
   * Punkt 10: die eigene Seite mit allen Fotos an diesem Ort. Sie liegt als
   * Zustand im selben Bildschirm und nicht als eigene Ueberlagerung - der
   * Weg zurueck fuehrt genau hierher, und der Ort steht dann schon fest.
   */
  if (nurFotos && platz) {
    return (
      <OrtFotos
        platz={platz}
        fotos={treffer.beitraege}
        onBack={() => setNurFotos(false)}
        onNotice={onNotice}
      />
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Druck onPress={onBack} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Druck>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        {ziel.art === 'hashtag' && <HashtagKopf tag={ziel.wert} />}
        {ziel.art === 'standort' && platz && (
          <StandortKopf platz={platz} onAlleFotos={() => setNurFotos(true)} />
        )}
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
                    <Druck key={v.id} style={styles.reel} onPress={() => onNotice(v.description)}>
                      {v.mediaUri ? (
                        <Image source={{ uri: v.mediaUri }} style={styles.voll} />
                      ) : (
                        <Motiv id={v.id} icon="play-outline" iconSize={26} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                      )}
                      <Text style={styles.reelText} numberOfLines={2}>
                        {v.description}
                      </Text>
                    </Druck>
                  ))}
                </ScrollView>
              </>
            )}

            {treffer.clips.length > 0 && (
              <>
                <Text style={styles.abschnitt}>Querformat →</Text>
                {treffer.clips.map((c: Clip) => (
                  <Druck key={c.id} style={styles.clip} onPress={() => onOpenClip(c.id)}>
                    <View style={styles.clipBild}>
                      <Motiv id={c.id} icon="tv-outline" iconSize={26} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
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
                  </Druck>
                ))}
              </>
            )}

            {treffer.beitraege.length > 0 && (
              <>
                <Text style={styles.abschnitt}>Beiträge →</Text>
                <View style={styles.raster}>
                  {treffer.beitraege.map((p: Post) => (
                    <Druck key={p.id} style={[styles.rasterFeld, { height: kachelHoehe }]} onPress={() => onNotice(p.description)}>
                      {p.mediaUri ? (
                        <Image source={{ uri: p.mediaUri }} style={styles.voll} />
                      ) : (
                        <Motiv id={p.id} icon="image-outline" iconSize={20} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                      )}
                    </Druck>
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

/**
 * Alle Fotos an einem Ort — Prototyp-Frame "VSS + Standort + Alle Fotos".
 *
 * Der Frame zeigt quadratische Aufnahmen untereinander, jede mit Autorzeile
 * (Bild, Name, "Standort · Musik") darunter. Also ein Feed, keine
 * Rasteruebersicht - und ausdruecklich nur Fotos: Reels und
 * Querformat-Videos bleiben draussen.
 */
const OrtFotos = ({
  platz,
  fotos,
  onBack,
  onNotice,
}: {
  platz: (typeof mockPlaces)[number];
  fotos: Post[];
  onBack: () => void;
  onNotice: (message: string) => void;
}) => {
  const insets = useSafeAreaInsets();
  const { eigeneBeitraege, beitragAnlegen, raster } = useProfil();

  // Selbst hinzugefuegte Fotos an diesem Ort kommen oben dazu.
  const eigene = eigeneBeitraege.filter((p) => p.location === platz.name || p.location === platz.ort);
  const alle = [...eigene.filter((p) => !fotos.some((f) => f.id === p.id)), ...fotos];

  const hinzufuegen = async () => {
    const uri = await aufnehmen('photo', onNotice);
    if (!uri) return;
    beitragAnlegen({ beschreibung: 'Aufnahme an diesem Ort', ort: platz.name, mediaUri: uri });
    onNotice('Foto hinzugefügt');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.fotosBar}>
        <Druck onPress={onBack} hitSlop={10} accessibilityLabel="Zurück">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Druck>
        <Text style={styles.fotosTitel}>Alle Fotos</Text>
        {/* Punkt 10, zweiter Teil: "Möglichkeit für User, Fotos hochzuladen." */}
        <Druck onPress={hinzufuegen} hitSlop={10} accessibilityLabel="Foto hinzufügen">
          <Ionicons name="add" size={26} color={colors.text} />
        </Druck>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <Text style={styles.fotosSub}>
          {platz.name} · {alle.length} {alle.length === 1 ? 'Foto' : 'Fotos'}
        </Text>

        {alle.length === 0 ? (
          <EmptyState
            icon="image-outline"
            title="Noch keine Fotos"
            text="Über das Plus oben rechts legst du das erste hier ab."
          />
        ) : (
          alle.map((p) => {
            const person = mockUsers[p.userId];
            const eigenesBild = p.mediaUri ?? raster.find((r) => r.id === p.id)?.mediaUri;
            return (
              <View key={p.id} style={styles.ortfoto}>
                <View style={styles.ortfotoBild}>
                  {eigenesBild ? (
                    <Image source={{ uri: eigenesBild }} style={styles.voll} />
                  ) : (
                    <Motiv
                      id={p.id}
                      icon="image-outline"
                      iconSize={44}
                      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                    />
                  )}
                </View>
                <View style={styles.ortfotoZeile}>
                  <Avatar id={p.userId} name={person.name} size={36} />
                  <View style={styles.ortfotoWer}>
                    <Text style={styles.ortfotoName}>{person.name}</Text>
                    <Text style={styles.ortfotoMeta} numberOfLines={1}>
                      {p.location}
                      {p.music ? ` · ${p.music}` : ''}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const StandortKopf = ({
  platz,
  onAlleFotos,
}: {
  platz: (typeof mockPlaces)[number];
  onAlleFotos: () => void;
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

    {/*
      Punkt 10: "Alle Fotos ansehen leitet zu Videos/Beiträgen; soll nur
      Fotos zeigen." Vorher gab der Knopf nur einen Hinweis aus und man blieb
      in derselben Liste aus Reels, Querformat und Beitraegen, aus der man
      kam. Jetzt fuehrt er auf eine eigene Seite - Prototyp-Frame
      "VSS + Standort + Alle Fotos".
    */}
    <Druck onPress={onAlleFotos}>
      <Text style={styles.link}>Alle Fotos ansehen →</Text>
    </Druck>
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
        <Druck style={styles.play} onPress={() => setLaeuft((v) => !v)} accessibilityLabel={laeuft ? 'Pause' : 'Abspielen'}>
          <Ionicons name={laeuft ? 'pause' : 'play'} size={16} color={colors.text} />
        </Druck>
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

      {/*
        Punkt 11: der Liedtext. Prototyp-Frame "VSSo + Sound + Lyrics" -
        Songname, Produzent/in, Trennlinie, darunter der Text ueber die ganze
        Seite. Vorher stand hier eine einzige Zeile, und bei einem
        Instrumental das Wort "Instrumental" als waere es eine Liedzeile.

        Leere Eintraege sind Strophenabstaende. Sie bekommen eine eigene
        Hoehe statt einer leeren Textzeile - so bleibt der Abstand gleich,
        egal wie gross die Schrift eingestellt ist.
      */}
      {sound.lyrics?.length ? (
        <View style={styles.lyrics}>
          <Text style={styles.lyricsKopf}>LIEDTEXT</Text>
          {sound.lyrics.map((zeile, i) =>
            zeile.trim() ? (
              <Text key={i} style={styles.lyricsZeile}>
                {zeile}
              </Text>
            ) : (
              <View key={i} style={styles.lyricsLuecke} />
            )
          )}
        </View>
      ) : (
        <View style={styles.lyrics}>
          <Text style={styles.lyricsOhne}>Zu diesem Sound gibt es keinen Liedtext.</Text>
        </View>
      )}
    </View>
  );
};

const styles = themenStyles((colors) => ({
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
  /* Zeilenhoehe 26 auf 15px Schrift - Liedtext liest sich mit mehr Luft als
     Fliesstext, weil jede Zeile eine eigene Einheit ist. */
  lyrics: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignSelf: 'stretch',
  },
  lyricsKopf: { ...typography.overline, color: colors.text3, marginBottom: 10 },
  lyricsZeile: { fontSize: 15, lineHeight: 26, color: colors.text },
  lyricsLuecke: { height: 14 },
  lyricsOhne: { ...typography.preview, color: colors.text3 },

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
    overflow: 'hidden',
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

  /* 3 × 33 % plus zwei Lücken von je 2px sind breiter als die Zeile - das
     dritte Feld rutscht um. Abstand deshalb über einen Rand in
     Hintergrundfarbe, dann bleibt die Breite exakt ein Drittel. */
  raster: { flexDirection: 'row', flexWrap: 'wrap' },
  /* ---- Alle Fotos an einem Ort (Prototyp "VSS + Standort + Alle Fotos") ---- */
  fotosBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  fotosTitel: { flex: 1, textAlign: 'center', ...typography.h3, fontSize: 17, color: colors.text },
  fotosSub: { ...typography.small, color: colors.text3, paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 4 },
  ortfoto: { paddingBottom: 18, marginBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  ortfotoBild: {
    marginHorizontal: '8%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface3,
  },
  ortfotoZeile: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: '8%', paddingTop: 10 },
  ortfotoWer: { flex: 1, minWidth: 0 },
  ortfotoName: { ...typography.name, fontSize: 14.5, color: colors.text },
  ortfotoMeta: { ...typography.small, color: colors.text3 },

  rasterFeld: {
    width: '33.333%',
    borderWidth: 1,
    borderColor: colors.surface,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
}));
