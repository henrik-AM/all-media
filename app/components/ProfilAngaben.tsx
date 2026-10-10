import React, { useState } from 'react';
import { StyleProp, Text, TextStyle, View } from 'react-native';
import { Druck } from './Druck';
import { ActionSheet } from './ActionSheet';
import { oeffneLink } from '../lib/links';
import { themenStyles, typography } from '../constants/design';

// Dieselbe Regel und dieselben Texte wie auf der Website (profilLinksHtml).
const Profilfelder = require('../../gemeinsam/profilfelder') as typeof import('../../gemeinsam/profilfelder');

type Link = { url: string; titel: string };

/**
 * Name mit Pronomen klein daneben (Kasten 1.3e).
 *
 * In allen Profilköpfen gleich — Videos, Communitys, Messenger, fremdes
 * Profil, Kontaktprofil. Gegenstück: nameMitPronomen() in web/public/app.js.
 */
export const NameMitPronomen = ({
  name,
  pronomen,
  style,
  zentriert,
}: {
  name: string;
  pronomen?: string;
  style?: StyleProp<TextStyle>;
  zentriert?: boolean;
}) => (
  <Text style={[style, zentriert && { textAlign: 'center' }]} numberOfLines={2} testID="profil-name">
    {name}
    {!!pronomen?.trim() && (
      <Text style={styles.pronomen} testID="profil-pronomen">
        {'  '}
        {pronomen.trim()}
      </Text>
    )}
  </Text>
);

/**
 * Die Links eines Profils (Kasten 1.3g): der erste sichtbar, bei mehreren
 * „und N weitere“ → Liste aller Links. Gegenstück: profilLinksHtml() in
 * web/public/app.js.
 */
export const ProfilLinks = ({
  links,
  onNotice,
  zentriert,
}: {
  links: Link[] | undefined;
  onNotice: (text: string) => void;
  zentriert?: boolean;
}) => {
  const [liste, setListe] = useState(false);
  const alle = (links ?? []).filter((l) => l.url);
  if (!alle.length) return null;
  const weitere = Profilfelder.weitereText(alle.length);
  return (
    <View style={[styles.zeile, zentriert && { justifyContent: 'center' }]}>
      <Druck
        onPress={() => oeffneLink(Profilfelder.linkZiel(alle[0]), onNotice)}
        accessibilityRole="link"
        accessibilityLabel={`Link öffnen: ${Profilfelder.linkText(alle[0])}`}
        testID="profil-link"
      >
        <Text style={styles.link} numberOfLines={1}>
          {Profilfelder.linkText(alle[0])}
        </Text>
      </Druck>
      {!!weitere && (
        <Druck
          onPress={() => setListe(true)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Alle Links: ${weitere}`}
          testID="profil-links-weitere"
        >
          <Text style={styles.weitere}>{weitere}</Text>
        </Druck>
      )}
      <ActionSheet
        visible={liste}
        title={Profilfelder.TEXTE.linksTitel}
        items={alle.map((l, i) => ({ key: String(i), label: Profilfelder.linkText(l), icon: 'link-outline' as const }))}
        onSelect={(key) => {
          setListe(false);
          void oeffneLink(Profilfelder.linkZiel(alle[Number(key)]), onNotice);
        }}
        onClose={() => setListe(false)}
      />
    </View>
  );
};

const styles = themenStyles((colors) => ({
  pronomen: { ...typography.small, fontWeight: '400', color: colors.text2 },
  zeile: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  link: { ...typography.message, color: colors.brand, fontWeight: '600' },
  weitere: { ...typography.message, color: colors.text2 },
}));

