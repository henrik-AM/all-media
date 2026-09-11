import React, { useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Druck } from './Druck';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';

/*
 * Den QR-Code einer anderen Person lesen.
 *
 * Henrik am 07.09.2026: „Kontakt hinzufügen nur über Telefonnummer/QR-Code,
 * nicht Username." Das Gegenstueck zu `QrCode`, der den eigenen zeigt.
 *
 * WAS EXPO-CAMERA HIER TUT
 *
 * `CameraView` liest QR-Codes selbst; ein eigener Decoder waere ueberfluessig.
 * `barcodeTypes: ['qr']` schraenkt das absichtlich ein — ohne die Angabe
 * meldet die Kamera auch Strichcodes von Lebensmittelverpackungen, und ein
 * Strichcode ist keine Telefonnummer.
 *
 * WARUM EIN SPERRE-MERKER
 *
 * `onBarcodeScanned` feuert mehrmals pro Sekunde, solange der Code im Bild
 * ist. Ohne `gelesen` liefe die Suche nach demselben Kontakt zwanzig Mal
 * gleichzeitig. Der Merker ist ein `useRef` und kein `useState`: er muss
 * schon beim naechsten Bild gesetzt sein, nicht erst nach dem naechsten
 * Zeichnen.
 *
 * Gegenstueck im Browser: `qrScannerOeffnen` in web/public/app.js. Dort
 * rechnet jsQR das Bild aus — `BarcodeDetector` koennte das ohne
 * Bibliothek, kennt aber nur Chrome, und die Website wird auf dem iPhone
 * benutzt.
 */

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Der rohe Inhalt des Codes — was daraus wird, entscheidet der Aufrufer. */
  onCode: (text: string) => void;
}

export const QrScanner = ({ visible, onClose, onCode }: Props) => {
  const [erlaubnis, erlaubnisFragen] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const gelesen = useRef(false);
  const [zeigeHinweis, setZeigeHinweis] = useState(false);

  const schliessen = () => {
    gelesen.current = false;
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={schliessen}
      onShow={() => {
        gelesen.current = false;
        setZeigeHinweis(false);
      }}
    >
      <View style={styles.fill}>
        {/*
          Die Erlaubnis wird erst gefragt, wenn der Scanner wirklich aufgeht —
          nicht beim Start der App. Wer nie einen Code scannt, wird auch nie
          nach der Kamera gefragt.
        */}
        {!erlaubnis ? null : !erlaubnis.granted ? (
          <View style={styles.mitte}>
            <Ionicons name="camera-outline" size={40} color={colors.text3} />
            <Text style={styles.hinweis}>
              {erlaubnis.canAskAgain
                ? 'Zum Scannen braucht All Media die Kamera.'
                : 'Die Kamera ist für All Media gesperrt. Das lässt sich in den Einstellungen des Geräts ändern.'}
            </Text>
            {erlaubnis.canAskAgain ? (
              <Druck style={styles.knopf} onPress={erlaubnisFragen}>
                <Text style={styles.knopfText}>Kamera erlauben</Text>
              </Druck>
            ) : null}
          </View>
        ) : (
          <CameraView
            style={styles.fill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (gelesen.current) return;
              gelesen.current = true;
              setZeigeHinweis(true);
              onCode(data);
            }}
          />
        )}

        {/* Der Rahmen zeigt, wohin der Code gehalten werden soll. */}
        <View pointerEvents="none" style={styles.zielRahmen} />

        <Text style={[styles.titel, { top: insets.top + spacing.xl }]}>
          {zeigeHinweis ? 'Code gelesen' : 'QR-Code der anderen Person scannen'}
        </Text>

        <Druck style={[styles.zu, { top: insets.top + spacing.sm }]} onPress={schliessen}>
          <Ionicons name="close" size={24} color={colors.white} />
        </Druck>
      </View>
    </Modal>
  );
};

const styles = themenStyles((colors) => ({
  fill: { flex: 1, backgroundColor: '#000' },
  mitte: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  hinweis: { color: colors.white, textAlign: 'center', ...typography.body },
  knopf: {
    height: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knopfText: { color: colors.white, ...typography.h3 },
  zielRahmen: {
    position: 'absolute',
    left: '15%',
    right: '15%',
    top: '30%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 16,
  },
  titel: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: colors.white,
    ...typography.h3,
  },
  zu: {
    position: 'absolute',
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
}));
