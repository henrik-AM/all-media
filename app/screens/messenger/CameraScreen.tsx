import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, typography } from '../../constants/design';
import { uploadImage } from '../../lib/supabaseStorage';

type Mode = 'photo' | 'video';

interface Props {
  onClose: () => void;
  onCaptured?: (uri: string) => void;
  onNotice: (message: string) => void;
}

export const CameraScreen = ({ onClose, onCaptured, onNotice }: Props) => {
  const [mode, setMode] = useState<Mode>('photo');
  const [busy, setBusy] = useState(false);

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

      const asset = result.assets[0];
      onCaptured?.(asset.uri);

      const fileName = `${Date.now()}.${mode === 'photo' ? 'jpg' : 'mp4'}`;
      const upload = await uploadImage(asset as unknown as Blob, 'stories', fileName);

      onNotice(
        upload.success
          ? `${mode === 'photo' ? 'Foto' : 'Video'} hochgeladen`
          : `${mode === 'photo' ? 'Foto' : 'Video'} gespeichert (kein Backend verbunden)`
      );
    } catch {
      onNotice('Zugriff auf Kamera oder Galerie nicht möglich');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Pressable onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={26} color={colors.white} />
        </Pressable>
        <Pressable onPress={() => onNotice('Blitz umgeschaltet')} hitSlop={10}>
          <Ionicons name="flash-outline" size={24} color={colors.white} />
        </Pressable>
      </View>

      <View style={styles.stage}>
        {busy ? (
          <>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.stageText}>Wird verarbeitet …</Text>
          </>
        ) : (
          <Ionicons name="camera-outline" size={64} color="rgba(255,255,255,0.3)" />
        )}
      </View>

      <View style={styles.modes}>
        {(['photo', 'video'] as Mode[]).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} disabled={busy}>
            <Text style={[styles.mode, mode === m && styles.modeActive]}>
              {m === 'photo' ? 'FOTO' : 'VIDEO'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.bottom}>
        <Pressable style={styles.side} onPress={() => pick('library')} disabled={busy}>
          <Ionicons name="image-outline" size={22} color={colors.white} />
        </Pressable>

        <Pressable style={styles.shutter} onPress={() => pick('camera')} disabled={busy}>
          <View style={styles.shutterInner} />
        </Pressable>

        <Pressable style={styles.side} onPress={() => onNotice('Kamera gewechselt')} disabled={busy}>
          <Ionicons name="camera-reverse-outline" size={22} color={colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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

  modes: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, paddingVertical: spacing.md },
  mode: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  modeActive: { color: colors.white },

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
});
