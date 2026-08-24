import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, typography } from '../../constants/design';
import { uploadImage } from '../../lib/supabaseStorage';

export const CameraScreen = ({
  onCapture,
  onClose,
}: {
  onCapture?: (mediaUrl: string) => void;
  onClose?: () => void;
}) => {
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [isUploading, setIsUploading] = useState(false);

  const handleCapture = async () => {
    try {
      setIsUploading(true);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: mode === 'photo' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];

        // Upload to Supabase
        const fileName = `${Date.now()}_${mode}.${mode === 'photo' ? 'jpg' : 'mp4'}`;
        const { success, url } = await uploadImage(asset as any, 'stories', fileName);

        if (success && url) {
          alert(`✅ ${mode === 'photo' ? 'Foto' : 'Video'} hochgeladen!`);
          onCapture?.(url);
        } else {
          alert('❌ Upload fehlgeschlagen');
        }
      }
    } catch (err) {
      console.warn('Camera error:', err);
      alert('Fehler beim Zugriff auf die Kamera');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      setIsUploading(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mode === 'photo' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];

        // Upload to Supabase
        const fileName = `${Date.now()}_${mode}.${mode === 'photo' ? 'jpg' : 'mp4'}`;
        const { success, url } = await uploadImage(asset as any, 'stories', fileName);

        if (success && url) {
          alert(`✅ ${mode === 'photo' ? 'Foto' : 'Video'} hochgeladen!`);
          onCapture?.(url);
        } else {
          alert('❌ Upload fehlgeschlagen');
        }
      }
    } catch (err) {
      console.warn('Gallery error:', err);
      alert('Fehler beim Zugriff auf die Galerie');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Camera Preview Area */}
      <View style={styles.cameraPreview}>
        {isUploading ? (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.uploadingText}>Hochladen...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.cameraIcon}>📷</Text>
            <Text style={styles.previewText}>Kamera & Galerie</Text>
            <Text style={styles.previewSubtext}>Tippe auf Capture oder Galerie</Text>
          </>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'photo' && styles.modeButtonActive]}
            onPress={() => setMode('photo')}
            disabled={isUploading}
          >
            <Text style={styles.modeIcon}>📸</Text>
            <Text style={styles.modeText}>Foto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'video' && styles.modeButtonActive]}
            onPress={() => setMode('video')}
            disabled={isUploading}
          >
            <Text style={styles.modeIcon}>🎥</Text>
            <Text style={styles.modeText}>Video</Text>
          </TouchableOpacity>
        </View>

        {/* Button Row */}
        <View style={styles.buttonRow}>
          {/* Capture Button */}
          <TouchableOpacity
            style={[styles.actionButton, isUploading && styles.actionButtonDisabled]}
            onPress={handleCapture}
            disabled={isUploading}
          >
            <Text style={styles.actionButtonIcon}>📹</Text>
            <Text style={styles.actionButtonText}>Capture</Text>
          </TouchableOpacity>

          {/* Gallery Button */}
          <TouchableOpacity
            style={[styles.actionButton, isUploading && styles.actionButtonDisabled]}
            onPress={handlePickFromGallery}
            disabled={isUploading}
          >
            <Text style={styles.actionButtonIcon}>🖼️</Text>
            <Text style={styles.actionButtonText}>Galerie</Text>
          </TouchableOpacity>
        </View>

        {/* Close Button */}
        <TouchableOpacity
          style={[styles.closeButton, isUploading && styles.closeButtonDisabled]}
          onPress={onClose}
          disabled={isUploading}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  cameraPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  uploadingOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  uploadingText: {
    color: colors.white,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  cameraIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  previewText: {
    fontSize: typography.h3.fontSize,
    fontWeight: '600',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  previewSubtext: {
    fontSize: typography.small.fontSize,
    color: colors.mediumGray,
  },
  controlsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.small,
    backgroundColor: colors.darkGray,
  },
  modeButtonActive: {
    backgroundColor: colors.brand,
  },
  modeIcon: {
    fontSize: 18,
  },
  modeText: {
    color: colors.white,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.medium,
    backgroundColor: colors.brand,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonIcon: {
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: typography.small.fontSize,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonDisabled: {
    opacity: 0.3,
  },
  closeText: {
    fontSize: 24,
    color: colors.white,
  },
});
