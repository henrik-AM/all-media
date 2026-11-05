import React from 'react';
import { Linking, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from './Druck';
import { KarteWeb } from './KarteWeb';
import { SheetRahmen } from './SheetRahmen';
import { radius, spacing, themenStyles, typography } from '../constants/design';

const OrtSuche = require('../../gemeinsam/ortsuche') as typeof import('../../gemeinsam/ortsuche');

interface Props {
  ort: { name: string; adresse?: string; lat: number; lng: number } | null;
  onClose: () => void;
}

/**
 * Ein gesendeter, frei gewaehlter Ort (Kasten 28/6.5) — antippen der Karte
 * in der Blase. Ein Ort aus `places` oeffnet weiter seine Standortseite im
 * Explorer; ein frei gewaehlter hat keine, darum hier die Karte mit Nadel und
 * der Weg in OpenStreetMap. Gleiches Blatt auf der Website:
 * openStandortAnsicht() in web/public/app.js.
 */
export const StandortAnsicht = ({ ort, onClose }: Props) => (
  <SheetRahmen visible={!!ort} title={ort?.name ?? 'Standort'} onClose={onClose} hoch>
    {ort ? (
      <View style={styles.huelle}>
        <KarteWeb
          pins={[{ id: 'ort', name: ort.name, lat: ort.lat, lng: ort.lng, farbe: '#E5484D' }]}
          aktiv="ort"
          start={{ lat: ort.lat, lng: ort.lng, zoom: 16 }}
          hoehe={320}
        />
        {ort.adresse ? <Text style={styles.adresse}>{ort.adresse}</Text> : null}
        <Text style={styles.koordinaten}>{OrtSuche.koordinatenText(ort.lat, ort.lng)}</Text>
        <Druck
          style={styles.knopf}
          onPress={() => void Linking.openURL(OrtSuche.kartenLink(ort.lat, ort.lng))}
          accessibilityLabel="In OpenStreetMap öffnen"
        >
          <Ionicons name="open-outline" size={17} color="#FFFFFF" />
          <Text style={styles.knopfText}>In OpenStreetMap öffnen</Text>
        </Druck>
      </View>
    ) : null}
  </SheetRahmen>
);

const styles = themenStyles((colors) => ({
  huelle: { gap: spacing.sm, paddingBottom: spacing.lg },
  adresse: { ...typography.body, color: colors.text, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  koordinaten: { ...typography.small, color: colors.text2, paddingHorizontal: spacing.lg },
  knopf: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  knopfText: { ...typography.name, color: '#FFFFFF' },
}));
