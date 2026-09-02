import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionSheet } from '../../components/ActionSheet';
import { FilterBild } from '../../components/FilterBild';
import { InsightSheet, InsightWahl } from '../../components/InsightSheet';
import { FILTER } from '../../constants/filter';
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
  /** Aufnahme als Beitrag veröffentlichen. */
  onAlsBeitrag?: (uri: string) => void;
  /**
   * Steht das Ziel schon fest — die Kamera kam aus einem Chat —, geht die
   * Aufnahme ohne Rückfrage dorthin.
   */
  direktZu?: (uri: string) => void;
  onNotice: (message: string) => void;
}

/*
 * Punkt 17: die Kamera nimmt auf und fragt danach, was mit der Aufnahme
 * geschehen soll. Vorher landete jedes Foto stillschweigend in der Story —
 * wer es jemandem schicken wollte, musste den Umweg über den Chat nehmen.
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
  { key: 'beitrag', label: 'Als Beitrag veröffentlichen', icon: 'image-outline' as const },
];

export const CameraScreen = ({
  embedded = false,
  onClose,
  onCaptured,
  onAnChat,
  onAlsBeitrag,
  direktZu,
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
   * Die Aufnahme wandert vom Ziel-Blatt ins Insight-Blatt. Zwei Zustaende
   * statt einem, weil zwischendurch das erste Blatt zugeht — wuerde
   * `aufnahme` dabei geleert, staende das zweite ohne Bild da.
   */
  const [insightBild, setInsightBild] = useState<string | null>(null);

  const pick = async (source: 'camera' | 'library') => {
    setBusy(true);
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: mode === 'photo' ? ['images'] : ['videos'],
        allowsEditing: true,
        quality: 0.8,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled || !result.assets.length) return;

      const uri = result.assets[0].uri;
      if (direktZu) return direktZu(uri);
      setAufnahme(uri);
    } catch {
      onNotice('Zugriff auf Kamera oder Galerie nicht möglich');
    } finally {
      setBusy(false);
    }
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
    if (key === 'chat') return onAnChat?.(uri);
    onAlsBeitrag?.(uri);
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
        <Druck onPress={() => onNotice('Blitz umgeschaltet')} hitSlop={10}>
          <Ionicons name="flash-outline" size={24} color={colors.white} />
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
            ) : (
              <Ionicons name="camera-outline" size={34} color="rgba(255,255,255,0.22)" />
            )}
          </>
        )}
      </View>

      {/*
        * Die Filterleiste. Ohne Vorschau waere sie eine Reihe von Woertern,
        * die nichts zeigen — deshalb steht ueber ihr die letzte Aufnahme,
        * sobald es eine gibt, und sonst der Sucher.
        */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filter}
      >
        {FILTER.map((f) => (
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
        <Druck style={styles.side} onPress={() => pick('library')} disabled={busy}>
          <Ionicons name="image-outline" size={22} color={colors.white} />
        </Druck>

        <Druck style={styles.shutter} onPress={() => pick('camera')} disabled={busy}>
          <View style={styles.shutterInner} />
        </Druck>

        <Druck style={styles.side} onPress={() => onNotice('Kamera gewechselt')} disabled={busy}>
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
  filter: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
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
}));
