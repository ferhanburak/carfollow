import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

export const darkColors = {
  background: '#070807',
  backgroundRaised: '#0c0e0b',
  surface: '#121411',
  surfaceAlt: '#181b16',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(163,230,53,0.32)',
  lime: '#a3e635',
  limeBright: '#bbf451',
  limeMuted: '#253413',
  rose: '#f43f5e',
  amber: '#fbbf24',
  text: '#f5f7f2',
  textMuted: '#949b8e',
  textFaint: '#62685e',
  black: '#050605',
  white: '#ffffff',
} as const;

export const lightColors = {
  background: '#f3f5ef',
  backgroundRaised: '#f8faf5',
  surface: '#ffffff',
  surfaceAlt: '#e8ede3',
  border: 'rgba(18, 22, 15, 0.12)',
  borderStrong: 'rgba(101, 163, 13, 0.38)',
  lime: '#84cc16',
  limeBright: '#65a30d',
  limeMuted: '#e4f4c8',
  rose: '#e11d48',
  amber: '#d97706',
  text: '#151a12',
  textMuted: '#5f6759',
  textFaint: '#858d7e',
  black: '#050605',
  white: '#ffffff',
} as const;

export type AppThemeMode = 'system' | 'light' | 'dark';
export type ResolvedAppTheme = Exclude<AppThemeMode, 'system'>;
export type AppColors = { [Key in keyof typeof darkColors]: string };

let activeColors: AppColors = darkColors;

export function setActiveTheme(theme: ResolvedAppTheme) {
  activeColors = theme === 'light' ? lightColors : darkColors;
}

export const colors = new Proxy({} as AppColors, {
  get: (_target, property: string | symbol) => activeColors[property as keyof AppColors],
});

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

// Styles are recreated lazily after a theme switch, keeping screen modules simple.
export function createThemedStyles<Styles extends NamedStyles>(
  factory: (palette: AppColors) => Styles,
): Styles {
  let palette = activeColors;
  let sheet = StyleSheet.create(factory(palette));

  return new Proxy({} as Styles, {
    get: (_target, property: string | symbol) => {
      if (palette !== activeColors) {
        palette = activeColors;
        sheet = StyleSheet.create(factory(palette));
      }
      return sheet[property as keyof Styles];
    },
  });
}

export const fonts = {
  regular: 'Manrope_400Regular',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
} as const;
