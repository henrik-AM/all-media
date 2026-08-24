import React, { useContext, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthContext } from '../contexts/AuthContext';
import { colors, radius, spacing, typography } from '../constants/design';

export const LoginScreen = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useContext(AuthContext);

  const submit = () => {
    if (!email.trim()) return setError('Bitte E-Mail-Adresse eingeben');
    if (!email.includes('@')) return setError('Bitte eine gültige E-Mail-Adresse eingeben');
    if (password.length < 6) return setError('Das Passwort braucht mindestens 6 Zeichen');

    setError(null);
    login(email.trim(), password);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandMark}>
            <Ionicons name="chatbubbles" size={34} color={colors.white} />
          </View>
          <Text style={styles.title}>All Media</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}
          </Text>

          <View style={styles.field}>
            <Ionicons name="mail-outline" size={19} color={colors.text3} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="E-Mail"
              placeholderTextColor={colors.text3}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <View style={styles.field}>
            <Ionicons name="lock-closed-outline" size={19} color={colors.text3} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Passwort"
              placeholderTextColor={colors.text3}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={19}
                color={colors.text3}
              />
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.button} onPress={submit}>
            <Text style={styles.buttonText}>
              {mode === 'login' ? 'Anmelden' : 'Registrieren'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.switch}
            onPress={() => {
              setMode((m) => (m === 'login' ? 'register' : 'login'));
              setError(null);
            }}
          >
            <Text style={styles.switchText}>
              {mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Bereits registriert? Anmelden'}
            </Text>
          </Pressable>

          <Text style={styles.hint}>
            Testzugang: beliebige E-Mail mit @ und ein Passwort mit 6 Zeichen
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },

  brandMark: {
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: radius.xl,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { textAlign: 'center', color: colors.text, ...typography.title },
  subtitle: { textAlign: 'center', marginBottom: spacing.lg, color: colors.text2, ...typography.body },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
  },
  input: { flex: 1, color: colors.text, ...typography.body },

  error: { color: colors.danger, ...typography.preview },

  button: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  buttonText: { color: colors.white, ...typography.h3 },

  switch: { alignItems: 'center', paddingVertical: spacing.md },
  switchText: { color: colors.brand, ...typography.body },

  hint: { textAlign: 'center', color: colors.text3, ...typography.small },
});
