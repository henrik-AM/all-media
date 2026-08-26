import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import { } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionSheet } from '../../components/ActionSheet';
import { colors, spacing, themenStyles, typography } from '../../constants/design';
import { uploadImage } from '../../lib/supabaseStorage';

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
  const [mode, setMode] = useState<Mode>('photo');
  const [busy, setBusy] = useState(false);
  const [aufnahme, setAufnahme] = useState<string | null>(null);

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

    const fileName = `${Date.now()}.${mode === 'photo' ? 'jpg' : 'mp4'}`;
    const upload = await uploadImage({ uri } as unknown as Blob, 'stories', fileName);

    onNotice(
      upload.success
        ? `${mode === 'photo' ? 'Foto' : 'Video'} hochgeladen`
        : `${mode === 'photo' ? 'Foto' : 'Video'} gespeichert (kein Backend verbunden)`
    );
  };

  const zielGewaehlt = (key: string) => {
    const uri = aufnahme;
    setAufnahme(null);
    if (!uri) return;

    if (key === 'story') return void alsStory(uri);
    if (key === 'chat') return onAnChat?.(uri);
    onAlsBeitrag?.(uri);
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
            <Ionicons name="camera-outline" size={34} color="rgba(255,255,255,0.22)" />
          </>
        )}
      </View>

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
