import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { avatarColor, colors, radius, spacing, typography } from '../../constants/design';
import { mockFriendPins, mockUsers } from '../../mocks';

interface Props {
  onOpenProfile: (userId: string) => void;
}

/** Prototyp-Frame "Messenger - Friend-Map": Karte plus Liste darunter. */
export const FriendMapScreen = ({ onOpenProfile }: Props) => (
  <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.map}>
      {mockFriendPins.map((pin) => {
        const person = mockUsers[pin.id];
        return (
          <Pressable
            key={pin.id}
            style={[styles.pin, { left: `${pin.x}%`, top: `${pin.y}%` }]}
            onPress={() => onOpenProfile(pin.id)}
          >
            <View style={[styles.dot, { backgroundColor: avatarColor(pin.id) }]}>
              <Text style={styles.dotText}>{person.name.slice(0, 2).toUpperCase()}</Text>
            </View>
            <Text style={styles.pinLabel}>{person.name.split(' ')[0]}</Text>
          </Pressable>
        );
      })}
      <View style={styles.me} />
    </View>

    <Text style={styles.listHead}>IN DEINER NÄHE</Text>
    {mockFriendPins.map((pin) => {
      const person = mockUsers[pin.id];
      return (
        <Pressable key={pin.id} style={styles.row} onPress={() => onOpenProfile(pin.id)}>
          <Avatar id={pin.id} name={person.name} size={44} />
          <View style={styles.rowBody}>
            <Text style={styles.rowName}>{person.name}</Text>
            <Text style={styles.rowSub}>
              {pin.place} · {pin.when}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text3} />
        </Pressable>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: spacing.xl },
  title: { ...typography.title, color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  map: {
    height: 320,
    margin: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pin: { position: 'absolute', alignItems: 'center', gap: 3, marginLeft: -19, marginTop: -44 },
  dot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: colors.surface,
  },
  dotText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  pinLabel: {
    ...typography.small,
    color: colors.text,
    backgroundColor: colors.surface,
    paddingHorizontal: 7,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  me: {
    position: 'absolute',
    left: '50%',
    top: '46%',
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    marginTop: -9,
    backgroundColor: colors.brand,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  listHead: {
    ...typography.overline,
    color: colors.text3,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
  },
  rowBody: { flex: 1 },
  rowName: { ...typography.name, color: colors.text },
  rowSub: { ...typography.preview, color: colors.text2, marginTop: 2 },
});
