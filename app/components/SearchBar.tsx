import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Druck } from './Druck';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { brandGradient, colors, radius, shadow, spacing, typography } from '../constants/design';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onAdd?: () => void;
}

/**
 * Suchfeld. Weiches Rechteck statt voller Pille — die Pille ist der Default,
 * den jede App benutzt; das weiche Rechteck wirkt gesetzt. Dazu eine feine
 * Kante, damit das Feld auf weißem Grund überhaupt eine Form hat.
 *
 * Der Plus-Knopf trägt den Markenverlauf und einen farbigen Schatten. Er ist
 * damit die einzige echte Farbfläche auf dem Bildschirm und wird zum Blickziel.
 */
export const SearchBar = ({ value, onChangeText, placeholder = 'Suchen', onAdd }: Props) => (
  <View style={styles.row}>
    <View style={styles.box}>
      <Ionicons name="search" size={17} color={colors.text3} />
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
        <Druck onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={17} color={colors.text3} />
        </Druck>
      )}
    </View>
    {onAdd && (
      <Druck
        style={({ pressed }) => [styles.addWrap, pressed && styles.addPressed]}
        onPress={onAdd}
        accessibilityLabel="Neu"
      >
        <LinearGradient
          colors={brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.add}
        >
          <Ionicons name="add" size={22} color={colors.white} />
        </LinearGradient>
      </Druck>
    )}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 13,
    borderRadius: radius.soft,
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    padding: 0,
    color: colors.text,
    ...typography.body,
  },
  addWrap: {
    borderRadius: radius.soft,
    ...shadow.brand,
  },
  addPressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },
  add: {
    width: 42,
    height: 42,
    borderRadius: radius.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
