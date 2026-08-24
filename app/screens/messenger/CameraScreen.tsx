import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../constants/design';

export const CameraScreen = ({ onCapture, onClose }: { onCapture?: () => void; onClose?: () => void }) => {
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording] = useState(false);

  const handleCapture = () => {
    if (mode === 'photo') {
      // Simulate photo capture
      alert('📸 Foto aufgenommen!');
      onCapture?.();
    } else {
      // Simulate video toggle
      setIsRecording(!isRecording);
    }
  };

  return (
    <View style={styles.container}>
      {/* Camera Preview (Placeholder) */}
      <View style={styles.cameraPreview}>
        <Text style={styles.cameraIcon}>📷</Text>
        <Text style={styles.previewText}>Kamera-Vorschau</Text>
        <Text style={styles.previewSubtext}>(würde echte Kamera sein mit expo-camera)</Text>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'photo' && styles.modeButtonActive]}
            onPress={() => setMode('photo')}
          >
            <Text style={styles.modeIcon}>📸</Text>
            <Text style={styles.modeText}>Foto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'video' && styles.modeButtonActive]}
            onPress={() => setMode('video')}
          >
            <Text style={styles.modeIcon}>🎥</Text>
            <Text style={styles.modeText}>Video</Text>
          </TouchableOpacity>
        </View>

        {/* Capture Button */}
        <View style={styles.captureContainer}>
          <TouchableOpacity
            style={[styles.captureButton, isRecording && styles.captureButtonRecording]}
            onPress={handleCapture}
          >
            <View
              style={[
                styles.captureBtnInner,
                isRecording && styles.captureBtnInnerRecording,
              ]}
            />
          </TouchableOpacity>
          <Text style={styles.captureText}>{isRecording ? 'Stop' : 'Aufnahme'}</Text>
        </View>

        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
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
  },
  modeToggle: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
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
  captureContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  captureButtonRecording: {
    backgroundColor: colors.like,
  },
  captureBtnInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.brand,
  },
  captureBtnInnerRecording: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  captureText: {
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
  closeText: {
    fontSize: 24,
    color: colors.white,
  },
});
