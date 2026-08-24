import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../constants/design';

export const PlaceholderScreen = ({ title }: { title: string }) => (
  <View style={styles.container}>
    <Text style={styles.text}>📋 {title}</Text>
    <Text style={styles.subtitle}>Bald verfügbar</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  text: { fontSize: typography.h2.fontSize, fontWeight: '600', marginBottom: spacing.md },
  subtitle: { fontSize: typography.small.fontSize, color: colors.mediumGray },
});
