import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radius, typography } from '../../constants/design';
import { mockCurrentUser } from '../../mocks';

export const ProfileScreenComponent = () => {
  const user = mockCurrentUser.profile;

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.largeAvatar}>
          <Text style={styles.largeAvatarText}>👤</Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userHandle}>{user.handle}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>● Online</Text>
        </View>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Einstellungen</Text>
        
        <SettingRow icon="🔔" label="Benachrichtigungen" value="An" />
        <SettingRow icon="🔒" label="Privatsphäre" value="Freunde" />
        <SettingRow icon="🌙" label="Dunkelmodus" value="Auto" />
        <SettingRow icon="💬" label="Chat-Hintergrund" value="Weiß" />
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Konto</Text>
        <SettingRow icon="👤" label="Profil bearbeiten" />
        <SettingRow icon="🔐" label="Passwort ändern" />
        <SettingRow icon="📱" label="Telefonnummer" />
        <SettingRow icon="📧" label="E-Mail" />
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton}>
        <Text style={styles.logoutText}>Abmelden</Text>
      </TouchableOpacity>

      <View style={styles.spacer} />
    </ScrollView>
  );
};

const SettingRow = ({ icon, label, value }: { icon: string; label: string; value?: string }) => (
  <TouchableOpacity style={styles.settingRow}>
    <Text style={styles.icon}>{icon}</Text>
    <Text style={styles.label}>{label}</Text>
    {value && <Text style={styles.value}>{value}</Text>}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  largeAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  largeAvatarText: {
    fontSize: 40,
  },
  userName: {
    fontSize: typography.h2.fontSize,
    fontWeight: '700',
    color: colors.darkGray,
  },
  userHandle: {
    fontSize: typography.small.fontSize,
    color: colors.mediumGray,
    marginTop: spacing.xs,
  },
  statusBadge: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.lightGray,
    borderRadius: 20,
  },
  statusText: {
    fontSize: typography.small.fontSize,
    color: colors.darkGray,
  },
  section: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  sectionTitle: {
    fontSize: typography.small.fontSize,
    fontWeight: '600',
    color: colors.mediumGray,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  settingRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    fontSize: 20,
  },
  label: {
    flex: 1,
    fontSize: typography.body.fontSize,
    color: colors.darkGray,
    fontWeight: '500',
  },
  value: {
    fontSize: typography.small.fontSize,
    color: colors.mediumGray,
  },
  logoutButton: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.like,
    borderRadius: radius.small,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.white,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  spacer: {
    height: spacing.xl,
  },
});
