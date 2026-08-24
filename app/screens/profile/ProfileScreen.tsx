import React, { useContext, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { AuthContext } from '../../contexts/AuthContext';
import { colors, radius, sizes, spacing, typography } from '../../constants/design';
import { mockUsers } from '../../mocks';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface RowProps {
  icon: IconName;
  label: string;
  value?: string;
  danger?: boolean;
  onPress?: () => void;
  right?: React.ReactNode;
}

const Row = ({ icon, label, value, danger, onPress, right }: RowProps) => (
  <Pressable
    style={({ pressed }) => [styles.item, pressed && onPress && styles.itemPressed]}
    onPress={onPress}
    disabled={!onPress}
  >
    <View style={[styles.itemIcon, danger && styles.itemIconDanger]}>
      <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.text2} />
    </View>
    <Text style={[styles.itemLabel, danger && styles.itemLabelDanger]}>{label}</Text>
    {value ? <Text style={styles.itemValue}>{value}</Text> : null}
    {right ?? (onPress && !danger ? <Ionicons name="chevron-forward" size={18} color={colors.text3} /> : null)}
  </Pressable>
);

interface Props {
  onNotice?: (message: string) => void;
}

export const ProfileScreen = ({ onNotice }: Props) => {
  const auth = useContext(AuthContext);
  const [darkMode, setDarkMode] = useState(false);
  const me = mockUsers.me;

  const notice = (message: string) => onNotice?.(message);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.head}>
        <Avatar id={me.id} name={me.name} size={sizes.avatarXl} />
        <Text style={styles.name}>{me.name}</Text>
        <Text style={styles.sub}>
          {me.handle} · {me.about}
        </Text>
      </View>

      <View style={styles.group}>
        <Row icon="create-outline" label="Profil bearbeiten" onPress={() => notice('Profil bearbeiten folgt in Phase 3')} />
        <Row icon="notifications-outline" label="Benachrichtigungen" onPress={() => notice('Benachrichtigungen folgen in Phase 3')} />
        <Row icon="lock-closed-outline" label="Privatsphäre" onPress={() => notice('Privatsphäre folgt in Phase 3')} />
        <Row
          icon="moon-outline"
          label="Dunkles Design"
          right={
            <Switch
              value={darkMode}
              onValueChange={(next) => {
                setDarkMode(next);
                notice(next ? 'Dunkles Design aktiviert' : 'Helles Design aktiviert');
              }}
              trackColor={{ false: colors.surface3, true: colors.brand }}
            />
          }
        />
      </View>

      <View style={styles.group}>
        <Row icon="image-outline" label="Speicher & Daten" value="1,2 GB" onPress={() => notice('Speicherverwaltung folgt in Phase 3')} />
        <Row icon="information-circle-outline" label="Über All Media" value="1.0.0" onPress={() => notice('All Media 1.0.0')} />
        <Row icon="log-out-outline" label="Abmelden" danger onPress={() => auth?.logout?.()} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  head: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { marginTop: 4, color: colors.text, ...typography.h2 },
  sub: { color: colors.text2, ...typography.preview },

  group: { marginTop: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemPressed: { backgroundColor: colors.surface2 },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconDanger: { backgroundColor: colors.dangerSoft },
  itemLabel: { flex: 1, color: colors.text, ...typography.body },
  itemLabelDanger: { color: colors.danger },
  itemValue: { color: colors.text3, ...typography.preview },
});
