import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Motiv } from '../../components/Motiv';
import { istVideo, Videoflaeche, VideoSteuerung } from '../../components/Videoflaeche';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';
import { useProfil } from '../../contexts/ProfilContext';
import { useReposts } from '../../contexts/RepostContext';
import { Clip } from '../../types';
import { ExplorerZiel } from './ExplorerScreen';
import { ActionSheet } from '../../components/ActionSheet';
import { EinstellungSheet } from '../../components/EinstellungSheet';
import {
  QUALITAET_STUFEN,
  TEMPO_STUFEN,
  tempoText,
  useVideoEinstellungen,
} from '../../lib/videoEinstellungen';

interface Props {
  clipId: string;
  onBack: () => void;
  onOpenProfile: (userId: string) => void;
  onOpenExplorer: (ziel: ExplorerZiel) => void;
  onShare: (clip: Clip) => void;
  onNotice: (message: string) => void;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k` : String(n);

const sekundenVon = (dauer: string) => {
  const [min, sek] = String(dauer).split(':').map(Number);
  return min * 60 + sek;
};

const zeitText = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Prototyp-Frame "VQ + Video": Zurück-Pfeil, Videofläche im Querformat,
 * darunter Überschrift mit Aufrufen und Datum und die Reihe aus Like,
 * Kommentar, Senden, Repost und Merken.
 *
 * Vorher ließ sich ein Querformat-Video gar nicht öffnen — es kam nur
 * „Wiedergabe folgt mit dem Backend".
 */
export const ClipPlayerScreen = ({ clipId, onBack, onOpenProfile, onOpenExplorer, onShare, onNotice }: Props) => {
  const { users: alleNutzer } = useDaten();
  const insets = useSafeAreaInsets();
  const { clips, clipUmschalten, raster } = useProfil();
  const { istRepostet, umschalten } = useReposts();

  const [offen, setOffen] = useState(clipId);
  const [laeuft, setLaeuft] = useState(false);
  const [bei, setBei] = useState(0);
  const stand = useRef(0);
  /*
   * Der Griff an den Abspieler. Gebraucht fuer die Kapitelmarken (springen)
   * und fuer die Geschwindigkeit aus den Video-Einstellungen (tempo).
   */
  const spieler = useRef<VideoSteuerung>(null);
  /*
   * Die Laufzeit aus der Datei. Im Beitrag steht sie als Text ("1:00"), und
   * bis es echte Videos gab, war dieser Text die einzige Quelle. Jetzt sagt
   * die Datei selbst, wie lang sie ist — und die zaehlt, denn nach ihr
   * richten sich Fortschrittsleiste und Kapitel.
   */
  const [dateiLaenge, setDateiLaenge] = useState(0);
  /*
   * Vollbild (Punkt 30). In der App gibt es keine Fullscreen-API - der
   * Player legt sich stattdessen ueber den ganzen Bildschirm und die Buehne
   * nimmt die volle Hoehe. Henrik hatte "Handy quer → Video im Vollformat"
   * beschrieben; der Knopf tut dasselbe, ohne dass man drehen muss.
   */
  const [vollbild, setVollbild] = useState(false);
  /*
   * Video-Einstellungen (Punkt 31). `optionen` ist das Hauptblatt, `wahl`
   * die Liste dahinter - Geschwindigkeit oder Qualitaet.
   */
  const [optionen, setOptionen] = useState(false);
  const [wahl, setWahl] = useState<'tempo' | 'qualitaet' | null>(null);
  const video = useVideoEinstellungen();

  const clip = clips.find((c) => c.id === offen);
  const eigenerEintrag = raster.find((r) => r.id === offen);
  const quelle = eigenerEintrag?.mediaUri ?? clip?.mediaUri;
  const standbild = eigenerEintrag?.standbild ?? clip?.standbild;
  const echtesVideo = istVideo(quelle);
  const gesamt = dateiLaenge || (clip ? sekundenVon(clip.duration) : 0);

  /*
   * Ohne Videodatei bleibt es beim Zaehler: es gibt nichts abzuspielen, aber
   * die Leiste soll sich bewegen, damit der Bildschirm nicht tot wirkt. Mit
   * Videodatei meldet der Abspieler seinen Stand selbst — dann waere ein
   * zweiter Zaehler daneben schlicht falsch.
   */
  useEffect(() => {
    if (echtesVideo || !laeuft || !gesamt) return;
    const uhr = setInterval(() => {
      stand.current = Math.min(gesamt, stand.current + 1);
      setBei(stand.current);
      if (stand.current >= gesamt) setLaeuft(false);
    }, 1000);
    return () => clearInterval(uhr);
  }, [echtesVideo, laeuft, gesamt]);

  /* Geschwindigkeit aus den Einstellungen an den Abspieler weiterreichen. */
  useEffect(() => {
    if (echtesVideo && laeuft) spieler.current?.tempo(video.werte.tempo);
  }, [echtesVideo, laeuft, video.werte.tempo]);

  if (!clip) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Druck style={styles.bar} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Druck>
        <Text style={styles.leer}>Dieses Video gibt es nicht mehr.</Text>
      </View>
    );
  }

  /*
   * Der Autor kann fehlen, solange die Personen noch geladen werden. Ein
   * direkter Zugriff auf .name stürzte die App dann ab — siehe
   * VideoProfileScreen.
   */
  const autor = alleNutzer[clip.userId] ?? { name: '', handle: '' };
  const aehnlich = clips.filter((c) => c.id !== clip.id).slice(0, 4);

  const wechseln = (id: string) => {
    stand.current = 0;
    setBei(0);
    setDateiLaenge(0);
    setLaeuft(false);
    setOffen(id);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Druck onPress={onBack} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Druck>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <Druck style={[styles.buehne, vollbild && styles.buehneVoll]} onPress={() => setLaeuft((v) => !v)}>
          <Videoflaeche
            ref={spieler}
            id={clip.id}
            quelle={quelle}
            standbild={standbild}
            laeuft={laeuft}
            /*
             * Ein Querformat-Video gehoert vollstaendig ins Bild — anders als
             * im Reel-Kanal, wo der Ausschnitt die Flaeche fuellen soll.
             */
            fuellen="contain"
            /* Der Ton gehoert zum Video; wer ihn nicht will, dreht ihn am Geraet leiser. */
            stumm={false}
            icon="tv-outline"
            iconSize={48}
            dunkel
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            onFortschritt={(jetzt, laenge) => {
              stand.current = jetzt;
              setBei(jetzt);
              if (laenge && laenge !== dateiLaenge) setDateiLaenge(laenge);
            }}
            onEnde={() => setLaeuft(false)}
          />
          <View style={[styles.play, laeuft && styles.playAus]}>
            <Ionicons name={laeuft ? 'pause' : 'play'} size={26} color={colors.white} />
          </View>
          {clip.art === 'live' && (
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          )}
        </Druck>

        <View style={styles.leiste}>
          <Text style={styles.zeit}>{zeitText(bei)}</Text>
          <View style={styles.balken}>
            <View style={[styles.fortschritt, { width: `${gesamt ? (bei / gesamt) * 100 : 0}%` }]} />
          </View>
          <Text style={styles.zeit}>{clip.duration}</Text>
          {/* Einstellungen und Vollbild - dort sucht man sie von YouTube her. */}
          <Druck style={styles.leisteKnopf} onPress={() => setOptionen(true)} hitSlop={8} accessibilityLabel="Video-Einstellungen">
            <Ionicons name="settings-outline" size={18} color="#C6CAD2" />
          </Druck>
          <Druck
            style={styles.leisteKnopf}
            onPress={() => setVollbild((v) => !v)}
            hitSlop={8}
            accessibilityLabel={vollbild ? 'Vollbild beenden' : 'Vollbild'}
          >
            <Ionicons name={vollbild ? 'contract-outline' : 'expand-outline'} size={18} color="#C6CAD2" />
          </Druck>
        </View>

        {/*
          Kapitel (Punkt 32). Nur wenn das Video welche hat - eine leere
          Ueberschrift ueber nichts waere schlechter als gar keine.
        */}
        {!!clip.kapitel?.length && (
          <View style={styles.kapitel}>
            <Text style={styles.kapitelKopf}>KAPITEL</Text>
            {clip.kapitel.map((k, i) => {
              const aktiv = bei >= k.bei && (!clip.kapitel![i + 1] || bei < clip.kapitel![i + 1].bei);
              return (
                <Druck
                  key={k.bei}
                  style={[styles.kapitelZeile, aktiv && styles.kapitelZeileAktiv]}
                  onPress={() => {
                    stand.current = Math.min(gesamt, k.bei);
                    setBei(stand.current);
                    spieler.current?.springen(stand.current);
                  }}
                >
                  <Text style={styles.kapitelZeit}>{zeitText(k.bei)}</Text>
                  <Text style={styles.kapitelTitel} numberOfLines={1}>
                    {k.titel}
                  </Text>
                  <Text style={styles.kapitelDauer}>
                    {zeitText((clip.kapitel![i + 1]?.bei ?? gesamt) - k.bei)}
                  </Text>
                </Druck>
              );
            })}
          </View>
        )}

        <View style={styles.kopf}>
          <Text style={styles.titel}>{clip.title}</Text>
          <Text style={styles.sub}>
            {compact(clip.views)} Aufrufe · {clip.age}
          </Text>
        </View>

        <View style={styles.autor}>
          <Druck onPress={() => onOpenProfile(clip.userId)}>
            <Avatar id={clip.userId} name={autor.name} size={sizes.avatarMd} />
          </Druck>
          <Druck style={styles.autorText} onPress={() => onOpenProfile(clip.userId)}>
            <Text style={styles.autorName}>{autor.name}</Text>
            <Text style={styles.autorSub}>{autor.handle}</Text>
          </Druck>
        </View>

        {/*
          Fuenf gleiche Spalten. Henrik am 26.08.2026, Punkte 28 und 29:
          "Speichern zu weit entfernt; Teilen/Repost zu nah beieinander. Alle
          fünf sauber nebeneinander" und "Aktionsspalte verändert sich beim
          Liken".

          Beides kam aus derselben Ecke: "Speichern" hatte aktionEnde
          (marginLeft: 'auto') und wurde ans Ende geschoben, waehrend die
          anderen vier links zusammenklebten - und weil nur zwei der fuenf
          eine Zahl trugen, sprang die Reihe, sobald sich eine Zahl aenderte.
          Jetzt hat jeder Knopf ein Fuenftel der Breite und eine Beschriftung.
        */}
        <View style={styles.aktionen}>
          <Druck style={styles.aktion} onPress={() => clipUmschalten(clip.id, 'like')}>
            <Ionicons
              name={clip.liked ? 'heart' : 'heart-outline'}
              size={24}
              color={clip.liked ? colors.danger : colors.text}
            />
            <Text style={[styles.aktionZahl, clip.liked && styles.aktionZahlAn]} numberOfLines={1}>
              {clip.likes ? compact(clip.likes) : 'Like'}
            </Text>
          </Druck>

          <Druck style={styles.aktion} onPress={() => onNotice(`${clip.comments ?? 0} Kommentare`)}>
            <Ionicons name="chatbubble-outline" size={22} color={colors.text} />
            <Text style={styles.aktionZahl} numberOfLines={1}>
              {clip.comments ? compact(clip.comments) : 'Kommentar'}
            </Text>
          </Druck>

          <Druck style={styles.aktion} onPress={() => onShare(clip)}>
            <Ionicons name="paper-plane-outline" size={22} color={colors.text} />
            <Text style={styles.aktionZahl} numberOfLines={1}>Teilen</Text>
          </Druck>

          <Druck
            style={styles.aktion}
            onPress={() => {
              clipUmschalten(clip.id, 'repost');
              const jetzt = umschalten('video', clip.id, clip.title);
              onNotice(jetzt ? 'Repostet' : 'Repost zurückgenommen');
            }}
          >
            <Ionicons
              name="repeat"
              size={24}
              color={istRepostet('video', clip.id) ? colors.success : colors.text}
            />
            <Text style={styles.aktionZahl} numberOfLines={1}>Repost</Text>
          </Druck>

          <Druck
            style={styles.aktion}
            onPress={() => {
              clipUmschalten(clip.id, 'save');
              onNotice(clip.saved ? 'Nicht mehr gespeichert' : 'Gespeichert');
            }}
          >
            <Ionicons name={clip.saved ? 'bookmark' : 'bookmark-outline'} size={22} color={colors.text} />
            <Text style={styles.aktionZahl} numberOfLines={1} ellipsizeMode="tail">
              {clip.saved ? 'Gespeichert' : 'Speichern'}
            </Text>
          </Druck>
        </View>

        {!!clip.description && <Text style={styles.text}>{clip.description}</Text>}

        {!!clip.tags?.length && (
          <View style={styles.tags}>
            {clip.tags.map((t) => (
              <Druck key={t} style={styles.tag} onPress={() => onOpenExplorer({ art: 'hashtag', wert: t })}>
                <Text style={styles.tagText}>{t}</Text>
              </Druck>
            ))}
          </View>
        )}

        <Text style={styles.abschnitt}>Ähnliche Videos →</Text>
        {aehnlich.map((c) => (
          <Druck key={c.id} style={styles.clip} onPress={() => wechseln(c.id)}>
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
      </ScrollView>

      {/*
        Video-Einstellungen nach dem Vorbild von YouTube: ein Blatt mit den
        drei Punkten, dahinter je eine Liste. Untertitel bietet nur an, wer
        welche hat - ein Punkt, der bei jedem zweiten Video ins Leere fuehrt,
        ist schlechter als keiner.
      */}
      <ActionSheet
        visible={optionen}
        title="Video-Einstellungen"
        items={[
          { key: 'tempo', label: `Geschwindigkeit · ${tempoText(video.werte.tempo)}`, icon: 'time-outline' },
          { key: 'qualitaet', label: `Qualität · ${video.werte.qualitaet}`, icon: 'settings-outline' },
          ...(clip.untertitel
            ? [
                {
                  key: 'untertitel',
                  label: `Untertitel · ${video.werte.untertitel ? 'An' : 'Aus'}`,
                  icon: 'chatbox-ellipses-outline' as const,
                },
              ]
            : []),
        ]}
        onSelect={(key) => {
          setOptionen(false);
          if (key === 'untertitel') {
            const jetzt = !video.werte.untertitel;
            video.setzen({ untertitel: jetzt });
            return onNotice(jetzt ? 'Untertitel an' : 'Untertitel aus');
          }
          setWahl(key as 'tempo' | 'qualitaet');
        }}
        onClose={() => setOptionen(false)}
      />

      {wahl === 'tempo' && (
        <EinstellungSheet
          titel="Geschwindigkeit"
          wahl={TEMPO_STUFEN.map(tempoText)}
          aktuell={tempoText(video.werte.tempo)}
          onWahl={(wert) => {
            const stufe = TEMPO_STUFEN.find((t) => tempoText(t) === wert);
            if (stufe) video.setzen({ tempo: stufe });
            setWahl(null);
            onNotice(`Geschwindigkeit: ${wert}`);
          }}
          onClose={() => setWahl(null)}
        />
      )}

      {wahl === 'qualitaet' && (
        <EinstellungSheet
          titel="Qualität"
          wahl={[...QUALITAET_STUFEN]}
          aktuell={video.werte.qualitaet}
          onWahl={(wert) => {
            video.setzen({ qualitaet: wert });
            setWahl(null);
            onNotice(`Qualität: ${wert}`);
          }}
          onClose={() => setWahl(null)}
        />
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
  leer: { ...typography.message, color: colors.text2, padding: spacing.lg },

  buehne: {
    aspectRatio: 16 / 9,
    backgroundColor: '#12161B',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /* Im Vollbild faellt das Seitenverhaeltnis weg und die Buehne nimmt fast
     den ganzen Bildschirm. */
  buehneVoll: { aspectRatio: undefined, height: '78%' },
  play: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playAus: { opacity: 0 },
  liveBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3, backgroundColor: colors.danger },
  liveBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  leiste: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.black },
  leisteKnopf: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  /* Kapitel eines langen Videos - Prototyp: "anzeigen und direkt dorthin
     springen". */
  kapitel: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  kapitelKopf: {
    ...typography.overline,
    color: colors.text2,
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
    paddingBottom: 8,
  },
  kapitelZeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
  },
  kapitelZeileAktiv: { backgroundColor: colors.brandSoft },
  kapitelZeit: {
    minWidth: 44,
    ...typography.small,
    fontWeight: '600',
    color: colors.brand,
    fontVariant: ['tabular-nums'],
  },
  kapitelTitel: { flex: 1, ...typography.body, color: colors.text },
  kapitelDauer: { ...typography.small, color: colors.text3, fontVariant: ['tabular-nums'] },
  zeit: { ...typography.tiny, color: '#B9BDC6', fontVariant: ['tabular-nums'] },
  balken: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  fortschritt: { height: '100%', backgroundColor: colors.danger },

  kopf: { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 6 },
  titel: { fontSize: 17, fontWeight: '700', color: colors.text, lineHeight: 22 },
  sub: { ...typography.small, color: colors.text2, marginTop: 3 },

  autor: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  autorText: { flex: 1 },
  autorName: { ...typography.name, color: colors.text },
  autorSub: { ...typography.small, color: colors.text3 },

  /* Fuenf gleiche Spalten - siehe der Kommentar an der Reihe selbst. */
  aktionen: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  aktion: { flex: 1, alignItems: 'center', gap: 5 },
  aktionZahl: { ...typography.small, color: colors.text2 },
  aktionZahlAn: { color: colors.danger },

  text: { ...typography.message, color: colors.text, paddingHorizontal: spacing.lg, paddingBottom: 10, lineHeight: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.lg, paddingBottom: 10 },
  tag: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.brandSoft },
  tagText: { ...typography.small, fontWeight: '600', color: colors.brand },

  abschnitt: { ...typography.h3, color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  clip: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  clipBild: { height: 150, borderRadius: radius.md, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  clipZeit: { position: 'absolute', right: 8, bottom: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.7)' },
  clipZeitText: { ...typography.tiny, color: colors.white },
  clipMeta: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  clipTexte: { flex: 1 },
  clipTitel: { ...typography.name, color: colors.text },
  clipSub: { ...typography.small, color: colors.text2, marginTop: 2 },
}));
