import React, { useContext, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Druck } from '../components/Druck';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthContext } from '../contexts/AuthContext';
import { brandGradient, colors, radius, shadow, spacing, typography } from '../constants/design';

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
          {/* Das Zeichen der App ist das Erste, was jemand von All Media
              sieht. Eine flache Fläche wirkt dort wie ein Platzhalter —
              deshalb trägt es den Markenverlauf und einen farbigen Schatten,
              genau wie jede Hauptaktion in der App. */}
          <LinearGradient
            colors={brandGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.brandMark}
          >
            <Ionicons name="chatbubbles" size={34} color={colors.white} />
          </LinearGradient>
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
            <Druck onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={19}
                color={colors.text3}
              />
            </Druck>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Druck style={styles.buttonWrap} onPress={submit}>
            <LinearGradient
              colors={brandGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>
                {mode === 'login' ? 'Anmelden' : 'Registrieren'}
              </Text>
            </LinearGradient>
          </Druck>

          <Druck
            style={styles.switch}
            onPress={() => {
              setMode((m) => (m === 'login' ? 'register' : 'login'));
              setError(null);
            }}
          >
            <Text style={styles.switchText}>
              {mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Bereits registriert? Anmelden'}
            </Text>
          </Druck>

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
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadow.brand,
  },
  title: { textAlign: 'center', color: colors.text, ...typography.title, fontSize: 30 },
  subtitle: { textAlign: 'center', marginBottom: spacing.lg, color: colors.text2, ...typography.body },

  /* Dieselbe Feldform wie die Suche im Rest der App: weiches Rechteck mit
     feiner Kante statt grauer Vollfläche. Ein Anmeldebildschirm, der anders
     aussieht als die App dahinter, wirkt wie von woanders eingeklebt. */
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.soft,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, ...typography.body },

  error: { color: colors.danger, ...typography.preview },

  buttonWrap: { marginTop: spacing.sm, borderRadius: radius.soft, ...shadow.brand },
  button: {
    height: 52,
    borderRadius: radius.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.white, ...typography.h3, fontSize: 16 },

  switch: { alignItems: 'center', paddingVertical: spacing.md },
  switchText: { color: colors.brand, ...typography.body },

  hint: { textAlign: 'center', color: colors.text3, ...typography.small },
});
