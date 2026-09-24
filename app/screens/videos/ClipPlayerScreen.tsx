import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
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
import { BeitragOptionenSheet } from '../../components/BeitragOptionenSheet';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAktionen } from '../../lib/useAktionen';
import { ladeStreamKommentare } from '../../lib/daten';
import { EinstellungSheet } from '../../components/EinstellungSheet';
import { CommentSheet } from '../../components/CommentSheet';
import { FormularSheet } from '../../components/FormularSheet';
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

/*
 * „2,50", „2.50", „3" — was man eben tippt. Unter 50 Cent lohnt keine
 * Buchung, ueber 1.000 € ist es fast sicher ein Tippfehler.
 */
const betragInCent = (text: string) => {
  const zahl = Number(String(text).replace(/\s|€/g, '').replace(',', '.'));
  if (!Number.isFinite(zahl) || zahl < 0.5 || zahl > 1000) return null;
  return Math.round(zahl * 100);
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
   * Vollbild (Punkt 30). Henrik hatte "Handy quer → Video im Vollformat"
   * beschrieben. Wie die Flaeche dafuer gedreht wird, steht bei `quer`.
   */
  const [vollbild, setVollbild] = useState(false);
  /*
   * Video-Einstellungen (Punkt 31). `optionen` ist das Hauptblatt, `wahl`
   * die Liste dahinter - Geschwindigkeit oder Qualitaet.
   */
  const [optionen, setOptionen] = useState(false);
  const [wahl, setWahl] = useState<'tempo' | 'qualitaet' | null>(null);

  /*
   * Die Live-Kommentarspalte, wenn dieses Video gerade gesendet wird.
   *
   * Das Handbuch nennt sie unter Querformat ausdruecklich als Merkmal von
   * Livestreams. Bei einer Aufzeichnung waere sie sinnlos — dort gibt es die
   * gewoehnlichen Kommentare —, deshalb haengt sie an `clip.art === 'live'`.
   */
  const { supabase } = useSupabase();
  const aktionen = useAktionen(onNotice);
  const [mehrOffen, setMehrOffen] = useState(false);
  const [liveKommentare, setLiveKommentare] = useState<
    { id: string; name: string; text: string; zeit: string }[]
  >([]);
  const [liveEntwurf, setLiveEntwurf] = useState('');
  const [spendeOffen, setSpendeOffen] = useState(false);
  /*
   * Henrik am 21.09.2026: „Spenden: eigener Betrag muss wählbar sein." Die
   * festen Stufen bleiben als schneller Weg, dahinter ein Feld.
   */
  const [eigenerBetrag, setEigenerBetrag] = useState(false);
  /*
   * Die Live-Kommentare liegen zusammengeklappt als kleines Fenster mit den
   * neuesten Zeilen unter dem Bild. Zum Schreiben klappt man es auf, dann
   * werden die letzten Kommentare groesser und das Eingabefeld erscheint.
   */
  const [liveOffen, setLiveOffen] = useState(false);
  /* Bis zum 21.09.2026 gab der Kommentar-Knopf nur die Anzahl als Hinweis aus. */
  const [kommentareOffen, setKommentareOffen] = useState(false);
  /* Neue Kommentare zaehlen sofort mit, nicht erst beim naechsten Laden. */
  const [kommentarZahl, setKommentarZahl] = useState<Record<string, number>>({});
  /*
   * Wie weit der Stream schon gelaufen ist. Bei Live darf man zurueck, um
   * Verpasstes nachzuholen, aber nie ueber diese Kante hinaus nach vorn —
   * dahinter ist noch nichts gesendet.
   */
  const liveKante = useRef(0);
  const [balkenBreite, setBalkenBreite] = useState(0);
  const fenster = useWindowDimensions();
  const video = useVideoEinstellungen();

  const clip = clips.find((c) => c.id === offen);
  const eigenerEintrag = raster.find((r) => r.id === offen);
  const quelle = eigenerEintrag?.mediaUri ?? clip?.mediaUri;
  const standbild = eigenerEintrag?.standbild ?? clip?.standbild;
  const echtesVideo = istVideo(quelle);
  const gesamt = dateiLaenge || (clip ? sekundenVon(clip.duration) : 0);

  const istLive = clip?.art === 'live';

  /*
   * Alle vier Sekunden nachladen. Ein Live-Abo waere schoener, braeuchte aber
   * eine eigene Verbindung, die beim Verlassen wieder zugehen muss — bei
   * einer Kommentarspalte faellt der Unterschied nicht auf.
   */
  const liveHolen = useCallback(async () => {
    if (!supabase || !clip || !istLive) return;
    try {
      setLiveKommentare(await ladeStreamKommentare(supabase, clip.id));
    } catch (e: any) {
      console.error('Live-Kommentare laden fehlgeschlagen:', e?.message ?? e);
    }
  }, [supabase, clip, istLive]);

  useEffect(() => {
    if (!istLive) return setLiveKommentare([]);
    liveHolen();
    const uhr = setInterval(liveHolen, 4000);
    return () => clearInterval(uhr);
  }, [istLive, liveHolen]);

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

  /*
   * Geschwindigkeit aus den Einstellungen an den Abspieler weiterreichen.
   * Ein Livestream laeuft immer in Echtzeit — schneller als gesendet geht
   * nicht, und langsamer liesse einen hinter die Sendung fallen.
   */
  useEffect(() => {
    if (echtesVideo && laeuft) spieler.current?.tempo(istLive ? 1 : video.werte.tempo);
  }, [echtesVideo, laeuft, istLive, video.werte.tempo]);

  useEffect(() => {
    liveKante.current = Math.max(liveKante.current, bei);
  }, [bei]);

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
  /*
   * Aehnlich heisst: gemeinsame Hashtags zuerst, dann dieselbe Person, dann
   * die meistgesehenen. Vorher waren es schlicht die ersten vier der Liste.
   */
  const naehe = (c: Clip) =>
    (c.tags ?? []).filter((t) => clip.tags?.includes(t)).length * 2 + (c.userId === clip.userId ? 1 : 0);
  const aehnlich = clips
    .filter((c) => c.id !== clip.id)
    .sort((a, b) => naehe(b) - naehe(a) || b.views - a.views)
    .slice(0, 4);

  /*
   * Kapitel nur, soweit sie im Video liegen. Die Testvideos sind eine
   * Minute lang, ihre Kapitel reichten bis Minute 11 — Henrik am 21.09.2026:
   * „Kapitel ergeben keinen Sinn." Bei Live gibt es keine: dort steht noch
   * nicht fest, was kommt.
   */
  const kapitel = istLive ? [] : (clip.kapitel ?? []).filter((k) => !gesamt || k.bei < gesamt);

  const wechseln = (id: string) => {
    stand.current = 0;
    liveKante.current = 0;
    setBei(0);
    setDateiLaenge(0);
    setLaeuft(false);
    setOffen(id);
  };

  /*
   * Springen ueber die rote Leiste. Sie war bis zum 21.09.2026 nur Anzeige.
   * Bei Live geht es nur zurueck — nach vorn endet der Weg an der Stelle,
   * die schon gesendet ist.
   */
  const springen = (sekunde: number) => {
    const grenze = istLive ? liveKante.current : gesamt;
    const ziel = Math.max(0, Math.min(grenze, Math.round(sekunde)));
    stand.current = ziel;
    setBei(ziel);
    spieler.current?.springen(ziel);
  };

  const balkenGriff = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: (e: any) => springen((e.nativeEvent.locationX / (balkenBreite || 1)) * gesamt),
    onResponderMove: (e: any) => springen((e.nativeEvent.locationX / (balkenBreite || 1)) * gesamt),
  };

  /*
   * Vollbild: das Handy wird quer gehalten, das Bild dreht sich mit. Die
   * App ist aufs Hochformat festgelegt, deshalb dreht sie die Flaeche selbst
   * um 90 Grad und legt sie ueber den ganzen Bildschirm. Vorher wurde nur
   * die Hoehe vergroessert — bei einem Querformat-Video hiess das: so stark
   * hineingezoomt, dass nur ein Ausschnitt zu sehen war.
   */
  const quer = vollbild
    ? {
        position: 'absolute' as const,
        zIndex: 10,
        width: fenster.height,
        height: fenster.width,
        left: (fenster.width - fenster.height) / 2,
        top: (fenster.height - fenster.width) / 2,
        transform: [{ rotate: '90deg' }],
        backgroundColor: '#000',
        paddingLeft: insets.top,
        paddingRight: insets.bottom,
      }
    : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Druck onPress={onBack} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Druck>
      </View>

      <StatusBar hidden={vollbild} />
      {/*
        Bild und Leiste stehen fest ueber der Seite und scrollen nicht mit —
        so bleibt das Video im Blick, waehrend man Kommentare und Aehnliches
        liest. Im Vollbild wird dieselbe Flaeche gedreht, ohne sie neu
        aufzubauen; das Video laeuft also an derselben Stelle weiter.
      */}
      <View style={quer}>
        <Druck style={vollbild ? styles.buehneQuer : styles.buehne} onPress={() => setLaeuft((v) => !v)}>
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
          {istLive && (
            /* Antippen fuehrt zurueck an die Stelle, die gerade gesendet wird. */
            <Druck style={styles.liveBadge} onPress={() => springen(liveKante.current)} hitSlop={8}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </Druck>
          )}
        </Druck>

        <View style={styles.leiste}>
          <Text style={styles.zeit}>{zeitText(bei)}</Text>
          <View
            style={styles.balkenFeld}
            onLayout={(e) => setBalkenBreite(e.nativeEvent.layout.width)}
            {...balkenGriff}
          >
            <View style={styles.balken} pointerEvents="none">
              <View style={[styles.fortschritt, { width: `${gesamt ? (bei / gesamt) * 100 : 0}%` }]} />
            </View>
          </View>
          <Text style={styles.zeit}>{istLive ? 'LIVE' : clip.duration}</Text>
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
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        {/*
          Kapitel (Punkt 32). Nur wenn das Video welche hat - eine leere
          Ueberschrift ueber nichts waere schlechter als gar keine.
        */}
        {kapitel.length > 0 && (
          <View style={styles.kapitel}>
            <Text style={styles.kapitelKopf}>KAPITEL</Text>
            {kapitel.map((k, i) => {
              const aktiv = bei >= k.bei && (!kapitel[i + 1] || bei < kapitel[i + 1].bei);
              return (
                <Druck
                  key={k.bei}
                  style={[styles.kapitelZeile, aktiv && styles.kapitelZeileAktiv]}
                  onPress={() => springen(k.bei)}
                >
                  <Text style={styles.kapitelZeit}>{zeitText(k.bei)}</Text>
                  <Text style={styles.kapitelTitel} numberOfLines={1}>
                    {k.titel}
                  </Text>
                  <Text style={styles.kapitelDauer}>
                    {zeitText((kapitel[i + 1]?.bei ?? gesamt) - k.bei)}
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
          {/* Drei-Punkte-Menue, Vorbild TikTok (components/BeitragOptionenSheet).
              Neben dem Titel, nicht in der Aktionsreihe: dort stehen laut
              Prototyp genau fuenf Knoepfe. */}
          <Druck style={styles.mehr} onPress={() => setMehrOffen(true)} accessibilityLabel="Mehr" hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text2} />
          </Druck>
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

          <Druck
            style={styles.aktion}
            /* Bei Live fuehrt er in die Live-Kommentare, sonst ins gewohnte Blatt. */
            onPress={() => (istLive ? setLiveOffen(true) : setKommentareOffen(true))}
          >
            <Ionicons name="chatbubble-outline" size={22} color={colors.text} />
            <Text style={styles.aktionZahl} numberOfLines={1}>
              {(kommentarZahl[clip.id] ?? clip.comments) ? compact(kommentarZahl[clip.id] ?? clip.comments ?? 0) : 'Kommentar'}
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

        {/*
          * Die Live-Kommentarspalte samt Spendenknopf. Beides steht im
          * Handbuch unter Querformat, beides gab es bis zum 01.09.2026 nicht.
          *
          * Henrik am 21.09.2026: ein kleines Fenster mit den aktuellsten
          * Kommentaren; zum Schreiben klappt man es auf, dann werden die
          * letzten Kommentare groesser angezeigt.
          */}
        {istLive && (
          <View style={styles.live}>
            <View style={styles.liveKopf}>
              <Druck style={styles.liveKopfLinks} onPress={() => setLiveOffen((v) => !v)} hitSlop={6}>
                <Text style={styles.liveTitel}>Live-Kommentare</Text>
                <Ionicons name={liveOffen ? 'chevron-down' : 'chevron-up'} size={16} color={colors.text2} />
              </Druck>
              <Druck style={styles.spendeKnopf} onPress={() => setSpendeOffen(true)}>
                <Ionicons name="heart" size={14} color={colors.white} />
                <Text style={styles.spendeText}>Spenden</Text>
              </Druck>
            </View>

            <Druck onPress={() => !liveOffen && setLiveOffen(true)} disabled={liveOffen}>
              {liveKommentare.length === 0 ? (
                <Text style={styles.liveLeer}>Noch hat niemand etwas geschrieben.</Text>
              ) : (
                liveKommentare.slice(liveOffen ? -30 : -3).map((k) => (
                  <View key={k.id} style={styles.liveZeile}>
                    <Text style={[styles.liveName, liveOffen && styles.liveGross]}>{k.name}</Text>
                    <Text style={[styles.liveText, liveOffen && styles.liveGross]} numberOfLines={liveOffen ? undefined : 1}>
                      {k.text}
                    </Text>
                  </View>
                ))
              )}
            </Druck>

            {liveOffen ? (
              <View style={styles.liveEingabe}>
                <TextInput
                  style={styles.liveFeld}
                  value={liveEntwurf}
                  onChangeText={setLiveEntwurf}
                  placeholder="Etwas sagen …"
                  placeholderTextColor={colors.text3}
                  returnKeyType="send"
                  autoFocus
                  onSubmitEditing={async () => {
                    const text = liveEntwurf.trim();
                    if (!text) return;
                    setLiveEntwurf('');
                    if (await aktionen.streamKommentar(clip.id, text)) liveHolen();
                  }}
                />
              </View>
            ) : (
              <Druck onPress={() => setLiveOffen(true)}>
                <Text style={styles.liveSchreiben}>Kommentieren …</Text>
              </Druck>
            )}
          </View>
        )}

        {/*
          * Spenden in festen Stufen als schneller Weg. Henrik am 21.09.2026:
          * ein eigener Betrag muss waehlbar sein — dafuer der letzte Punkt.
          */}
        <ActionSheet
          visible={spendeOffen}
          title={`An ${autor.name} spenden`}
          items={[
            { key: '100', label: '1,00 €', icon: 'heart-outline' },
            { key: '300', label: '3,00 €', icon: 'heart-outline' },
            { key: '500', label: '5,00 €', icon: 'heart' },
            { key: '1000', label: '10,00 €', icon: 'heart' },
            { key: 'eigen', label: 'Eigener Betrag …', icon: 'create-outline' },
          ]}
          onSelect={async (cent) => {
            setSpendeOffen(false);
            if (cent === 'eigen') return setEigenerBetrag(true);
            const ok = await aktionen.spenden(clip.userId, Number(cent), clip.id);
            if (ok) {
              onNotice(
                `${(Number(cent) / 100).toFixed(2).replace('.', ',')} € an ${autor.name} gespendet`
              );
            }
          }}
          onClose={() => setSpendeOffen(false)}
        />

        <FormularSheet
          visible={eigenerBetrag}
          title={`An ${autor.name} spenden`}
          felder={[{ key: 'betrag', label: 'Betrag in Euro', typ: 'zahl', platzhalter: 'z. B. 2,50', pflicht: true }]}
          knopf="Spenden"
          onClose={() => setEigenerBetrag(false)}
          onSubmit={(werte) => {
            const cent = betragInCent(werte.betrag);
            if (cent === null) return 'Bitte einen Betrag zwischen 0,50 € und 1.000 € eingeben';
            setEigenerBetrag(false);
            aktionen.spenden(clip.userId, cent, clip.id).then((ok) => {
              if (ok) onNotice(`${(cent / 100).toFixed(2).replace('.', ',')} € an ${autor.name} gespendet`);
            });
            return null;
          }}
          onNotice={onNotice}
        />

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

        {/* Bis zum 21.09.2026 nur Text. Jetzt fuehrt er zur ganzen Liste. */}
        <Druck onPress={() => onOpenExplorer({ art: 'querformat', wert: '' })}>
          <Text style={styles.abschnitt}>Ähnliche Videos →</Text>
        </Druck>
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
      <BeitragOptionenSheet
        beitrag={mehrOffen ? { id: clip.id, userId: clip.userId, mediaUri: quelle, video: true } : null}
        onClose={() => setMehrOffen(false)}
        onNotice={onNotice}
      />

      <ActionSheet
        visible={optionen}
        title="Video-Einstellungen"
        items={[
          /* Bei Live gibt es keine Geschwindigkeit — gesendet wird in Echtzeit. */
          ...(istLive
            ? []
            : [{ key: 'tempo', label: `Geschwindigkeit · ${tempoText(video.werte.tempo)}`, icon: 'time-outline' as const }]),
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

      <CommentSheet
        targetId={kommentareOffen ? clip.id : null}
        onClose={() => setKommentareOffen(false)}
        onCountChange={(id, anzahl) => setKommentarZahl((z) => ({ ...z, [id]: anzahl }))}
        onNotice={onNotice}
      />

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
  live: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    gap: 5,
  },
  liveKopf: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveKopfLinks: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveGross: { fontSize: 15, lineHeight: 21 },
  liveSchreiben: { ...typography.small, color: colors.text3, paddingTop: 4 },
  liveTitel: { ...typography.name, color: colors.text },
  spendeKnopf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  spendeText: { ...typography.small, color: colors.white, fontWeight: '600' },
  liveLeer: { ...typography.small, color: colors.text3, paddingVertical: 4 },
  liveZeile: { flexDirection: 'row', gap: 6 },
  liveName: { ...typography.small, color: colors.brand, fontWeight: '700' },
  liveText: { flex: 1, ...typography.small, color: colors.text2 },
  liveEingabe: { marginTop: 6 },
  liveFeld: {
    height: 36,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    backgroundColor: colors.surface3,
    color: colors.text,
  },

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
  buehneQuer: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
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
  /* Die Linie ist 3 Punkte hoch, der Finger braucht mehr — deshalb das Feld drumherum. */
  balkenFeld: { flex: 1, height: 24, justifyContent: 'center' },
  balken: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  fortschritt: { height: '100%', backgroundColor: colors.danger },

  kopf: { paddingLeft: spacing.lg, paddingRight: 52, paddingTop: 14, paddingBottom: 6 },
  mehr: { position: 'absolute', top: 10, right: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
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
