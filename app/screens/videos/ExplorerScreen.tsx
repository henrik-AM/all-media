import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KarteWeb, Pin as KartenPin } from '../../components/KarteWeb';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Motiv } from '../../components/Motiv';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
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

/** "53.5413° N, 9.9891° O" in Zahlen. Sued und West werden negativ. */
export const koordinatenLesen = (text?: string): { lat: number; lng: number } | null => {
  const teile = String(text ?? '').match(/(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?\s*,\s*(-?\d+(?:\.\d+)?)\s*°?\s*([OEW])?/i);
  if (!teile) return null;
  const lat = Number(teile[1]) * (/s/i.test(teile[2] ?? '') ? -1 : 1);
  const lng = Number(teile[3]) * (/w/i.test(teile[4] ?? '') ? -1 : 1);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

const StandortKopf = ({
  platz,
  orte,
  onAlleFotos,
  onOrt,
}: {
  platz: Place;
  orte: Place[];
  onAlleFotos: () => void;
  onOrt: (id: string) => void;
}) => {
  /*
   * Henrik am 21.09.2026: "Standorte brauchen eine funktionierende Karte mit
   * Sprung in eine Kartenansicht - wie bei der Friend-Map." Bis dahin stand
   * hier ein gezeichnetes Raster mit einer Nadel an einer Prozentposition,
   * das mit dem echten Ort nichts zu tun hatte. Jetzt dieselbe Karte wie in
   * der Friend-Map, und der Vollbild-Knopf oeffnet sie mit allen Orten.
   */
  const [karteVoll, setKarteVoll] = useState(false);
  const insets = useSafeAreaInsets();
  const hier = koordinatenLesen(platz.koordinaten);
  const pins: KartenPin[] = orte.flatMap((o) => {
    const k = koordinatenLesen(o.koordinaten);
    return k ? [{ id: o.id, name: o.name, ...k }] : [];
  });
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

    {hier ? (
      <View style={styles.karte}>
        <KarteWeb
          pins={pins.filter((p) => p.id === platz.id)}
          aktiv={platz.id}
          hoehe={170}
          eigenerStandort={null}
          onVollbild={() => setKarteVoll(true)}
        />
      </View>
    ) : null}

    <Modal visible={karteVoll} animationType="slide" onRequestClose={() => setKarteVoll(false)}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <Druck onPress={() => setKarteVoll(false)} hitSlop={10} accessibilityLabel="Karte schließen">
            <Ionicons name="close" size={26} color={colors.text} />
          </Druck>
          <Text style={styles.barTitel}>Standorte</Text>
        </View>
        <KarteWeb
          pins={pins}
          aktiv={platz.id}
          hoehe={Math.max(300, fensterHoehe - insets.top - insets.bottom - 48)}
          eigenerStandort={null}
          vollbild
          onVollbild={() => setKarteVoll(false)}
          onPinPress={(id) => {
            if (id === platz.id) return;
            setKarteVoll(false);
            onOrt(id);
          }}
        />
      </View>
    </Modal>

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
};

/**
 * Kopf der Sound-Seite. Henrik am 21.09.2026: "Songs: Abspielen, nur die
 * aktuell gesungene Textzeile, Songwriter-Name, offizielles Songbild."
 *
 * Bis dahin liess der Abspielknopf nur eine Uhr laufen - zu hoeren war
 * nichts - und darunter stand der ganze Liedtext auf einmal. Jetzt spielt
 * die Hoerprobe aus Schema 54, und vom Text steht nur die Zeile da, die
 * gerade dran ist, die naechste blass darunter. Ohne Zeitstempel im Liedtext
 * verteilen sich die Zeilen gleichmaessig ueber die Hoerprobe.
 *
 * Die Lautstaerke ist die des Telefons - einen eigenen Regler gibt es nicht
 * (Henrik, selber Tag: "die Systemlautstaerke gilt ueberall").
 */
const SoundKopf = ({ sound }: { sound: Sound }) => {
  const spieler = useAudioPlayer(sound.audio ? { uri: sound.audio } : undefined);
  const status = useAudioPlayerStatus(spieler);
  const mitTon = !!sound.audio;

  // Ohne Hoerprobe laeuft wie bisher nur die Uhr.
  const [uhrLaeuft, setUhrLaeuft] = useState(false);
  const [uhrBei, setUhrBei] = useState(0);
  const stand = useRef(0);
  const [min, sek] = String(sound.dauer ?? '3:00').split(':').map(Number);
  const dauer = min * 60 + sek || 180;

  useEffect(() => {
    if (mitTon || !uhrLaeuft) return;
    const uhr = setInterval(() => {
      stand.current = (stand.current + 1) % (dauer + 1);
      setUhrBei(stand.current);
    }, 1000);
    return () => clearInterval(uhr);
  }, [mitTon, uhrLaeuft, dauer]);

  const gesamt = mitTon && status.duration > 0 ? status.duration : dauer;
  const bei = mitTon ? status.currentTime : uhrBei;
  const laeuft = mitTon ? status.playing : uhrLaeuft;

  const umschalten = () => {
    if (!mitTon) return setUhrLaeuft((v) => !v);
    if (status.playing) return spieler.pause();
    // Am Ende von vorn - sonst passiert auf den zweiten Druck nichts.
    if (status.didJustFinish || bei >= gesamt - 0.3) spieler.seekTo(0);
    spieler.play();
  };

  const balken = 40;
  const bis = Math.round((bei / gesamt) * balken);
  const zeit = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const zeilen = (sound.lyrics ?? []).filter((z) => z.trim());
  const nr = zeilen.length ? Math.min(zeilen.length - 1, Math.floor((bei / gesamt) * zeilen.length)) : -1;

  return (
    <View style={[styles.kopf, styles.kopfMitte]}>
      <View style={styles.cover}>
        {sound.cover ? (
          <Image source={{ uri: sound.cover }} style={styles.voll} accessibilityLabel={`Songbild ${sound.title}`} />
        ) : (
          <Ionicons name="musical-notes-outline" size={52} color={colors.text3} />
        )}
      </View>
      <Text style={styles.titel}>{sound.title}</Text>
      <Text style={styles.interpret}>{sound.artist}</Text>
      {!!sound.songwriter && <Text style={styles.zahl}>Songwriter: {sound.songwriter}</Text>}
      <Text style={styles.zahl}>{compact(sound.uses)} Beiträge</Text>

      <View style={styles.welle}>
        <Druck style={styles.play} onPress={umschalten} accessibilityLabel={laeuft ? 'Pause' : 'Abspielen'}>
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
          {zeit(bei)} / {mitTon ? zeit(gesamt) : sound.dauer}
        </Text>
      </View>

      <View style={styles.lyrics}>
        <Text style={styles.lyricsKopf}>LIEDTEXT</Text>
        {nr >= 0 ? (
          <>
            <Text style={styles.lyricsJetzt} accessibilityLiveRegion="polite">
              {zeilen[nr]}
            </Text>
            {nr + 1 < zeilen.length && <Text style={styles.lyricsDanach}>{zeilen[nr + 1]}</Text>}
          </>
        ) : (
          <Text style={styles.lyricsOhne}>Zu diesem Sound gibt es keinen Liedtext.</Text>
        )}
      </View>
    </View>
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

  karte: { marginTop: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
  link: { ...typography.name, color: colors.brand, marginTop: spacing.md },

  interpret: { ...typography.message, color: colors.text2, marginTop: 2 },
  cover: {
    width: 148,
    height: 148,
    overflow: 'hidden',
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
  lyricsJetzt: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: colors.text, textAlign: 'center' },
  lyricsDanach: { fontSize: 16, lineHeight: 24, color: colors.text3, textAlign: 'center', marginTop: 6 },
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
