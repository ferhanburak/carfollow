import AsyncStorage from '@react-native-async-storage/async-storage';

export type RuntimeLanguage = 'tr' | 'en';

const LANGUAGE_STORAGE_KEY = 'tracksnap.language.preference.v1';
let runtimeLanguage: RuntimeLanguage = 'tr';

export function getRuntimeLanguage() {
  return runtimeLanguage;
}

export function setRuntimeLanguage(language: RuntimeLanguage) {
  runtimeLanguage = language;
}

export function getRuntimeLocale() {
  return runtimeLanguage === 'en' ? 'en-US' : 'tr-TR';
}

export async function getPreferredLanguage() {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'tr' || stored === 'en') runtimeLanguage = stored;
  return runtimeLanguage;
}
