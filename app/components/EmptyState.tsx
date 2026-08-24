import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, typography } from '../constants/design';

interface Props {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  text?: string;
}

export const EmptyState = ({ icon, title, text }: Props) => (
  <View style={styles.wrap}>
    <Ionicons name={icon} size={42} color={colors.text3} />
    <Text style={styles.title}>{title}</Text>
    {text ? <Text style={styles.text}>{text}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 56,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    color: colors.text2,
    ...typography.h3,
  },
  text: {
    color: colors.text3,
    textAlign: 'center',
    ...typography.preview,
  },
});
