import React, { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import * as ImagePicker from 'expo-image-picker';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraCapturedPicture,
} from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionSheet } from '../../components/ActionSheet';
import { FilterBild } from '../../components/FilterBild';
import { InsightSheet, InsightWahl } from '../../components/InsightSheet';
import { FILTER, filterZu } from '../../constants/filter';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { ladeHoch } from '../../lib/supabaseStorage';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAktionen } from '../../lib/useAktionen';
import { useDaten } from '../../contexts/DatenContext';

type Mode = 'photo' | 'video';

interface Props {
  /** Als Unterpunkt der oberen Leiste, also ohne Schliessen-Schaltflaeche. */
  embedded?: boolean;
  onClose: () => void;
  onCaptured?: (uri: string) => void;
  /** Aufnahme in einen Chat schicken. */
  onAnChat?: (uri: string) => void;
  /**
   * Steht das Ziel schon fest — die Kamera kam aus einem Chat —, geht die
   * Aufnahme ohne Rückfrage dorthin.
   */
  direktZu?: (uri: string) => void;
  /**
   * Die Kamera kam über das Plus an der eigenen Story.
   *
   * Henrik, 07.09.2026: "Story-Plus-Button zeigt unnötig „Was möchtest du
   * damit machen"-Dialog (nur bei normaler Kamera nötig)." Wer auf das Plus
   * an der Story tippt, hat das Ziel schon genannt. Die Frage danach ist eine
   * Rückfrage nach etwas, das gerade gesagt wurde.
   */
  zielStory?: boolean;
  onNotice: (message: string) => void;
}

/*
 * Punkt 17: die Kamera nimmt auf und fragt danach, was mit der Aufnahme
 * geschehen soll. Vorher landete jedes Foto stillschweigend in der Story —
 * wer es jemandem schicken wollte, musste den Umweg über den Chat nehmen.
 *
 * Gefragt wird nur noch, wenn das Ziel wirklich offen ist. Kam die Kamera aus
 * einem Chat (`direktZu`) oder vom Plus an der eigenen Story (`zielStory`),
 * steht es schon fest.
 *
 * WARUM „ALS BEITRAG VERÖFFENTLICHEN" HIER NICHT MEHR STEHT
 *
 * Henrik, 07.09.2026: „Beiträge nur Videos, nicht Messenger — Messenger
 * privat/nummerbasiert, Videos öffentlich." Das ist keine Geschmacksfrage,
 * sondern die Trennlinie zwischen den beiden Bereichen der App. Ein Knopf,
 * der aus der privaten Kamera heraus etwas öffentlich stellt, führt genau
 * über diese Linie — und zwar aus Versehen, denn er stand zwischen drei
 * Zielen, die alle im Messenger bleiben. Beiträge entstehen im Videos-Bereich.
 */
const ZIELE = [
  /*
   * Der Insight steht bewusst oben. Er ist die Gattung, fuer die diese
   * Kamera im Handbuch ueberhaupt da ist — eine Aufnahme an ausgewaehlte
   * Personen, die fuer die Insight Time zaehlt. Bis zum 01.09.2026 gab es
   * ihn hier gar nicht: die Kamera kannte nur Story, Chat und Beitrag.
   */
  { key: 'insight', label: 'Als Insight senden', icon: 'flash-outline' as const },
  { key: 'story', label: 'Zu deiner Story hinzufügen', icon: 'camera-outline' as const },
  { key: 'chat', label: 'An einen Chat senden', icon: 'chatbubble-outline' as const },
];

