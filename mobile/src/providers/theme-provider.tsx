import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  colors,
  setActiveTheme,
  type AppColors,
  type AppThemeMode,
  type ResolvedAppTheme,
} from '@/theme/colors';

const THEME_STORAGE_KEY = 'tracksnap.theme.preference.v1';

type ThemeContextValue = {
  colors: AppColors;
  hydrated: boolean;
  mode: AppThemeMode;
  resolvedTheme: ResolvedAppTheme;
  setMode: (mode: AppThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<AppThemeMode>('system');
  const [hydrated, setHydrated] = useState(false);
  const resolvedTheme: ResolvedAppTheme = mode === 'system'
    ? systemScheme === 'light' ? 'light' : 'dark'
    : mode;

  setActiveTheme(resolvedTheme);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((storedMode) => {
        if (!active) return;
        if (storedMode === 'system' || storedMode === 'light' || storedMode === 'dark') {
          setModeState(storedMode);
        }
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setMode = (nextMode: AppThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
  };

  const value = useMemo<ThemeContextValue>(() => ({
    colors,
    hydrated,
    mode,
    resolvedTheme,
    setMode,
  }), [hydrated, mode, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme must be used inside AppThemeProvider.');
  return value;
}
