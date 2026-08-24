import React, { createContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { colors } from '../constants/design';

type Theme = 'light' | 'dark' | 'system';

export const ThemeContext = createContext<{
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
}>({
  theme: 'system',
  isDark: false,
  setTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('system');
  const systemColorScheme = useColorScheme();
  
  const isDark =
    theme === 'dark' || (theme === 'system' && systemColorScheme === 'dark');

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
