import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Druck } from '../components/Druck';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { brandGradient, colors, radius, shadow, spacing, themenStyles, typography } from '../constants/design';

interface Props {
  onSelectMethod: (method: 'email' | 'phone' | 'google' | 'apple') => void;
}

export const AuthMethodScreen = ({ onSelectMethod }: Props) => {
  const methods = [
    {
      id: 'email',
      label: 'E-Mail',
      icon: 'mail-outline',
      description: 'Mit E-Mail-Adresse anmelden',
      color: colors.brand,
    },
    {
      id: 'phone',
      label: 'Telefonnummer',
      icon: 'call-outline',
      description: 'Mit Telefonnummer anmelden',
      color: '#3B82F6',
    },
    {
      id: 'google',
      label: 'Google',
      icon: 'logo-google',
      description: 'Schnell mit Google anmelden',
      color: '#EA4335',
    },
    {
      id: 'apple',
      label: 'Apple',
      icon: 'logo-apple',
      description: 'Schnell mit Apple anmelden',
      color: colors.text,
    },
  ];

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

        <Text style={styles.title}>All Media</Text>
        <Text style={styles.subtitle}>Wie möchtest du dich anmelden?</Text>

        <View style={styles.methodsContainer}>
          {methods.map((method) => (
            <Druck
              key={method.id}
              style={({ pressed }) => [styles.methodButton, pressed && styles.methodButtonPressed]}
              onPress={() => onSelectMethod(method.id as any)}
            >
              <View style={styles.methodContent}>
                <View style={[styles.methodIcon, { backgroundColor: `${method.color}20` }]}>
                  <Ionicons name={method.icon as any} size={24} color={method.color} />
                </View>
                <View style={styles.methodText}>
                  <Text style={styles.methodLabel}>{method.label}</Text>
                  <Text style={styles.methodDesc}>{method.description}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text3} />
            </Druck>
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.trustBox}>
          <Ionicons name="shield-checkmark" size={20} color={colors.success} />
          <Text style={styles.trustText}>Deine Daten sind sicher verschlüsselt und werden nicht mit Dritten geteilt.</Text>
        </View>

        <Text style={styles.hint}>
          Mit der Anmeldung akzeptierst du unsere{'\n'}
          <Text style={styles.link}>Nutzungsbedingungen</Text>
          {' '}und{' '}
          <Text style={styles.link}>Datenschutz</Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = themenStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
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

  methodsContainer: { gap: spacing.md, marginVertical: spacing.md },

  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.soft,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodButtonPressed: { backgroundColor: colors.surface3, borderColor: colors.brand },

  methodContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodText: { flex: 1 },
  methodLabel: { color: colors.text, fontWeight: '600', fontSize: 16 },
  methodDesc: { color: colors.text2, ...typography.small, marginTop: 2 },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },

  trustBox: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.soft,
    backgroundColor: `${colors.success}15`,
    borderWidth: 1,
    borderColor: `${colors.success}40`,
  },
  trustText: { flex: 1, color: colors.text2, ...typography.small, lineHeight: 20 },

  hint: { textAlign: 'center', color: colors.text3, ...typography.small, marginTop: spacing.lg },
  link: { color: colors.brand, fontWeight: '600' },
}));
