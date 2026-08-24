import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { avatarColor, colors, initialsOf } from '../constants/design';

interface Props {
  id: string;
  name: string;
  size?: number;
  group?: boolean;
  style?: ViewStyle;
}

export const Avatar = ({ id, name, size = 52, group = false, style }: Props) => {
  const base: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (group) {
    return (
      <View style={[base, { backgroundColor: '#4A7BA7' }, style]}>
        <Ionicons name="people" size={size * 0.46} color={colors.white} />
      </View>
    );
  }

  return (
    <View style={[base, { backgroundColor: avatarColor(id) }, style]}>
      <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initialsOf(name)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  initials: {
    color: colors.white,
    fontWeight: '600',
  },
});
