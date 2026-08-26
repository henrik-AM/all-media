import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { brandGradient, colors, sizes, spacing, storyGradient, typography } from '../constants/design';
import { mockUsers } from '../mocks';
import { Story } from '../types';

interface Props {
  stories: Story[];
  onPress: (story: Story) => void;
}

const RING = sizes.storyRing;

/**
 * Story-Leiste. Der Ring ist ein Verlauf, kein einfarbiger Rand — das ist der
 * eine Punkt, an dem eine Story-Leiste hochwertig oder selbstgebaut aussieht.
 * Gesehene Stories bekommen einen sehr feinen grauen Ring statt gar keinem,
 * damit die Reihe optisch nicht auseinanderfällt.
 */
export const StoryRail = ({ stories, onPress }: Props) => (
  <View style={styles.railWrap}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {stories.map((story) => {
        const inner = RING - 7;
        /*
         * story.name ist der kurze Name UNTER dem Ring ("Anna", "Deine
         * Story"). Die Initialen im Kreis gehören aber zur Person, sonst
         * stand dort "A" statt "AS" und bei der eigenen Story "DS" statt
         * "DU" — in der Chatliste direkt darunter steht es richtig, also
         * fiel der Unterschied sofort auf.
         */
        const person = mockUsers[story.userId];
        const vollerName = person?.name ?? story.name;
        return (
          <Druck
            key={story.id}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() => onPress(story)}
          >
            {story.viewed ? (
              <View style={[styles.ring, styles.ringViewed]}>
                <View style={styles.inner}>
                  <Avatar id={story.userId} name={vollerName} size={inner - 4} />
                </View>
              </View>
            ) : (
              <LinearGradient
                colors={storyGradient}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.ring}
              >
                <View style={styles.inner}>
                  <Avatar id={story.userId} name={vollerName} size={inner - 4} />
                </View>
              </LinearGradient>
            )}

            {/* Solange die eigene Story leer ist, lädt das Plus zur Aufnahme
                ein. Ist sie gefüllt, verhält sie sich wie jede andere. */}
            {story.own && !story.mediaUri && (
              <LinearGradient
                colors={brandGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addBadge}
              >
                <Ionicons name="add" size={14} color={colors.white} />
              </LinearGradient>
            )}

            <Text style={[styles.name, story.own && styles.nameOwn]} numberOfLines={1}>
              {story.name}
            </Text>
          </Druck>
        );
      })}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  railWrap: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  rail: {
    gap: 15,
    paddingHorizontal: spacing.lg,
    paddingTop: 13,
    paddingBottom: 12,
  },
  item: {
    width: RING,
    alignItems: 'center',
  },
  itemPressed: { opacity: 0.62 },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringViewed: {
    backgroundColor: colors.border,
  },
  /* Der weiße Spalt zwischen Ring und Bild — ohne ihn klebt der Verlauf am
     Gesicht und der Ring wirkt wie ein Rahmen statt wie ein Signal. */
  inner: {
    width: RING - 5,
    height: RING - 5,
    borderRadius: (RING - 5) / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBadge: {
    position: 'absolute',
    right: -1,
    top: RING - 21,
    width: 21,
    height: 21,
    borderRadius: 10.5,
    borderWidth: 2.5,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Breiter als der Ring — sonst wird „Deine Story" auf „Deine Sto…" gekürzt. */
  name: {
    width: 72,
    marginHorizontal: -4,
    textAlign: 'center',
    marginTop: 7,
    color: colors.text2,
    ...typography.small,
    fontSize: 11.5,
    letterSpacing: -0.1,
  },
  nameOwn: { color: colors.text, fontWeight: '600' },
});
