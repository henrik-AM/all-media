import React, { useState, useContext } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import { colors, spacing, radius, typography } from '../constants/design';

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useContext(AuthContext);

  const handleLogin = () => {
    login(email, password);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All Media</Text>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        placeholderTextColor={colors.mediumGray}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
        placeholderTextColor={colors.mediumGray}
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  title: { fontSize: typography.h2.fontSize, fontWeight: '700', marginBottom: spacing.xl, textAlign: 'center' },
  input: { borderBottomWidth: 1, borderColor: colors.lightGray, padding: spacing.md, marginBottom: spacing.md, fontSize: typography.body.fontSize },
  button: { backgroundColor: colors.brand, padding: spacing.md, borderRadius: radius.small, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '600', fontSize: typography.body.fontSize },
});
