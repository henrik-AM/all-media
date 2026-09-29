import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KarteWeb, KartenSteuerung, Pin as KartenPin } from '../../components/KarteWeb';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Motiv } from '../../components/Motiv';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';
import { useProfil } from '../../contexts/ProfilContext';
import { CameraScreen } from '../messenger/CameraScreen';
import { Clip, Hashtag, Place, Post, Sound, User, Video } from '../../types';
import { useKachelHoehe } from '../../lib/raster';
import { nachInteresse, VORSCHAU } from '../../lib/interesse';
import { ortFinden, soundFinden } from '../../lib/ziele';
// Gemeinsam mit der Website: welche Liedzeile gerade dran ist, und welche Orte nah liegen.
const Liedtext = require('../../../gemeinsam/liedtext') as typeof import('../../../gemeinsam/liedtext');
const Naehe = require('../../../gemeinsam/naehe') as typeof import('../../../gemeinsam/naehe');

export type ExplorerArt = 'reels' | 'querformat' | 'beitraege' | 'profile' | 'hashtag' | 'standort' | 'sound';

export interface ExplorerZiel {
  art: ExplorerArt;
  /**
   * Hashtag mit Raute, sonst die id von Standort bzw. Sound. Leer (bei
   * Hashtags nur die Raute) heisst: die Uebersicht aller Hashtags, Orte oder
   * Sounds. Bei Reels, Querformat, Beitraegen und Profilen bleibt er leer.
   */
  wert: string;
  /** Suchbegriff aus der Suche, mit dem eine Uebersicht gefiltert wird. */
  suche?: string;
  /** Auf einer Detailseite nur dieser Abschnitt, dafuer vollstaendig. */
  nur?: 'reels' | 'clips' | 'beitraege';
}

interface Props {
  ziel: ExplorerZiel;
  onBack: () => void;
  /** Oeffnet den Querformat-Player. */
  onOpenClip: (clipId: string) => void;
  /**
   * Ein Reel oder ein Beitrag von dieser Seite aus.
   *
   * Beide gaben bis zum 02.09.2026 nur die Beschreibung als Hinweistext aus.
   * Der Querformat-Player war der einzige Treffer, der wirklich aufging.
   */
  onOpenEintrag: (art: 'reel' | 'beitrag', id: string) => void;
  onOpenProfile?: (userId: string) => void;
  onNotice: (message: string) => void;
}

/** Wie viele Eintraege ein Abschnitt zeigt, bevor man auf die Ueberschrift tippt. */
const ABSCHNITT_VORSCHAU = { reels: VORSCHAU, clips: 3, beitraege: 6 };

const istUebersicht = (z: ExplorerZiel) =>
  ['reels', 'querformat', 'beitraege', 'profile'].includes(z.art) ||
  (z.art === 'hashtag' && z.wert === '#') ||
  (z.art !== 'hashtag' && !z.wert);

