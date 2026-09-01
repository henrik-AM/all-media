import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Motiv } from './Motiv';

/*
 * Die Fläche, in der ein Video wirklich läuft.
 *
 * Vorher gab es das nicht. Jeder Bildschirm zeigte ein Standbild, darüber
 * einen Wiedergabeknopf, und ein Zähler lief im Sekundentakt hoch —
 * unabhängig davon, ob überhaupt etwas abgespielt wurde. Es gab auch nichts
 * abzuspielen: die „Videos" in den Testdaten waren PNG-Dateien.
 *
 * Diese Komponente entscheidet an der Adresse, was zu tun ist:
 *
 *   - endet sie auf .mp4/.mov/.m4v/.webm → echtes Video, expo-video spielt es
 *   - sonst → das Standbild, und wenn es keines gibt, die Farbfläche aus
 *     Motiv
 *
 * Damit bleibt jeder Bildschirm unverändert benutzbar, auch wenn zu einem
 * Beitrag (noch) kein Video hinterlegt ist. Genau das ist der Normalfall bei
 * selbst aufgenommenen Bildern.
 *
 * WARUM expo-video UND NICHT expo-av
 * ----------------------------------
 * expo-av steht in package.json und bringt eine Video-Komponente mit — in
 * Expo Go (SDK 57) ist der native Teil davon aber nicht mehr enthalten. Ein
 * Import genügt, und die App startet gar nicht erst: „Cannot find native
 * module 'ExponentAV'", roter Bildschirm, nichts geht mehr. Aufgefallen ist
 * das erst im Simulator; die Typprüfung ist damit vollkommen zufrieden.
 * expo-video ist der Nachfolger und in Expo Go vorhanden.
 *
 * Die gleiche Entscheidung trifft die Website in web/public/app.js
 * (medienFlaeche) — beide Seiten müssen denselben Stand zeigen.
 */

export const istVideo = (adresse?: string) =>
  !!adresse && /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(adresse);

export interface VideoSteuerung {
  /** Auf eine Sekunde springen — für Kapitelmarken und die Fortschrittsleiste. */
  springen: (sekunde: number) => void;
  /** Abspielgeschwindigkeit, 1 ist normal. */
  tempo: (faktor: number) => void;
}

interface Props {
  /** Kennung des Beitrags — bestimmt die Ersatzfarbfläche. */
  id: string;
  /** Adresse des Videos oder des Bildes. */
  quelle?: string;
  /** Standbild, das vor dem ersten Bild und im Raster steht. */
  standbild?: string;
  /** Läuft gerade? Der Bildschirm behält die Hoheit über Start und Pause. */
  laeuft?: boolean;
  stumm?: boolean;
  schleife?: boolean;
  /** 'cover' füllt die Fläche, 'contain' zeigt das ganze Bild. */
  fuellen?: 'cover' | 'contain';
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconSize?: number;
  dunkel?: boolean;
  style?: ViewStyle;
  /** Meldet Stand und Gesamtlänge in Sekunden — für Zeit und Leiste. */
  onFortschritt?: (bei: number, gesamt: number) => void;
  /** Einmal am Ende, wenn nicht in Schleife gespielt wird. */
  onEnde?: () => void;
}

export const Videoflaeche = forwardRef<VideoSteuerung, Props>(function Videoflaeche(
  {
    id,
    quelle,
    standbild,
    laeuft = false,
    stumm = true,
    schleife = false,
    fuellen = 'cover',
    icon = 'play-outline',
    iconSize = 32,
    dunkel = false,
    style,
    onFortschritt,
    onEnde,
  },
  ref
) {
  const spielbar = istVideo(quelle);
  /*
   * Ein Video, das sich nicht laden lässt, darf nicht als schwarze Fläche
   * stehen bleiben. Dann tritt das Standbild an seine Stelle — sichtbar ist
   * dasselbe wie vorher, nur ohne Wiedergabe.
   */
  const [fehler, setFehler] = useState(false);

  /*
   * useVideoPlayer ist ein Hook und muss deshalb bei jedem Aufbau laufen,
   * auch wenn es gar kein Video gibt — sonst wechselt die Zahl der Hooks
   * zwischen zwei Durchläufen und React bricht ab. Ohne Quelle bekommt er
   * null; das ist ausdrücklich erlaubt.
   */
  const spieler = useVideoPlayer(spielbar ? quelle! : null, (p) => {
    p.loop = schleife;
    p.muted = stumm;
    p.timeUpdateEventInterval = 0.5;
  });

  useEventListener(spieler, 'timeUpdate', ({ currentTime }) => {
    onFortschritt?.(Math.floor(currentTime), Math.floor(spieler.duration || 0));
  });

  useEventListener(spieler, 'playToEnd', () => {
    if (!schleife) onEnde?.();
  });

  useEventListener(spieler, 'statusChange', ({ status, error }) => {
    if (status === 'error' || error) setFehler(true);
  });

  useEffect(() => { spieler.loop = schleife; }, [spieler, schleife]);
  useEffect(() => { spieler.muted = stumm; }, [spieler, stumm]);

  useEffect(() => {
    if (!spielbar || fehler) return;
    if (laeuft) spieler.play();
    else spieler.pause();
  }, [spieler, spielbar, fehler, laeuft]);

  useImperativeHandle(ref, () => ({
    springen: (sekunde) => { spieler.currentTime = Math.max(0, sekunde); },
    tempo: (faktor) => { spieler.playbackRate = faktor; },
  }), [spieler]);

  if (!spielbar || fehler) {
    return (
      <Motiv
        id={id}
        bild={standbild ?? quelle}
        icon={icon}
        iconSize={iconSize}
        dunkel={dunkel}
        style={style}
      />
    );
  }

  return (
    <View style={[styles.flaeche, style]}>
      <VideoView
        player={spieler}
        style={StyleSheet.absoluteFill}
        contentFit={fuellen}
        /* Die App hat ihre eigene Leiste; zwei übereinander sehen nach Fehler aus. */
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  flaeche: { overflow: 'hidden', backgroundColor: '#000' },
});
