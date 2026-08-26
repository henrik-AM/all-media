import React, { createContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setzeDunkel } from '../constants/design';

type Theme = 'light' | 'dark' | 'system';

const SPEICHER = 'all-media.thema.v1';

export const ThemeContext = createContext<{
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
}>({
  theme: 'system',
  isDark: false,
  setTheme: () => {},
});

/**
 * Helles und dunkles Design.
 *
 * Dieser Provider gab es schon, war aber nirgends eingebunden — und die
 * Farben kamen ohnehin als feste Werte aus `constants/design`. Der Schalter
 * „Dunkles Design" in den Einstellungen hat deshalb nichts bewirkt.
 *
 * Jetzt trägt er das Thema in `constants/design` ein (siehe `setzeDunkel`)
 * und gibt es zusätzlich über den Context weiter. Die Farben selbst kommen
 * aus Stellvertretern, die bei jedem Zugriff den passenden Satz heraussuchen
 * — es genügt also, den Baum nach einem Wechsel neu aufzubauen.
 */
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('system');
  const [geladen, setGeladen] = useState(false);
  const systemColorScheme = useColorScheme();

  const isDark = theme === 'dark' || (theme === 'system' && systemColorScheme === 'dark');

  /*
   * Bewusst im Rendern und nicht in einem Effekt: die Kinder lesen die Farben
   * beim Aufbauen. Käme die Umstellung erst im Effekt danach, würde ein
   * Bildaufbau lang das alte Thema gezeichnet — beim Start also ein weißes
   * Aufblitzen vor dem dunklen Bild. Der Aufruf setzt nur einen Wert und ist
   * beliebig oft wiederholbar.
   */
  setzeDunkel(isDark);

  useEffect(() => {
    AsyncStorage.getItem(SPEICHER)
      .then((wert) => {
        if (wert === 'light' || wert === 'dark' || wert === 'system') setTheme(wert);
      })
      .catch(() => {
        // Nicht lesbar: dann eben der Systemwert.
      })
      .finally(() => setGeladen(true));
  }, []);

  useEffect(() => {
    if (!geladen) return;
    AsyncStorage.setItem(SPEICHER, theme).catch(() => {
      // Nicht sichern zu können ist ärgerlich, aber kein Grund abzubrechen.
    });
  }, [theme, geladen]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme }}>
      {/*
        Der Schlüssel baut den Baum bei einem Themenwechsel komplett neu auf.
        Das ist nötig, weil die Stylesheets beim Aufbauen gelesen werden — ohne
        Neuaufbau bliebe die halbe Oberfläche in der alten Farbe stehen.
        Ein Wechsel wirft dabei den Bildschirmzustand weg; das ist vertretbar,
        weil man dafür ohnehin in den Einstellungen steht.
      */}
      <React.Fragment key={isDark ? 'dunkel' : 'hell'}>{children}</React.Fragment>
    </ThemeContext.Provider>
  );
};
