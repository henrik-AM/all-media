import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../constants/design';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onAdd?: () => void;
}

export const SearchBar = ({ value, onChangeText, placeholder = 'Suchen', onAdd }: Props) => (
  <View style={styles.row}>
    <View style={styles.box}>
      <Ionicons name="search" size={18} color={colors.text3} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text3}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={colors.text3} />
        </Pressable>
      )}
    </View>
    {onAdd && (
      <Pressable style={styles.add} onPress={onAdd}>
        <Ionicons name="add" size={22} color={colors.white} />
      </Pressable>
    )}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 40,
    paddingHorizontal: 13,
    borderRadius: radius.xl,
    backgroundColor: colors.surface3,
  },
  input: {
    flex: 1,
    padding: 0,
    color: colors.text,
    ...typography.body,
  },
  add: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
