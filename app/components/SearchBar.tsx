import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../constants/design';

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (text: string) => void;
  onClear?: () => void;
}

export const SearchBar = ({ placeholder = 'Suche...', onSearch, onClear }: SearchBarProps) => {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    setText('');
    onClear?.();
  };

  const handleChangeText = (value: string) => {
    setText(value);
    onSearch?.(value);
  };

  return (
    <View style={[styles.container, isFocused && styles.containerFocused]}>
      <Text style={styles.searchIcon}>🔍</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.mediumGray}
        value={text}
        onChangeText={handleChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {text ? (
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <Text style={styles.clearIcon}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.lightGray,
    borderRadius: radius.small,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  containerFocused: {
    borderColor: colors.brand,
    backgroundColor: colors.white,
  },
  searchIcon: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    fontSize: typography.body.fontSize,
    color: colors.darkGray,
    padding: 0,
  },
  clearButton: {
    padding: spacing.sm,
  },
  clearIcon: {
    fontSize: 16,
    color: colors.mediumGray,
  },
});