const fensterHoehe = Dimensions.get('window').height;

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k` : String(n);

/**
 * Was hinter einem Hashtag, einem Standort und einem Sound steckt.
 * Prototyp-Frames "VS# - Hashtagoptionen", "VSS + Standort" und
 * "VSSo + Sound". Alle drei sind gleich aufgebaut: ein eigener Kopf und
 * darunter die Abschnitte Reels, Querformat und Beiträge.
 */
export const ExplorerScreen = (props: Props) => {
  /*
   * Henrik am 21.09.2026: "Ueberschrift mit Pfeil fuehrt in eine leere
   * Seite, obwohl die Vorschau Beitraege zeigt" und "Hashtag-Detailseite:
   * Ueberschrift nicht anklickbar, Liste nicht aufklappbar". Die Seite kannte
   * nur einen einzelnen Hashtag, Ort oder Sound - fuer "Reels" oder "alle
   * Hashtags" fand passt() nichts und zeigte "Noch nichts hier".
   *
   * Jetzt gibt es Uebersichten und Detailseiten, und von jeder fuehrt eine
   * Ueberschrift eine Ebene tiefer. Der Stapel sorgt dafuer, dass der
   * Zurueck-Pfeil genau eine Ebene hochgeht statt ganz aus der Suche.
   */
  const [stapel, setStapel] = useState<ExplorerZiel[]>([props.ziel]);
  useEffect(() => setStapel([props.ziel]), [props.ziel]);
  const aktuell = stapel[stapel.length - 1] ?? props.ziel;
  return (
    <ExplorerSeite
      key={stapel.length}
      {...props}
      ziel={aktuell}
      onBack={stapel.length > 1 ? () => setStapel((s) => s.slice(0, -1)) : props.onBack}
      onWeiter={(z) => setStapel((s) => [...s, z])}
    />
  );
};

const ExplorerSeite = ({
  ziel,
  onBack,
  onWeiter,
  onOpenClip,
  onOpenEintrag,
  onOpenProfile,
  onNotice,
}: Props & { onWeiter: (ziel: ExplorerZiel) => void }) => {
  const { hashtags: alleHashtags, places: alleOrte, posts: alleBeitraege, sounds: alleSounds, users: alleNutzer, videos: alleVideos } = useDaten();
  const kachelHoehe = useKachelHoehe();
  const insets = useSafeAreaInsets();
  const { clips, eigeneBeitraege, eigeneVideos, folgtPerson } = useProfil();
  const uebersicht = istUebersicht(ziel);

  const [nurFotos, setNurFotos] = useState(false);
  const platz = ziel.art === 'standort' ? ortFinden(alleOrte, ziel.wert) : undefined;
  const sound = ziel.art === 'sound' ? soundFinden(alleSounds, ziel.wert) : undefined;

  const treffer = useMemo(() => {
    // Was gerade erst angelegt wurde, steht noch nicht in der geladenen Liste
    // - es käme erst beim nächsten Laden mit. Deshalb vorne dran.
    const beitraege = [...eigeneBeitraege, ...alleBeitraege];
    const videos = [...eigeneVideos, ...alleVideos];

    const q = (ziel.suche ?? '').trim().toLowerCase();
    const hit = (text?: string) => !q || (text ?? '').toLowerCase().includes(q);
    const gefolgt = (e: { userId: string }) => folgtPerson(e.userId);
    const name = (id: string) => alleNutzer[id]?.name ?? '';

    if (uebersicht) {
      // Dieselben Suchregeln wie in VideoSearchScreen - die Uebersicht ist
      // die volle Liste hinter der Vorschau.
      const alle = {
        reels: ziel.art === 'reels'
          ? nachInteresse(videos.filter((v) => hit(v.description) || hit(v.music) || hit(name(v.userId))), (v) => v.likes, gefolgt)
          : [],
        clips: ziel.art === 'querformat'
          ? nachInteresse(clips.filter((c) => hit(c.title) || hit(name(c.userId))), (c) => c.views, gefolgt)
          : [],
        beitraege: ziel.art === 'beitraege'
          ? nachInteresse(beitraege.filter((p) => hit(p.description) || hit(p.music) || hit(name(p.userId))), (p) => p.likes, gefolgt)
          : [],
      };
      return alle;
    }

    const passt = (e: { tags?: string[]; location?: string; music?: string }) => {
      if (ziel.art === 'hashtag') return (e.tags ?? []).includes(ziel.wert);
      if (ziel.art === 'standort') return !!platz && e.location === platz.ort;
      return !!sound && typeof e.music === 'string' && e.music.startsWith(sound.title);
    };

    return {
      reels: nachInteresse(videos.filter(passt), (v) => v.likes, gefolgt),
      clips: nachInteresse(clips.filter(passt), (c) => c.views, gefolgt),
      beitraege: nachInteresse(beitraege.filter(passt), (p) => p.likes, gefolgt),
    };
  }, [ziel, uebersicht, platz, sound, clips, eigeneBeitraege, eigeneVideos, alleBeitraege, alleVideos, folgtPerson]);

  // Die Listen der Uebersichten, die keine Aufnahmen sind.
  const liste = useMemo(() => {
    const q = (ziel.suche ?? '').trim().toLowerCase();
    const hit = (text?: string) => !q || (text ?? '').toLowerCase().includes(q);
    if (!uebersicht) return null;
    if (ziel.art === 'profile') {
      return {
        profile: nachInteresse(
          Object.values(alleNutzer).filter((u) => u.id !== 'me' && (hit(u.name) || hit(u.handle))),
          () => 0,
          (u) => folgtPerson(u.id)
        ),
      };
    }
    if (ziel.art === 'hashtag') return { hashtags: nachInteresse(alleHashtags.filter((h) => hit(h.tag)), (h) => h.posts) };
    if (ziel.art === 'standort') return { orte: nachInteresse(alleOrte.filter((p) => hit(p.name)), (p) => p.posts) };
    if (ziel.art === 'sound') {
      return { sounds: nachInteresse(alleSounds.filter((x) => hit(x.title) || hit(x.artist)), (x) => x.uses) };
    }
    return null;
  }, [ziel, uebersicht, alleNutzer, alleHashtags, alleOrte, alleSounds, folgtPerson]);

  /*
   * Auf einer Detailseite zeigt jeder Abschnitt nur eine Vorschau; die
   * Ueberschrift fuehrt zur vollen Liste. Auf einer Uebersicht oder einer
   * aufgeklappten Seite steht alles.
   */
  const zeigen = (art: 'reels' | 'clips' | 'beitraege') => {
    if (ziel.nur && ziel.nur !== art) return [];
    const alle = treffer[art] as any[];
    return uebersicht || ziel.nur ? alle : alle.slice(0, ABSCHNITT_VORSCHAU[art]);
  };
  const aufklappen = (art: 'reels' | 'clips' | 'beitraege') =>
    uebersicht || ziel.nur ? undefined : () => onWeiter({ ...ziel, nur: art });

  const leer = liste
    ? !Object.values(liste)[0].length
    : !zeigen('reels').length && !zeigen('clips').length && !zeigen('beitraege').length;

  const ABSCHNITT_NAME = { reels: 'Reels', clips: 'Querformat', beitraege: 'Beiträge' };
  const seitenTitel = uebersicht
    ? {
        reels: 'Reels',
        querformat: 'Querformat',
        beitraege: 'Beiträge',
        profile: 'Profile',
        hashtag: 'Hashtags',
        standort: 'Standorte',
        sound: 'Sounds',
      }[ziel.art]
    : ziel.nur
      ? `${ziel.art === 'hashtag' ? ziel.wert : ziel.art === 'standort' ? platz?.name ?? '' : sound?.title ?? ''} · ${ABSCHNITT_NAME[ziel.nur]}`
      : '';

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
        <Druck onPress={onBack} hitSlop={10} accessibilityLabel="Zurück">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Druck>
        {!!seitenTitel && (
          <Text style={styles.barTitel} numberOfLines={1}>
            {seitenTitel}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        {!uebersicht && !ziel.nur && ziel.art === 'hashtag' && <HashtagKopf tag={ziel.wert} />}
        {!uebersicht && !ziel.nur && ziel.art === 'standort' && platz && (
          <StandortKopf
            platz={platz}
            orte={alleOrte}
            fotos={treffer.beitraege}
            onAlleFotos={() => setNurFotos(true)}
            onOrt={(id) => onWeiter({ art: 'standort', wert: id })}
          />
        )}
        {!uebersicht && !ziel.nur && ziel.art === 'sound' && sound && <SoundKopf sound={sound} />}
        {!!ziel.suche?.trim() && uebersicht && (
          <Text style={styles.sucheHinweis}>Treffer für „{ziel.suche.trim()}"</Text>
        )}

        {leer ? (
          <EmptyState icon="search-outline" title="Noch nichts hier" text="Dazu gibt es bisher keine Beiträge." />
        ) : liste ? (
          <UebersichtListe liste={liste} onWeiter={onWeiter} onOpenProfile={onOpenProfile} />
        ) : (
          <>
            {zeigen('reels').length > 0 && (
              <>
                {!uebersicht && <Abschnitt titel="Reels" onPress={aufklappen('reels')} />}
                {uebersicht || ziel.nur ? (
                  <View style={styles.raster}>
                    {zeigen('reels').map((v: Video) => (
                      <Druck
                        key={v.id}
                        style={[styles.rasterFeld, { height: Math.round(kachelHoehe * 1.6) }]}
                        onPress={() => onOpenEintrag('reel', v.id)}
                      >
                        <Motiv id={v.id} bild={v.standbild ?? v.mediaUri} icon="play-outline" iconSize={26} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                        <Text style={styles.reelText} numberOfLines={1}>
                          {alleNutzer[v.userId]?.name ?? ''}
                        </Text>
                      </Druck>
                    ))}
                  </View>
                ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reels}>
                  {zeigen('reels').map((v: Video) => (
                    <Druck key={v.id} style={styles.reel} onPress={() => onOpenEintrag('reel', v.id)}>
                      {/* Motiv entscheidet selbst: Bild, wenn eines da ist,
                          sonst die Farbflaeche. Die frueher hier stehende
                          Abfrage auf mediaUri griff daneben, sobald dort eine
                          .mp4 stand — dann kam ein leeres Bild statt eines
                          Standbilds. */}
                      <Motiv id={v.id} bild={v.standbild ?? v.mediaUri} icon="play-outline" iconSize={26} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                      <Text style={styles.reelText} numberOfLines={2}>
                        {v.description}
                      </Text>
                    </Druck>
                  ))}
                </ScrollView>
                )}
              </>
            )}

            {zeigen('clips').length > 0 && (
              <>
                {!uebersicht && <Abschnitt titel="Querformat" onPress={aufklappen('clips')} />}
                {zeigen('clips').map((c: Clip) => (
                  <Druck key={c.id} style={styles.clip} onPress={() => onOpenClip(c.id)}>
                    <View style={styles.clipBild}>
                      <Motiv id={c.id} bild={c.standbild ?? c.mediaUri} icon="tv-outline" iconSize={26} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                      <View style={styles.clipZeit}>
                        <Text style={styles.clipZeitText}>{c.duration}</Text>
                      </View>
                    </View>
                    <View style={styles.clipMeta}>
                      <Avatar id={c.userId} name={(alleNutzer[c.userId]?.name ?? '')} size={sizes.avatarSm} />
                      <View style={styles.clipTexte}>
                        <Text style={styles.clipTitel} numberOfLines={2}>
                          {c.title}
                        </Text>
                        <Text style={styles.clipSub}>
                          {(alleNutzer[c.userId]?.name ?? '')} · {compact(c.views)} Aufrufe
                        </Text>
                      </View>
                    </View>
                  </Druck>
                ))}
              </>
            )}

            {zeigen('beitraege').length > 0 && (
              <>
                {!uebersicht && <Abschnitt titel="Beiträge" onPress={aufklappen('beitraege')} />}
                <View style={styles.raster}>
                  {zeigen('beitraege').map((p: Post) => (
                    <Druck key={p.id} style={[styles.rasterFeld, { height: kachelHoehe }]} onPress={() => onOpenEintrag('beitrag', p.id)}>
                      <Motiv id={p.id} bild={p.standbild ?? p.mediaUri} icon="image-outline" iconSize={20} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
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

/**
 * Abschnittsueberschrift. Mit Pfeil nur, wenn sie irgendwohin fuehrt - auf
 * einer aufgeklappten Seite waere der Pfeil ein Versprechen ohne Ziel.
 */
const Abschnitt = ({ titel, onPress }: { titel: string; onPress?: () => void }) =>
  onPress ? (
    <Druck onPress={onPress} accessibilityRole="button" accessibilityLabel={`${titel}, alle anzeigen`}>
      <Text style={styles.abschnitt}>{titel} →</Text>
    </Druck>
  ) : (
    <Text style={styles.abschnitt}>{titel}</Text>
  );

const UebersichtListe = ({
  liste,
  onWeiter,
  onOpenProfile,
}: {
  liste: { profile?: User[]; hashtags?: Hashtag[]; orte?: Place[]; sounds?: Sound[] };
  onWeiter: (ziel: ExplorerZiel) => void;
  onOpenProfile?: (userId: string) => void;
}) => (
  <View style={styles.liste}>
    {liste.profile?.map((u) => (
      <Druck key={u.id} style={styles.zeile} onPress={() => onOpenProfile?.(u.id)}>
        <Avatar id={u.id} name={u.name} size={44} />
        <View style={styles.zeileText}>
          <Text style={styles.zeileTitel}>{u.name}</Text>
          <Text style={styles.zeileSub}>{u.handle}</Text>
        </View>
      </Druck>
    ))}
    {liste.hashtags?.map((h) => (
      <Druck key={h.tag} style={styles.zeile} onPress={() => onWeiter({ art: 'hashtag', wert: h.tag })}>
        <View style={styles.zeileSymbol}>
          <Text style={styles.zeileRaute}>#</Text>
        </View>
        <View style={styles.zeileText}>
          <Text style={styles.zeileTitel}>{h.tag}</Text>
          <Text style={styles.zeileSub}>{compact(h.posts)} Beiträge</Text>
        </View>
      </Druck>
    ))}
    {liste.orte?.map((p) => (
      <Druck key={p.id} style={styles.zeile} onPress={() => onWeiter({ art: 'standort', wert: p.id })}>
        <View style={styles.zeileSymbol}>
          <Ionicons name="location-outline" size={20} color={colors.brand} />
        </View>
        <View style={styles.zeileText}>
          <Text style={styles.zeileTitel}>{p.name}</Text>
          <Text style={styles.zeileSub}>{compact(p.posts)} Beiträge</Text>
        </View>
      </Druck>
    ))}
    {liste.sounds?.map((x) => (
      <Druck key={x.id} style={styles.zeile} onPress={() => onWeiter({ art: 'sound', wert: x.id })}>
        <View style={styles.zeileSymbol}>
          <Ionicons name="musical-notes-outline" size={20} color={colors.brand} />
        </View>
        <View style={styles.zeileText}>
          <Text style={styles.zeileTitel}>{x.title}</Text>
          <Text style={styles.zeileSub}>
            {x.artist} · {compact(x.uses)} Videos
          </Text>
        </View>
      </Druck>
    ))}
  </View>
);

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
  platz: Place;
  fotos: Post[];
  onBack: () => void;
  onNotice: (message: string) => void;
}) => {
  const insets = useSafeAreaInsets();
  const { users: alleNutzer } = useDaten();
  const { eigeneBeitraege, beitragAnlegen, raster } = useProfil();

  // Selbst hinzugefuegte Fotos an diesem Ort kommen oben dazu.
  const eigene = eigeneBeitraege.filter((p) => p.location === platz.name || p.location === platz.ort);
  const alle = [...eigene.filter((p) => !fotos.some((f) => f.id === p.id)), ...fotos];

  /*
   * Das Plus oben rechts oeffnete bis zum 20.09.2026 die Kamera-App des
   * Systems. Im Simulator gab es die nicht, und einen Weg in die Galerie
   * kannte sie auch nicht — wer hier ein Foto beisteuern wollte, kam nicht
   * weiter. Jetzt geht die eigene Kamera auf, dieselbe wie im Messenger.
   */
  const [kameraAuf, setKameraAuf] = useState(false);

  const uebernehmen = (uri: string) => {
    setKameraAuf(false);
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
        <Druck onPress={() => setKameraAuf(true)} hitSlop={10} accessibilityLabel="Foto hinzufügen">
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
            const person = alleNutzer[p.userId];
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

      <Modal
        visible={kameraAuf}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setKameraAuf(false)}
      >
        <CameraScreen
          onClose={() => setKameraAuf(false)}
          direktZu={uebernehmen}
          onNotice={onNotice}
        />
      </Modal>
    </View>
  );
};

/** "53.5413° N, 9.9891° O" in Zahlen. Sued und West werden negativ. Rechnung in gemeinsam/naehe.js. */
export const koordinatenLesen = (text?: string): { lat: number; lng: number } | null =>
  Naehe.koordinatenLesen(text);

/** Ein Bild, das sich als Foto zeigen laesst — Videos nur ueber ihr Standbild. */
const fotoVon = (p: Post): string | undefined => {
  if (p.standbild) return p.standbild;
  if (p.mediaUri && !/\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(p.mediaUri)) return p.mediaUri;
  return undefined;
};

/*
 * Das Karussell unter dem Ortskopf. Prototyp-Frame "VSS + Standort",
 * Gruppe "B. Standortbilder": drei Seiten mit Pfeilen links und rechts und
 * drei Punkten darunter — Satellit weit, Satellit nah, ein Foto vom Ort.
 */
type OrtSeite = 'weit' | 'nah' | 'foto';

const StandortKopf = ({
  platz,
  orte,
  fotos,
  onAlleFotos,
  onOrt,
}: {
  platz: Place;
  orte: Place[];
  fotos: Post[];
  onAlleFotos: () => void;
  onOrt: (id: string) => void;
}) => {
  /*
   * Henrik am 21.09.2026 (Kasten 7.1): "Karte am Standort antippbar ->
   * springt in Kartenansicht wie bei der Friend-Map."
   *
   * Befund 28.09.2026: Ein Tipp auf die Karte tat nichts, nur der kleine
   * Vollbild-Knopf in der Ecke reagierte. Die Karte stand bei jedem Ort ueber
   * ganz Deutschland (Stufe 4), und die Vollbildansicht war eine nackte Karte
   * ohne die Liste, die die Friend-Map ausmacht.
   *
   * Jetzt: das Karussell aus dem Prototyp, jede Kartenseite als Ganzes
   * antippbar, und dahinter eine Kartenansicht wie die Friend-Map — Karte
   * auf den Ort, alle Orte als Nadeln, Ansichtswahl, Vollbild, und darunter
   * die Orte in der Naehe.
   */
  const [karteAuf, setKarteAuf] = useState(false);
  const hier = koordinatenLesen(platz.koordinaten);
  const foto = useMemo(() => fotos.map(fotoVon).find(Boolean), [fotos]);
  const seiten: OrtSeite[] = [
    ...(hier ? (['weit', 'nah'] as OrtSeite[]) : []),
    ...(foto ? (['foto'] as OrtSeite[]) : []),
  ];
  const [nr, setNr] = useState(0);
  const seite = seiten[Math.min(nr, seiten.length - 1)];
  const blaettern = (schritt: number) =>
    setNr((n) => (seiten.length ? (n + schritt + seiten.length) % seiten.length : 0));

  const eigenerPin: KartenPin[] = hier ? [{ id: platz.id, name: platz.name, ...hier }] : [];

  return (
    <View style={styles.kopf}>
      <View style={styles.ortZeile}>
        <Ionicons name="location-outline" size={22} color={colors.text} />
        <Druck onPress={onAlleFotos}>
          <Text style={styles.titelKlein}>{platz.name}</Text>
        </Druck>
        <Text style={styles.zahl}>{compact(platz.posts)} Beiträge</Text>
      </View>
      <Text style={styles.adresse}>{platz.adresse}</Text>
      <Text style={styles.koordinaten}>{platz.koordinaten}</Text>

      {!!seite && (
        <View style={styles.karussell}>
          <View style={styles.karte}>
            {seite === 'foto' && foto ? (
              <Druck onPress={onAlleFotos} accessibilityLabel={`Fotos von ${platz.name}`}>
                <Image source={{ uri: foto }} style={styles.karussellFoto} />
              </Druck>
            ) : hier ? (
              <KarteWeb
                // Eine eigene Karte je Seite: Ausschnitt und Ansicht stehen
                // beim Aufbau fest, und die Vorschau laesst sich ohnehin
                // nicht verschieben.
                key={seite}
                pins={eigenerPin}
                aktiv={platz.id}
                hoehe={190}
                eigenerStandort={null}
                start={{ ...hier, zoom: seite === 'weit' ? 5 : 15 }}
                stilStart={1}
                vorschau
                vorschauLabel="Karte öffnen"
                onKarteTippen={() => setKarteAuf(true)}
              />
            ) : null}
          </View>

          {seiten.length > 1 && (
            <>
              <Druck
                style={[styles.karussellPfeil, styles.karussellLinks]}
                onPress={() => blaettern(-1)}
                hitSlop={8}
                accessibilityLabel="Vorheriges Standortbild"
              >
                <Ionicons name="chevron-back" size={18} color="#1a1d21" />
              </Druck>
              <Druck
                style={[styles.karussellPfeil, styles.karussellRechts]}
                onPress={() => blaettern(1)}
                hitSlop={8}
                accessibilityLabel="Nächstes Standortbild"
              >
                <Ionicons name="chevron-forward" size={18} color="#1a1d21" />
              </Druck>
              <View style={styles.punkte}>
                {seiten.map((s, i) => (
                  <View key={s} style={[styles.punkt, s === seite && styles.punktAn]} />
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {/*
        Punkt 10: "Alle Fotos ansehen leitet zu Videos/Beiträgen; soll nur
        Fotos zeigen." Jetzt eine eigene Seite - Prototyp-Frame
        "VSS + Standort + Alle Fotos".
      */}
      <Druck onPress={onAlleFotos}>
        <Text style={styles.link}>Alle Fotos ansehen →</Text>
      </Druck>

      {hier && (
        <OrtKarte
          sichtbar={karteAuf}
          platz={platz}
          hier={hier}
          orte={orte}
          onZu={() => setKarteAuf(false)}
          onOrt={(id) => {
            setKarteAuf(false);
            onOrt(id);
          }}
        />
      )}
    </View>
  );
};

/**
 * Die Kartenansicht eines Ortes — aufgebaut wie die Friend-Map (Prototyp
 * "Messenger - Friend-Map"): oben die Karte mit Ansichtswahl und
 * Vollbild-Pfeil, darunter die Liste. Statt Kontakten stehen dort die Orte,
 * nach Entfernung vom gerade geoeffneten Ort (gemeinsam/naehe.js, dieselbe
 * Rechnung wie auf der Website).
 *
 * Tipp auf eine Zeile oder eine Nadel: die Karte zoomt dorthin, die Zeile
 * wird markiert. Der Pfeil am Zeilenende oeffnet den Ort. Bis zum 28.09.2026
 * sprang ein Tipp auf eine fremde Nadel sofort weiter — wer nur schauen
 * wollte, war raus aus der Karte.
 */
const OrtKarte = ({
  sichtbar,
  platz,
  hier,
  orte,
  onZu,
  onOrt,
}: {
  sichtbar: boolean;
  platz: Place;
  hier: { lat: number; lng: number };
  orte: Place[];
  onZu: () => void;
  onOrt: (id: string) => void;
}) => {
  const insets = useSafeAreaInsets();
  const karte = useRef<KartenSteuerung>(null);
  const blatt = useRef<ScrollView>(null);
  const [vollbild, setVollbild] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<string>(platz.id);

  const naehe = useMemo(() => Naehe.sortiert(hier, orte, platz.id), [hier.lat, hier.lng, orte, platz.id]);
  const pins: KartenPin[] = naehe.map((e) => ({ id: e.ort.id, name: e.ort.name, lat: e.lat, lng: e.lng }));

  const zeigen = (id: string) => {
    setGewaehlt(id);
    blatt.current?.scrollTo({ y: 0, animated: true });
    karte.current?.zoomAuf(id);
  };

  const flaeche = Math.max(300, fensterHoehe - insets.top - insets.bottom - 48);

  return (
    <Modal visible={sichtbar} animationType="slide" onRequestClose={onZu}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <Druck onPress={onZu} hitSlop={10} accessibilityLabel="Karte schließen">
            <Ionicons name="close" size={26} color={colors.text} />
          </Druck>
          <Text style={styles.barTitel} numberOfLines={1}>
            {platz.name}
          </Text>
        </View>
        <ScrollView
          ref={blatt}
          scrollEnabled={!vollbild}
          contentContainerStyle={{ paddingTop: vollbild ? 0 : spacing.md, paddingBottom: insets.bottom + spacing.xl }}
        >
          <KarteWeb
            ref={karte}
            pins={pins}
            aktiv={platz.id}
            start={{ ...hier, zoom: 13 }}
            hoehe={vollbild ? flaeche : Math.round(fensterHoehe * 0.45)}
            eigenerStandort={null}
            vollbild={vollbild}
            onVollbild={() => setVollbild((v) => !v)}
            onPinPress={zeigen}
          />

          {!vollbild && (
            <>
              <Text style={styles.naeheKopf}>ORTE IN DER NÄHE</Text>
              {naehe.map((e) => {
                const an = e.ort.id === gewaehlt;
                const selbst = e.ort.id === platz.id;
                return (
                  <View key={e.ort.id} style={[styles.naeheZeile, an && styles.naeheZeileAn]}>
                    <Druck
                      style={styles.naeheInhalt}
                      onPress={() => zeigen(e.ort.id)}
                      accessibilityLabel={`${e.ort.name} auf der Karte zeigen`}
                    >
                      <View style={[styles.zeileSymbol, selbst && styles.naeheSymbolHier]}>
                        <Ionicons name="location" size={20} color={selbst ? colors.white : colors.brand} />
                      </View>
                      <View style={styles.zeileText}>
                        <Text style={styles.zeileTitel} numberOfLines={1}>
                          {e.ort.name}
                        </Text>
                        <Text style={styles.zeileSub} numberOfLines={1}>
                          {[selbst ? 'Dieser Ort' : e.text, e.ort.adresse].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    </Druck>
                    {!selbst && (
                      <Druck
                        onPress={() => onOrt(e.ort.id)}
                        hitSlop={10}
                        style={styles.naeheOeffnen}
                        accessibilityLabel={`${e.ort.name} öffnen`}
                      >
                        <Ionicons name="chevron-forward" size={20} color={colors.text3} />
                      </Druck>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

/** Sekunden als m:ss. */
const zeitText = (s: number) => {
  const t = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * Kopf der Sound-Seite. Prototyp-Frame "VSSo + Sound". Henrik am 21.09.2026
 * (Kasten 7.2–7.4): "Play spielt den Song ab", "Liedtext zeigt nur die gerade
 * gesungene Zeile", "Songwriter und offizielles Titelbild sichtbar".
 *
 * Befund 28.09.2026:
 * - Play spielte die Hoerprobe aus Schema 54 — aber ohne Audiomodus. Am
 *   iPhone mit Stummschalter blieb es still, und nach einer Sprachnachricht
 *   (PushToTalk setzt allowsRecording) kam der Ton aus der Hoermuschel.
 * - Ohne Hoerprobe lief eine Uhr, als spiele etwas. Das war eine erfundene
 *   Anzeige; jetzt ist der Knopf dann aus und sagt, warum.
 * - Unter der gesungenen Zeile stand blass die naechste. "Nur die gerade
 *   gesungene Zeile" heisst: nur die. Wann welche dran ist, steht seit
 *   Schema 63 in der Datenbank (gemeinsam/liedtext.js).
 * - Der ganze Text liegt, wie im Prototyp, hinter "Lyrics ansehen →"
 *   (Frame "VSSo + Sound + Lyrics").
 *
 * Die Lautstaerke ist die des Telefons (Henrik: "die Systemlautstaerke gilt
 * ueberall").
 */
const SoundKopf = ({ sound }: { sound: Sound }) => {
  const mitTon = !!sound.audio;
  const spieler = useAudioPlayer(sound.audio ? { uri: sound.audio } : undefined);
  const status = useAudioPlayerStatus(spieler);
  const [lyricsAuf, setLyricsAuf] = useState(false);
  // Einmal Play gedrueckt: ab dann sagt die Seite, wenn die Hoerprobe nicht kommt.
  const [versucht, setVersucht] = useState(false);
  const [breite, setBreite] = useState(0);

  const gesamt = status.duration > 0 ? status.duration : 30;
  const bei = mitTon ? status.currentTime : 0;
  const laeuft = mitTon && status.playing;

  const umschalten = async () => {
    if (!mitTon) return;
    if (status.playing) return spieler.pause();
    try {
      /*
       * Vor jedem Abspielen: auch mit Stummschalter hoerbar, und ueber den
       * Lautsprecher. PushToTalk und die Kamera setzen allowsRecording; bleibt
       * das stehen, spielt iOS ueber die Hoermuschel, und es klingt wie
       * "Play geht nicht".
       */
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    } catch {
      // Ohne Modus spielt es trotzdem, nur eben nach den Regeln des Systems.
    }
    setVersucht(true);
    // Am Ende von vorn - sonst passiert auf den zweiten Druck nichts.
    if (status.didJustFinish || bei >= gesamt - 0.3) spieler.seekTo(0);
    spieler.play();
  };

  // Tipp auf die Wellenform springt an die Stelle (Prototyp: roter Punkt).
  const springen = (x: number) => {
    if (!mitTon || !breite) return;
    spieler.seekTo(Math.max(0, Math.min(1, x / breite)) * gesamt);
  };

  const balken = 40;
  const anteil = Math.max(0, Math.min(1, bei / gesamt));
  const bis = Math.round(anteil * balken);
  const liedStand = Liedtext.stand(sound.lyrics, sound.lyricsZeiten, bei, gesamt);

  return (
    <View style={[styles.kopf, styles.kopfMitte]}>
      {/* Prototyp: das Songbild mit einer Schallplatte, die rechts herausschaut. */}
      <View style={styles.coverRahmen}>
        <View style={styles.platte}>
          <View style={styles.platteRille} />
          <View style={styles.platteMitte} />
        </View>
        <View style={styles.cover}>
          {sound.cover ? (
            <Image source={{ uri: sound.cover }} style={styles.voll} accessibilityLabel={`Songbild ${sound.title}`} />
          ) : (
            <Ionicons name="musical-notes-outline" size={52} color={colors.text3} />
          )}
        </View>
      </View>
      <Text style={styles.titel}>{sound.title}</Text>
      <Text style={styles.interpret}>{sound.artist}</Text>
      {!!sound.songwriter && <Text style={styles.zahl}>Songwriter: {sound.songwriter}</Text>}
      <Text style={styles.zahl}>{compact(sound.uses)} Beiträge</Text>

      <View style={styles.player}>
        <View style={styles.welle}>
          <Druck
            style={[styles.play, !mitTon && styles.playAus]}
            onPress={umschalten}
            disabled={!mitTon}
            accessibilityLabel={!mitTon ? 'Keine Hörprobe' : laeuft ? 'Pause' : 'Abspielen'}
          >
            <Ionicons name={laeuft ? 'pause' : 'play'} size={16} color={colors.text} />
          </Druck>
          <Druck
            style={styles.wellenFlaeche}
            onLayout={(e) => setBreite(e.nativeEvent.layout.width)}
            onPress={(e) => springen(e.nativeEvent.locationX)}
            disabled={!mitTon}
            accessibilityLabel="Stelle im Song wählen"
          >
            {/* pointerEvents none: sonst meldet iOS die Stelle relativ zum
                getroffenen Balken statt zur ganzen Flaeche. */}
            <View pointerEvents="none" style={styles.wellenBalken}>
            {Array.from({ length: balken }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.balken,
                  // Die Form ist gezeichnet, nicht aus dem Ton gerechnet —
                  // eine echte Wellenform braeuchte die Audiodaten.
                  { height: `${20 + Math.round(60 * Math.abs(Math.sin(i * 1.1)))}%` },
                  i < bis && styles.balkenGespielt,
                ]}
              />
            ))}
            {mitTon && <View style={[styles.abspielPunkt, { left: `${anteil * 100}%` }]} />}
            </View>
          </Druck>
          <Text style={styles.wellenZeit}>
            {mitTon ? `${zeitText(bei)} / ${zeitText(gesamt)}` : sound.dauer ?? ''}
          </Text>
        </View>

        {!mitTon && <Text style={styles.playHinweis}>Keine Hörprobe vorhanden.</Text>}
        {mitTon && versucht && !status.isLoaded && (
          <Text style={styles.playHinweis}>Die Hörprobe lädt noch – oder ist nicht erreichbar.</Text>
        )}

        {/* Prototyp: im Player-Kasten links "Lyrics der jeweiligen Zeile",
            rechts "Lyrics ansehen →". */}
        <View style={styles.lyricsZeile}>
          {liedStand.anzahl ? (
            <Text style={styles.lyricsJetzt} accessibilityLiveRegion="polite" numberOfLines={2}>
              {liedStand.jetzt || '♪'}
            </Text>
          ) : (
            <Text style={styles.lyricsOhne}>Zu diesem Sound gibt es keinen Liedtext.</Text>
          )}
          {!!liedStand.anzahl && (
            <Druck onPress={() => setLyricsAuf(true)} hitSlop={8} accessibilityLabel="Lyrics ansehen">
              <Text style={styles.lyricsLink}>Lyrics ansehen →</Text>
            </Druck>
          )}
        </View>
      </View>

      <LyricsSeite
        sichtbar={lyricsAuf}
        sound={sound}
        nr={liedStand.nr}
        laeuft={laeuft}
        mitTon={mitTon}
        bei={bei}
        gesamt={gesamt}
        onPlay={umschalten}
        onZu={() => setLyricsAuf(false)}
      />
    </View>
  );
};

/**
 * Prototyp-Frame "VSSo + Sound + Lyrics": Songname, Produzent/in, der ganze
 * Text mit der gesungenen Zeile hervorgehoben, unten der Player. Die Zeile
 * scrollt mit.
 */
const LyricsSeite = ({
  sichtbar,
  sound,
  nr,
  laeuft,
  mitTon,
  bei,
  gesamt,
  onPlay,
  onZu,
}: {
  sichtbar: boolean;
  sound: Sound;
  nr: number;
  laeuft: boolean;
  mitTon: boolean;
  bei: number;
  gesamt: number;
  onPlay: () => void;
  onZu: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const blatt = useRef<ScrollView>(null);
  const lagen = useRef<Record<number, number>>({});
  const eintraege = useMemo(() => Liedtext.eintraege(sound.lyrics), [sound.lyrics]);

  useEffect(() => {
    const y = lagen.current[nr];
    if (sichtbar && nr >= 0 && typeof y === 'number') {
      blatt.current?.scrollTo({ y: Math.max(0, y - 160), animated: true });
    }
  }, [nr, sichtbar]);

  return (
    <Modal visible={sichtbar} animationType="slide" onRequestClose={onZu}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <Druck onPress={onZu} hitSlop={10} accessibilityLabel="Zurück">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Druck>
          <View style={{ flex: 1 }}>
            <Text style={styles.barTitel} numberOfLines={1}>
              {sound.title}
            </Text>
            <Text style={styles.zeileSub} numberOfLines={1}>
              {sound.artist}
            </Text>
          </View>
        </View>
        <ScrollView ref={blatt} contentContainerStyle={styles.lyricsVoll}>
          {eintraege.map((e, i) =>
            e.nr < 0 ? (
              <View key={i} style={{ height: 18 }} />
            ) : (
              <Text
                key={i}
                onLayout={(ev) => {
                  lagen.current[e.nr] = ev.nativeEvent.layout.y;
                }}
                style={[styles.lyricsVollZeile, e.nr === nr && styles.lyricsVollJetzt]}
              >
                {e.text}
              </Text>
            )
          )}
        </ScrollView>
        <View style={[styles.lyricsPlayer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Druck
            style={[styles.play, !mitTon && styles.playAus]}
            onPress={onPlay}
            disabled={!mitTon}
            accessibilityLabel={!mitTon ? 'Keine Hörprobe' : laeuft ? 'Pause' : 'Abspielen'}
          >
            <Ionicons name={laeuft ? 'pause' : 'play'} size={16} color={colors.text} />
          </Druck>
          <View style={styles.lyricsFortschritt}>
            <View style={[styles.lyricsFortschrittAn, { width: `${Math.min(100, (bei / gesamt) * 100)}%` }]} />
          </View>
          <Text style={styles.wellenZeit}>{mitTon ? zeitText(bei) : sound.dauer ?? ''}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  bar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },

  barTitel: { flex: 1, ...typography.h3, fontSize: 17, color: colors.text },
  sucheHinweis: { ...typography.small, color: colors.text3, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  liste: { paddingTop: spacing.sm },
  zeile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 9 },
  zeileSymbol: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zeileRaute: { fontSize: 20, fontWeight: '700', color: colors.brand },
  zeileText: { flex: 1 },
  zeileTitel: { ...typography.message, fontWeight: '600', color: colors.text },
  zeileSub: { ...typography.small, color: colors.text3, marginTop: 2 },

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

  karte: { borderRadius: radius.lg, overflow: 'hidden' },
  /* Karussell "B. Standortbilder": Pfeile links und rechts, Punkte darunter. */
  karussell: { marginTop: spacing.md },
  karussellFoto: { width: '100%', height: 190 },
  karussellPfeil: {
    position: 'absolute',
    top: 95 - 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  karussellLinks: { left: 8 },
  karussellRechts: { right: 8 },
  punkte: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  punkt: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  punktAn: { backgroundColor: colors.text },

  /* Kartenansicht eines Ortes: Liste wie "IN DER NÄHE" der Friend-Map. */
  naeheKopf: { ...typography.overline, color: colors.text3, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  naeheZeile: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing.lg },
  naeheZeileAn: { backgroundColor: colors.brandSoft },
  naeheInhalt: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 9 },
  naeheSymbolHier: { backgroundColor: '#ff3b30' },
  naeheOeffnen: { padding: 6 },
  link: { ...typography.name, color: colors.brand, marginTop: spacing.md },

  interpret: { ...typography.message, color: colors.text2, marginTop: 2 },
  /* Prototyp "VSSo + Sound": hinter dem Songbild schaut rechts eine
     Schallplatte heraus. */
  coverRahmen: { width: 148 + 44, height: 148, alignItems: 'flex-start' },
  platte: {
    position: 'absolute',
    right: 0,
    top: 6,
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: '#15171a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  platteRille: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  platteMitte: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#c0392b' },
  cover: {
    width: 148,
    height: 148,
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Prototyp: ein Kasten mit Play, Wellenform und darunter der Zeile. */
  player: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    padding: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
  },
  welle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  play: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playAus: { opacity: 0.4 },
  playHinweis: { ...typography.small, color: colors.text3, marginTop: 6 },
  wellenFlaeche: { flex: 1, height: 34 },
  wellenBalken: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'center', gap: 2 },
  /* Der rote Abspielpunkt aus dem Prototyp. */
  abspielPunkt: {
    position: 'absolute',
    top: 17 - 5,
    width: 10,
    height: 10,
    marginLeft: -5,
    borderRadius: 5,
    backgroundColor: '#ff3b30',
  },
  balken: { flex: 1, borderRadius: 1, backgroundColor: colors.text3, opacity: 0.45 },
  balkenGespielt: { backgroundColor: colors.brand, opacity: 1 },
  wellenZeit: { ...typography.small, color: colors.text2, fontVariant: ['tabular-nums'] },
  /* Zeilenhoehe 26 auf 15px Schrift - Liedtext liest sich mit mehr Luft als
     Fliesstext, weil jede Zeile eine eigene Einheit ist. */
  lyricsZeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  lyricsJetzt: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.text },
  lyricsLink: { ...typography.small, fontWeight: '600', color: colors.brand },
  lyricsOhne: { flex: 1, ...typography.preview, color: colors.text3 },
  /* Die Seite "Lyrics ansehen" (Prototyp "VSSo + Sound + Lyrics"). */
  lyricsVoll: { padding: spacing.lg, paddingBottom: 120 },
  lyricsVollZeile: { fontSize: 18, lineHeight: 28, color: colors.text3 },
  lyricsVollJetzt: { fontWeight: '700', color: colors.text },
  lyricsPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface2,
  },
  lyricsFortschritt: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  lyricsFortschrittAn: { height: 4, backgroundColor: '#ff3b30' },

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
