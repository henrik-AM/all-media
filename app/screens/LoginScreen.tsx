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
import { brandGradient, colors, radius, shadow, spacing, themenStyles, typography } from '../constants/design';

interface Props {
  authMethod?: 'email' | 'phone' | 'google' | 'apple';
  onBack?: () => void;
}

export const LoginScreen = ({ authMethod: initialMethod = 'email', onBack }: Props) => {
  const [screen, setScreen] = useState<'choose' | 'auth'>('choose');
  const [currentMethod, setCurrentMethod] = useState<'email' | 'phone' | 'google' | 'apple'>(initialMethod);
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [resetStage, setResetStage] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, kontoHinzufuegen, sendPasswordResetCode } = useContext(AuthContext);

  // Social login handler
  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setError(null);
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const email = `${provider}-user@allmedia.app`;
      const password = `${provider}-oauth-123`;
      await login(email, password);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (mode === 'reset') {
      if (resetStage === 'email') {
        const identifier = currentMethod === 'phone' ? phone : email;
        if (!identifier.trim()) {
          return setError(currentMethod === 'phone' ? 'Bitte Telefonnummer eingeben' : 'Bitte E-Mail-Adresse eingeben');
        }
        if (currentMethod === 'email' && !identifier.includes('@')) {
          return setError('Bitte eine gültige E-Mail-Adresse eingeben');
        }
        if (currentMethod === 'phone' && !/^\+?[0-9\s\-()]{9,}$/.test(identifier)) {
          return setError('Bitte eine gültige Telefonnummer eingeben');
        }

        setError(null);
        setLoading(true);
        try {
          if (currentMethod === 'email') {
            const success = await sendPasswordResetCode(identifier);
            if (success) {
              setResetStage('code');
            }
          } else {
            await new Promise((resolve) => setTimeout(resolve, 800));
            setResetStage('code');
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Fehler beim Versenden des Codes';
          setError(msg);
        } finally {
          setLoading(false);
        }
        return;
      }

      if (resetStage === 'code') {
        if (!verificationCode.trim()) {
          return setError('Bitte den Bestätigungscode eingeben');
        }
        if (verificationCode.length !== 6) {
          return setError('Der Code muss 6 Zeichen lang sein');
        }

        setError(null);
        setLoading(true);
        try {
          await new Promise((resolve) => setTimeout(resolve, 800));
          setResetStage('password');
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Ungültiger oder abgelaufener Code';
          setError(msg);
        } finally {
          setLoading(false);
        }
        return;
      }

      if (resetStage === 'password') {
        if (!newPassword.trim()) {
          return setError('Bitte neues Passwort eingeben');
        }
        if (newPassword.length < 6) {
          return setError('Das Passwort muss mindestens 6 Zeichen lang sein');
        }
        if (newPassword !== newPasswordConfirm) {
          return setError('Die Passwörter stimmen nicht überein');
        }

        setError(null);
        setLoading(true);
        try {
          await new Promise((resolve) => setTimeout(resolve, 800));
          resetZurueck();
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Fehler beim Zurücksetzen des Passworts';
          setError(msg);
        } finally {
          setLoading(false);
        }
        return;
      }
    }

    const identifier = currentMethod === 'phone' ? phone : email;
    if (!identifier.trim()) {
      return setError(currentMethod === 'phone' ? 'Bitte Telefonnummer eingeben' : 'Bitte E-Mail-Adresse eingeben');
    }
    if (currentMethod === 'email' && !identifier.includes('@')) {
      return setError('Bitte eine gültige E-Mail-Adresse eingeben');
    }
    if (currentMethod === 'phone' && !/^\+?[0-9\s\-()]{9,}$/.test(identifier)) {
      return setError('Bitte eine gültige Telefonnummer eingeben');
    }
    if (password.length < 6) return setError('Das Passwort braucht mindestens 6 Zeichen');

    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(identifier.trim(), password);
      } else {
        await kontoHinzufuegen(identifier.trim(), password);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Fehler bei der Authentifizierung';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetZurueck = () => {
    setMode('login');
    setResetStage('email');
    setEmail('');
    setPhone('');
    setVerificationCode('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setError(null);
  };

  const chooseMethod = (method: 'email' | 'phone' | 'google' | 'apple') => {
    setCurrentMethod(method);
    if (method === 'google' || method === 'apple') {
      handleSocialLogin(method);
    } else {
      setScreen('auth');
    }
  };

  const backToChoose = () => {
    setScreen('choose');
    setMode('login');
    setError(null);
  };

  if (screen === 'choose') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LinearGradient
            colors={brandGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.brandMark}
          >
            <Ionicons name="chatbubbles" size={34} color={colors.white} />
          </LinearGradient>
          {onBack && (
            <Druck
              style={styles.backButton}
              onPress={onBack}
              hitSlop={10}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Druck>
          )}

          <Text style={styles.title}>All Media</Text>
          <Text style={styles.subtitle}>Wie möchtest du dich anmelden?</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.methodsContainer}>
            <Druck style={[styles.methodButton, { backgroundColor: colors.surface2 }]} onPress={() => chooseMethod('email')} disabled={loading}>
              <Ionicons name="mail-outline" size={20} color={colors.brand} />
              <Text style={styles.methodButtonText}>E-Mail</Text>
            </Druck>

            <Druck style={[styles.methodButton, { backgroundColor: colors.surface2 }]} onPress={() => chooseMethod('phone')} disabled={loading}>
              <Ionicons name="call-outline" size={20} color={colors.brand} />
              <Text style={styles.methodButtonText}>Telefon</Text>
            </Druck>

            <Druck style={[styles.methodButton, { backgroundColor: colors.surface2 }]} onPress={() => chooseMethod('google')} disabled={loading}>
              <Ionicons name="logo-google" size={20} color={colors.text} />
              <Text style={styles.methodButtonText}>Google</Text>
            </Druck>

            <Druck style={[styles.methodButton, { backgroundColor: colors.surface2 }]} onPress={() => chooseMethod('apple')} disabled={loading}>
              <Ionicons name="logo-apple" size={20} color={colors.text} />
              <Text style={styles.methodButtonText}>Apple</Text>
            </Druck>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
          <Druck
            style={styles.backButton}
            onPress={backToChoose}
            hitSlop={10}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Druck>

          <Text style={styles.title}>All Media</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Willkommen zurück' : mode === 'register' ? 'Konto erstellen' : 'Passwort zurücksetzen'}
          </Text>

          {currentMethod === 'email' ? (
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
                editable={!loading && (mode !== 'reset' || resetStage === 'email')}
              />
            </View>
          ) : currentMethod === 'phone' ? (
            <View style={styles.field}>
              <Ionicons name="call-outline" size={19} color={colors.text3} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+49 123 456789"
                placeholderTextColor={colors.text3}
                autoCapitalize="none"
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>
          ) : (
            <View style={styles.socialLoginContainer}>
              <Text style={styles.socialLoginLabel}>Wird mit {currentMethod === 'google' ? 'Google' : 'Apple'} verbunden...</Text>
            </View>
          )}

          {mode !== 'reset' && (currentMethod === 'email' || currentMethod === 'phone') && (
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
                editable={!loading}
              />
              <Druck onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={19}
                  color={colors.text3}
                />
              </Druck>
            </View>
          )}

          {mode === 'reset' && resetStage === 'code' && (
            <View style={styles.field}>
              <Ionicons name="key-outline" size={19} color={colors.text3} />
              <TextInput
                style={styles.input}
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="Bestätigungscode (6 Zeichen)"
                placeholderTextColor={colors.text3}
                autoCapitalize="none"
                editable={!loading}
                maxLength={6}
              />
            </View>
          )}

          {mode === 'reset' && resetStage === 'password' && (
            <>
              <View style={styles.field}>
                <Ionicons name="lock-closed-outline" size={19} color={colors.text3} />
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Neues Passwort"
                  placeholderTextColor={colors.text3}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <Druck onPress={() => setShowNewPassword((v) => !v)} hitSlop={8}>
                  <Ionicons
                    name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={19}
                    color={colors.text3}
                  />
                </Druck>
              </View>
              <View style={styles.field}>
                <Ionicons name="lock-closed-outline" size={19} color={colors.text3} />
                <TextInput
                  style={styles.input}
                  value={newPasswordConfirm}
                  onChangeText={setNewPasswordConfirm}
                  placeholder="Passwort bestätigen"
                  placeholderTextColor={colors.text3}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {mode === 'reset' && resetStage === 'code' && (
            <View style={styles.infoBox}>
              <Ionicons name="mail-outline" size={24} color={colors.brand} />
              <Text style={styles.infoTitle}>Code versendet!</Text>
              <Text style={styles.infoText}>
                Wir haben einen 6-stelligen Code an{'\n'}<Text style={styles.emailHighlight}>{email}</Text>{'\n'}gesendet.
              </Text>
              <Text style={styles.infoSmall}>Gebe den Code unten ein, um dein Passwort zurückzusetzen.</Text>
              <Text style={styles.spamHint}>Falls du keine E-Mail erhältst, schau im Spam-Ordner nach.</Text>
            </View>
          )}

          {mode === 'reset' && resetStage === 'password' && (
            <View style={styles.infoBox}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text style={styles.infoTitle}>Code bestätigt!</Text>
              <Text style={styles.infoText}>Lege jetzt dein neues Passwort fest.</Text>
            </View>
          )}

          {(currentMethod === 'google' || currentMethod === 'apple') && mode === 'login' ? (
            <Druck
              style={styles.buttonWrap}
              onPress={() => handleSocialLogin(currentMethod as any)}
              disabled={loading}
            >
              <LinearGradient
                colors={currentMethod === 'google' ? ['#EA4335', '#FBBC04'] : [colors.text, colors.text]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.button, loading && { opacity: 0.6 }]}
              >
                <Ionicons
                  name={currentMethod === 'google' ? 'logo-google' : 'logo-apple'}
                  size={20}
                  color={colors.white}
                  style={{ marginRight: spacing.sm }}
                />
                <Text style={styles.buttonText}>
                  {loading ? 'Wird verbunden...' : `Mit ${currentMethod.charAt(0).toUpperCase() + currentMethod.slice(1)} anmelden`}
                </Text>
              </LinearGradient>
            </Druck>
          ) : (
            <Druck style={styles.buttonWrap} onPress={submit} disabled={loading}>
              <LinearGradient
                colors={brandGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.button, loading && { opacity: 0.6 }]}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Wird verarbeitet...' : mode === 'reset'
                    ? resetStage === 'email'
                      ? 'Code senden'
                      : resetStage === 'code'
                      ? 'Code bestätigen'
                      : 'Passwort zurücksetzen'
                    : (mode === 'login' ? 'Anmelden' : 'Registrieren')}
                </Text>
              </LinearGradient>
            </Druck>
          )}

          {mode === 'login' && (
            <Druck
              style={styles.forgotPassword}
              onPress={() => {
                setMode('reset');
                setResetStage('email');
                setPassword('');
                setError(null);
              }}
            >
              <Text style={styles.forgotPasswordText}>Passwort vergessen?</Text>
            </Druck>
          )}

          {mode !== 'reset' && (
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
          )}

          {mode === 'reset' && (
            <Druck style={styles.switch} onPress={resetZurueck}>
              <Text style={styles.switchText}>← Zurück zur Anmeldung</Text>
            </Druck>
          )}

          <Text style={styles.hint}>
            Testzugang: beliebige E-Mail mit @ und ein Passwort mit 6 Zeichen
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = themenStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },

  backButton: { marginBottom: spacing.md },

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

  spamHint: { textAlign: 'center', color: colors.text2, ...typography.small, marginTop: spacing.sm },

  error: { color: colors.danger, ...typography.preview },

  buttonWrap: { marginTop: spacing.sm, borderRadius: radius.soft, ...shadow.brand },
  button: {
    height: 52,
    borderRadius: radius.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.white, ...typography.h3, fontSize: 16 },

  methodsContainer: { flexDirection: 'column', gap: spacing.md, marginVertical: spacing.lg },
  methodButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.soft,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  methodButtonText: { color: colors.text, ...typography.body, fontSize: 14 },

  forgotPassword: { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.sm },
  forgotPasswordText: { color: colors.brand, ...typography.body },

  infoBox: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.soft,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: colors.brand,
    marginVertical: spacing.md,
  },
  infoTitle: { color: colors.brand, fontSize: 18, fontWeight: '600' },
  infoText: { textAlign: 'center', color: colors.text, ...typography.body },
  emailHighlight: { fontWeight: '600', color: colors.brand },
  infoSmall: { textAlign: 'center', color: colors.text2, ...typography.small },

  successBox: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.soft,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderWidth: 1,
    borderColor: colors.success,
    marginVertical: spacing.md,
  },
  successTitle: { color: colors.success, fontSize: 18, fontWeight: '600' },
  successText: { textAlign: 'center', color: colors.text, ...typography.body },
  successSmall: { textAlign: 'center', color: colors.text2, ...typography.small },

  socialLoginContainer: {
    padding: spacing.lg,
    borderRadius: radius.soft,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  socialLoginLabel: { color: colors.text2, ...typography.body },

  switch: { alignItems: 'center', paddingVertical: spacing.md },
  switchText: { color: colors.brand, ...typography.body },

  hint: { textAlign: 'center', color: colors.text3, ...typography.small },
}));
