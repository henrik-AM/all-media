import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Motiv } from '../components/Motiv';
import { colors, spacing, themenStyles } from '../constants/design';

interface Props {
  id: string;
  name: string;
  onBack: () => void;
}

export const AvatarViewerScreen = ({ id, name, onBack }: Props) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Druck onPress={onBack} hitSlop={6}>
          <Ionicons name="close" size={28} color={colors.text} />
        </Druck>
        <Text style={styles.name}>{name}</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <Motiv
          id={id}
          icon="person-outline"
          iconSize={80}
          style={styles.avatar}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = themenStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { fontSize: 17, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'center' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  avatar: { width: 240, height: 240, borderRadius: 120 },
}));
