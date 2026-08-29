import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../constants/design';

export const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // For now, we assume online unless we implement network detection
    // In production, would use:
    // - NetInfo.addEventListener() to detect connection changes
    // - Check internet connectivity on app launch
    setIsOnline(true);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      (appState.match(/inactive|background/) && nextAppState === 'active') ||
      nextAppState === 'active'
    ) {
      // App resumed - could check connection here
      setIsOnline(true);
    }
    setAppState(nextAppState);
  };

  if (isOnline) {
    return null; // No indicator needed when online
  }

  return (
    <View style={styles.container}>
      <View style={styles.indicator} />
      <Text style={styles.text}>Offline — Daten werden synchronisiert</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFC107',
  },
  text: {
    ...typography.small,
    color: '#856404',
    fontWeight: '500',
  },
});
