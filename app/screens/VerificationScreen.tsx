import React, { useEffect, useState } from 'react';
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
import { brandGradient, colors, radius, shadow, spacing, themenStyles, typography } from '../constants/design';

interface Props {
  identifier: string; // E-Mail oder Telefonnummer
  method: 'email' | 'phone';
  onVerified: () => void;
  onCancel: () => void;
}

export const VerificationScreen = ({ identifier, method, onVerified, onCancel }: Props) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const submit = async () => {
    if (code.length < 6) return setError('Bitte einen 6-stelligen Code eingeben');

    setError(null);
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      // Hier würde die Verifizierung mit dem Backend stattfinden
      onVerified();
    } catch (e) {
      setError('Ungültiger Code. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (resendTimer > 0) return;

    setError(null);
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setResendTimer(60);
    } catch (e) {
      setError('Fehler beim Neusenden. Bitte versuche es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Druck style={styles.backButton} onPress={onCancel} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Druck>

          <LinearGradient
            colors={brandGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.brandMark}
          >
            <Ionicons
              name={method === 'email' ? 'mail-outline' : 'call-outline'}
              size={34}
              color={colors.white}
            />
          </LinearGradient>

          <Text style={styles.title}>Bestätige dein Konto</Text>
          <Text style={styles.subtitle}>
            Wir haben einen Verifizierungscode an{'\n'}
            <Text style={styles.identifier}>{identifier}</Text>
            {'\n'}gesendet.
          </Text>

          <View style={styles.codeInputContainer}>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(text) => {
                setCode(text.replace(/[^0-9]/g, '').slice(0, 6));
                setError(null);
              }}
              placeholder="000000"
              placeholderTextColor={colors.text3}
              keyboardType="number-pad"
              maxLength={6}
              editable={!loading}
            />
            <View style={styles.codeDisplay}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.codeBubble,
                    code.length > i && styles.codeBubbleFilled,
                  ]}
                >
                  <Text style={styles.codeBubbleText}>{code[i] || ''}</Text>
                </View>
              ))}
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Druck style={styles.buttonWrap} onPress={submit} disabled={loading || code.length < 6}>
            <LinearGradient
              colors={brandGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.button,
                (loading || code.length < 6) && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Wird überprüft...' : 'Code bestätigen'}
              </Text>
            </LinearGradient>
          </Druck>

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Hast du den Code nicht erhalten?{' '}</Text>
            <Druck
              onPress={resendCode}
              disabled={resendTimer > 0 || loading}
            >
              <Text style={[styles.resendLink, resendTimer > 0 && styles.resendLinkDisabled]}>
                {resendTimer > 0 ? `In ${resendTimer}s erneut senden` : 'Erneut senden'}
              </Text>
            </Druck>
          </View>
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
  title: { textAlign: 'center', color: colors.text, ...typography.title, fontSize: 28 },
  subtitle: { textAlign: 'center', marginBottom: spacing.lg, color: colors.text2, ...typography.body },
  identifier: { fontWeight: '600', color: colors.brand },

  codeInputContainer: { position: 'relative', marginVertical: spacing.lg },
  codeInput: {
    position: 'absolute',
    width: '100%',
    height: 1,
    opacity: 0,
  },
  codeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  codeBubble: {
    flex: 1,
    height: 56,
    borderRadius: radius.soft,
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBubbleFilled: {
    borderColor: colors.brand,
    backgroundColor: `${colors.brand}15`,
  },
  codeBubbleText: { fontSize: 20, fontWeight: '600', color: colors.text },

  error: { color: colors.danger, ...typography.preview, textAlign: 'center' },

  buttonWrap: { marginTop: spacing.sm, borderRadius: radius.soft, ...shadow.brand },
  button: {
    height: 52,
    borderRadius: radius.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.white, ...typography.h3, fontSize: 16 },

  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    gap: 4,
  },
  resendText: { color: colors.text2, ...typography.body },
  resendLink: { color: colors.brand, fontWeight: '600' },
  resendLinkDisabled: { color: colors.text3 },
}));