export const CameraScreen = ({
  embedded = false,
  onClose,
  onCaptured,
  onAnChat,
  direktZu,
  zielStory = false,
  onNotice,
}: Props) => {
  const insets = useSafeAreaInsets();
  // Der angemeldete Zugang. Ohne ihn laeuft ein Upload als anonymer Zugriff,
  // und den lassen die Regeln des Speichers nicht zu.
  const { supabase } = useSupabase();
  const aktionen = useAktionen(onNotice);
  const { neuLaden, users } = useDaten();
  const [mode, setMode] = useState<Mode>('photo');
  const [busy, setBusy] = useState(false);
  const [aufnahme, setAufnahme] = useState<string | null>(null);
  const [filter, setFilter] = useState('keiner');

  /*
   * Henrik, 07.09.2026: "Filter-UI umbauen: Toggle oben „ohne/mit Filter",
   * Filterleiste unten nur bei „mit Filter"."
   *
   * Die Leiste stand vorher immer da — auch bei „keiner", wo sie nur Platz
   * nahm und den Sucher kleiner machte. Der Schalter oben sagt jetzt, ob
   * ueberhaupt gefiltert wird; erst dann kommt die Leiste. Wer den Schalter
   * ausmacht, ist wieder bei „keiner" — sonst bliebe ein Filter aktiv, den
   * man nicht mehr sieht.
   */
  const [mitFilter, setMitFilter] = useState(false);
  const filterSchalten = (an: boolean) => {
    setMitFilter(an);
    if (!an) setFilter('keiner');
    else if (filter === 'keiner') setFilter(FILTER[1]?.key ?? 'keiner');
  };

  /*
   * Henrik, 07.09.2026: "Foto- und Videoaufnahme in der App funktioniert
   * nicht (nur Galerie-Upload)" und "Alle Buttons brauchen eine echte,
   * synchronisierte Aktion".
   *
   * Bis heute stand hier ein schwarzes Feld mit einem Kamerasymbol; der
   * Ausloeser rief `ImagePicker.launchCameraAsync` auf — das ist die
   * Kamera-App des Systems, nicht die der App. Blitz und Kamerawechsel gaben
   * nur einen Hinweistext aus, ohne irgendetwas umzustellen.
   *
   * Jetzt laeuft die Vorschau in der App (`CameraView` aus expo-camera), der
   * Ausloeser nimmt hier auf, und Blitz wie Kamerawechsel stellen die
   * Vorschau wirklich um.
   *
   * Im Simulator gibt es keine Kamera. Dort bleibt die Flaeche schwarz und
   * der Weg ueber die Galerie ist der einzige — das ist eine Eigenschaft des
   * Simulators, kein Fehler der App.
   */
  const kamera = useRef<CameraView>(null);
  const [erlaubnis, erlaubnisFragen] = useCameraPermissions();
  const [mikro, mikroFragen] = useMicrophonePermissions();
  const [kameraBereit, setKameraBereit] = useState(false);
  const [richtung, setRichtung] = useState<'back' | 'front'>('back');
  const [blitz, setBlitz] = useState<'off' | 'on' | 'auto'>('off');
  const [laeuft, setLaeuft] = useState(false);
  /*
   * Die Aufnahme wandert vom Ziel-Blatt ins Insight-Blatt. Zwei Zustaende
   * statt einem, weil zwischendurch das erste Blatt zugeht — wuerde
   * `aufnahme` dabei geleert, staende das zweite ohne Bild da.
   */
  const [insightBild, setInsightBild] = useState<string | null>(null);

  /** Was mit einer fertigen Aufnahme geschieht — einerlei woher sie kommt. */
  const uebernehmen = (uri: string) => {
    if (direktZu) return direktZu(uri);
    // Das Plus an der eigenen Story: die Aufnahme geht dorthin, ohne Frage.
    if (zielStory) {
      setAufnahme(null);
      return void alsStory(uri);
    }
    setAufnahme(uri);
  };

  /** Ein Bild oder Video aus der Galerie holen. */
  const ausGalerie = async () => {
    setBusy(true);
    try {
      const ergebnis = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mode === 'photo' ? ['images'] : ['videos'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (ergebnis.canceled || !ergebnis.assets.length) return;
      uebernehmen(ergebnis.assets[0].uri);
    } catch {
      onNotice('Zugriff auf die Galerie nicht möglich');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Der Ausloeser. Foto: ein Druck, ein Bild. Video: der erste Druck startet,
   * der zweite beendet — `recordAsync` gibt die Datei erst zurueck, wenn
   * `stopRecording` gerufen wurde.
   */
  const ausloesen = async () => {
    if (!erlaubnis?.granted) {
      const neu = await erlaubnisFragen();
      if (!neu.granted) return onNotice('Ohne Kamerazugriff geht die Aufnahme nicht');
    }
    if (mode === 'video' && !mikro?.granted) {
      // Ohne Mikrofon nimmt das Video stumm auf — gefragt wird trotzdem
      // einmal, danach nicht wieder.
      await mikroFragen();
    }
    if (!kamera.current || !kameraBereit) {
      return onNotice('Die Kamera ist noch nicht bereit');
    }

    if (mode === 'video') {
      if (laeuft) {
        kamera.current.stopRecording();
        return;
      }
      setLaeuft(true);
      try {
        const video = await kamera.current.recordAsync({ maxDuration: 60 });
        if (video?.uri) uebernehmen(video.uri);
      } catch {
        onNotice('Die Aufnahme ist fehlgeschlagen');
      } finally {
        setLaeuft(false);
      }
      return;
    }

    setBusy(true);
    try {
      const foto: CameraCapturedPicture | undefined = await kamera.current.takePictureAsync({
        quality: 0.8,
      });
      if (foto?.uri) uebernehmen(foto.uri);
    } catch {
      onNotice('Das Foto ist fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  /* Der Blitz geht reihum: aus, an, automatisch. Drei Zustaende, ein Knopf —
     so wie in jeder Kamera-App. */
  const BLITZ_NAME = { off: 'Blitz aus', on: 'Blitz an', auto: 'Blitz automatisch' } as const;
  const BLITZ_ICON = { off: 'flash-off-outline', on: 'flash', auto: 'flash-outline' } as const;
  const blitzWeiter = () => {
    const naechster = blitz === 'off' ? 'on' : blitz === 'on' ? 'auto' : 'off';
    setBlitz(naechster);
    onNotice(BLITZ_NAME[naechster]);
  };

  const kameraWechseln = () => {
    const neu = richtung === 'back' ? 'front' : 'back';
    setRichtung(neu);
    onNotice(neu === 'front' ? 'Frontkamera' : 'Rückkamera');
  };

  /** Story ist das einzige Ziel, das die Aufnahme auch hochlädt. */
  const alsStory = async (uri: string) => {
    onCaptured?.(uri);

    const was = mode === 'photo' ? 'Foto' : 'Video';
    const fileName = `${Date.now()}.${mode === 'photo' ? 'jpg' : 'mp4'}`;
    const upload = await ladeHoch(supabase, uri, 'stories', fileName);

    /*
     * Beim Misserfolg den Grund nennen. Vorher stand hier „gespeichert (kein
     * Backend verbunden)" — ein Satz, der nach Absicht klang, obwohl der
     * Upload schlicht fehlschlug. Er hat monatelang verdeckt, dass gar nichts
     * hochgeladen wurde.
     */
    onNotice(upload.success ? `${was} hochgeladen` : `${was} konnte nicht hochgeladen werden`);
  };

  const zielGewaehlt = (key: string) => {
    const uri = aufnahme;
    setAufnahme(null);
    if (!uri) return;

    if (key === 'insight') return setInsightBild(uri);
    if (key === 'story') return void alsStory(uri);
    onAnChat?.(uri);
  };

  /**
   * Den Insight wegschicken und melden, was mit den Ketten passiert ist.
   *
   * Die Rueckmeldung nennt die neue Insight Time, wo es eine gibt. Ohne sie
   * bliebe unklar, ob der Tag gezaehlt hat — und genau darum geht es bei
   * dieser Gattung. Steht die Kette noch offen, weil die Gegenseite heute
   * nichts geschickt hat, sagt die Meldung das ebenfalls.
   */
  const insightSenden = async (wahl: InsightWahl) => {
    const uri = insightBild;
    setInsightBild(null);
    if (!uri) return;

    const ergebnis = await aktionen.insightSenden(wahl.empfaenger, {
      mediaUrl: uri,
      mediaTyp: mode === 'photo' ? 'image' : 'video',
      filter,
      dauer: wahl.dauer,
      einmal: wahl.einmal,
      loeschtNachStunden: wahl.loeschtNachStunden || undefined,
      gespeichert: wahl.gespeichert,
    });
    if (!ergebnis) return;

    const gezaehlt = Object.entries(ergebnis.streaks).filter(([, tage]) => tage > 0);
    if (gezaehlt.length === 1) {
      const [id, tage] = gezaehlt[0];
      onNotice(`Insight gesendet — 📷 ${tage} mit ${users[id]?.name ?? 'dieser Person'}`);
    } else if (gezaehlt.length > 1) {
      onNotice(`Insight an ${wahl.empfaenger.length} gesendet — ${gezaehlt.length} Ketten laufen`);
    } else {
      onNotice('Insight gesendet — die Kette zählt, sobald zurückgeschickt wird');
    }

    await neuLaden();
  };

  return (
    <View style={[styles.container, { paddingTop: embedded ? 0 : insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.top}>
        {embedded ? (
          <View style={styles.spacer} />
        ) : (
          <Druck onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color={colors.white} />
          </Druck>
        )}
        <Druck onPress={blitzWeiter} hitSlop={10}>
          <Ionicons
            name={BLITZ_ICON[blitz]}
            size={24}
            color={blitz === 'off' ? colors.white : colors.brand}
          />
        </Druck>
      </View>

      <View style={styles.stage}>
        {busy ? (
          <>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.stageText}>Wird verarbeitet …</Text>
          </>
        ) : (
          <>
            {/* Die vier Fokus-Ecken, die jede Kamera-App zeigt. Ohne sie ist
                der Sucher eine schwarze Fläche mit einem großen Symbol darin
                — das liest sich als „hier fehlt etwas". */}
            <View style={styles.sucher} pointerEvents="none">
              <View style={[styles.ecke, styles.eckeOL]} />
              <View style={[styles.ecke, styles.eckeOR]} />
              <View style={[styles.ecke, styles.eckeUL]} />
              <View style={[styles.ecke, styles.eckeUR]} />
            </View>
            {aufnahme ? (
              <FilterBild uri={aufnahme} filter={filter} style={styles.vorschau} />
            ) : erlaubnis?.granted ? (
              <>
                {/* Die Vorschau selbst. Sie liegt unter den Fokus-Ecken —
                    deshalb kommt sie hier zuletzt und ist absolut gesetzt. */}
                <CameraView
                  ref={kamera}
                  style={styles.vorschau}
                  facing={richtung}
                  flash={blitz}
                  mode={mode === 'photo' ? 'picture' : 'video'}
                  onCameraReady={() => setKameraBereit(true)}
                />
                {/* Der Filter liegt schon ueber dem Sucher, nicht erst ueber
                    der fertigen Aufnahme — sonst waehlt man blind. Es ist
                    dieselbe Rechnung wie in FilterBild. */}
                {mitFilter && filterZu(filter).staerke > 0 && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.vorschau,
                      { backgroundColor: filterZu(filter).ton, opacity: filterZu(filter).staerke },
                    ]}
                  />
                )}
                {laeuft && (
                  <View style={styles.laeuftSchild} pointerEvents="none">
                    <View style={styles.laeuftPunkt} />
                    <Text style={styles.laeuftText}>Aufnahme läuft</Text>
                  </View>
                )}
              </>
            ) : (
              /* Ohne Erlaubnis bleibt nur die Frage. Vorher stand hier ein
                 graues Kamerasymbol, das nichts erklaerte. */
              <>
                <Ionicons name="camera-outline" size={34} color="rgba(255,255,255,0.22)" />
                <Text style={styles.stageText}>All Media darf noch nicht auf die Kamera</Text>
                <Druck style={styles.erlaubnisKnopf} onPress={() => void erlaubnisFragen()}>
                  <Text style={styles.erlaubnisText}>Kamera erlauben</Text>
                </Druck>
              </>
            )}
          </>
        )}
      </View>

      {/*
        * Die Filterleiste. Ohne Vorschau waere sie eine Reihe von Woertern,
        * die nichts zeigen — deshalb steht ueber ihr die letzte Aufnahme,
        * sobald es eine gibt, und sonst der Sucher.
        */}
      <View style={styles.filterSchalter}>
        {([false, true] as const).map((an) => (
          <Druck
            key={String(an)}
            style={[styles.schalterHaelfte, mitFilter === an && styles.schalterHaelfteAktiv]}
            onPress={() => filterSchalten(an)}
          >
            <Text style={[styles.schalterText, mitFilter === an && styles.schalterTextAktiv]}>
              {an ? 'Mit Filter' : 'Ohne Filter'}
            </Text>
          </Druck>
        ))}
      </View>

      {mitFilter && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterLeiste}
          contentContainerStyle={styles.filter}
        >
          {FILTER.filter((f) => f.key !== 'keiner').map((f) => (
            <Druck
              key={f.key}
              style={[styles.filterPille, filter === f.key && styles.filterPilleAktiv]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextAktiv]}>
                {f.label}
              </Text>
            </Druck>
          ))}
        </ScrollView>
      )}

      <View style={styles.modes}>
        {(['photo', 'video'] as Mode[]).map((m) => (
          <Druck key={m} onPress={() => setMode(m)} disabled={busy}>
            <Text style={[styles.mode, mode === m && styles.modeActive]}>
              {m === 'photo' ? 'FOTO' : 'VIDEO'}
            </Text>
          </Druck>
        ))}
      </View>

      <View style={styles.bottom}>
        <Druck style={styles.side} onPress={ausGalerie} disabled={busy || laeuft}>
          <Ionicons name="image-outline" size={22} color={colors.white} />
        </Druck>

        <Druck style={styles.shutter} onPress={ausloesen} disabled={busy}>
          <View style={[styles.shutterInner, laeuft && styles.shutterStop]} />
        </Druck>

        <Druck style={styles.side} onPress={kameraWechseln} disabled={busy || laeuft}>
          <Ionicons name="camera-reverse-outline" size={22} color={colors.white} />
        </Druck>
      </View>

      <InsightSheet
        visible={!!insightBild}
        uri={insightBild}
        filter={filter}
        onClose={() => setInsightBild(null)}
        onSenden={insightSenden}
      />

      <ActionSheet
        visible={!!aufnahme}
        title="Was möchtest du damit machen?"
        items={ZIELE}
        vorschauUri={aufnahme ?? undefined}
        onSelect={zielGewaehlt}
        onClose={() => setAufnahme(null)}
      />
    </View>
  );
};

const styles = themenStyles((colors) => ({
  spacer: { width: 26, height: 26 },
  container: { flex: 1, backgroundColor: '#0B0B0C' },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  stageText: { color: colors.white, ...typography.body },

  sucher: { position: 'absolute', top: '12%', bottom: '12%', left: '10%', right: '10%' },
  ecke: { position: 'absolute', width: 26, height: 26, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 3 },
  eckeOL: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  eckeOR: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  eckeUL: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  eckeUR: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },

  vorschau: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  /*
   * Die Leiste darf nur so hoch sein wie ihre Pillen.
   *
   * Ohne `flexGrow: 0` nimmt der ScrollView den freien Platz zwischen Sucher
   * und Auslöser ein, und ohne `alignItems` ziehen sich die Pillen auf diese
   * ganze Höhe: aus einer Reihe flacher Knöpfe werden Säulen über das halbe
   * Bild. Zu sehen war das in keiner Prüfung — nur im Bild aus dem
   * Simulator.
   */
  filterLeiste: { flexGrow: 0, flexShrink: 0 },
  /* Der Schalter aus dem Figma-Entwurf: zwei Haelften in einer Pille, oben
     ueber der Leiste. Er sagt, ob ueberhaupt gefiltert wird — die Leiste
     darunter erscheint erst danach. */
  filterSchalter: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.sm,
  },
  schalterHaelfte: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: radius.pill },
  schalterHaelfteAktiv: { backgroundColor: colors.white },
  schalterText: { ...typography.small, color: 'rgba(255,255,255,0.75)' },
  schalterTextAktiv: { color: '#0B0B0C', fontWeight: '700' },
  erlaubnisKnopf: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  erlaubnisText: { ...typography.small, color: colors.white, fontWeight: '700' },
  /* Das rote Schild waehrend einer Videoaufnahme — sonst sieht man dem
     Ausloeser nicht an, dass er gerade laeuft. */
  laeuftSchild: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  laeuftPunkt: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5484D' },
  laeuftText: { ...typography.small, color: colors.white },
  filter: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  filterPille: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  filterPilleAktiv: { backgroundColor: colors.white },
  filterText: { ...typography.small, color: 'rgba(255,255,255,0.75)' },
  filterTextAktiv: { color: '#0B0B0C', fontWeight: '700' },
  modes: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  /* Die aktive Betriebsart bekommt eine eigene Fläche. Nur „helleres Weiß"
     gegen „blasseres Weiß" ist auf schwarzem Grund kaum zu erkennen. */
  mode: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  modeActive: { color: colors.white, backgroundColor: 'rgba(255,255,255,0.14)' },

  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  side: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: colors.white,
    padding: 4,
  },
  shutterInner: { flex: 1, borderRadius: 26, backgroundColor: colors.white },
  /* Laeuft die Aufnahme, wird aus dem weissen Kreis ein rotes Quadrat: der
     zweite Druck beendet das Video. */
  shutterStop: { borderRadius: 8, margin: 12, backgroundColor: '#E5484D' },
}));
