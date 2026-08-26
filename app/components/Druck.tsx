import React from 'react';
import { Pressable, PressableProps, StyleSheet } from 'react-native';

/**
 * Druckfläche mit Rückmeldung.
 *
 * `Pressable` aus React Native gibt von sich aus **keine** Rückmeldung — wer
 * nichts angibt, bekommt beim Drücken schlicht nichts. In dieser App war das
 * an 139 von 175 Stellen der Fall: man tippte, nichts passierte, und dann
 * wechselte der Bildschirm. Das ist der Unterschied zwischen „reagiert" und
 * „hängt", und er fällt nur beim Benutzen auf, nie im Screenshot.
 *
 * Diese Komponente ist ein Eins-zu-eins-Ersatz für `Pressable`: dieselben
 * Eigenschaften, nur mit einer Vorgabe fürs Drücken.
 *
 * Wichtig ist die Fallunterscheidung unten. Wer eine Funktion als `style`
 * übergibt, reagiert bereits selbst auf `pressed` — dort wäre eine zweite
 * Abdunklung zu viel und würde die eigene Gestaltung überschreiben. Nur wer
 * keine Funktion übergibt, bekommt die Vorgabe.
 */
export const Druck = ({ style, ...rest }: PressableProps) => {
  const eigeneRueckmeldung = typeof style === 'function';

  return (
    <Pressable
      style={(zustand) => [
        eigeneRueckmeldung ? (style as Extract<PressableProps['style'], Function>)(zustand) : style,
        !eigeneRueckmeldung && zustand.pressed ? styles.gedrueckt : null,
      ]}
      {...rest}
    />
  );
};

const styles = StyleSheet.create({
  /*
   * Abdunkeln statt Verkleinern. Verkleinern sieht bei einzelnen Knöpfen gut
   * aus, lässt aber ganze Listenzeilen wackeln — und die meisten der 175
   * Stellen sind Zeilen, keine Knöpfe.
   */
  gedrueckt: { opacity: 0.6 },
});
