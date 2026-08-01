import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = 'tr' | 'en';

const LANGUAGE_STORAGE_KEY = 'tracksnap.language.preference.v1';

const translations = {
  tr: {
    'language.title': 'Dil',
    'language.description': 'Uygulama dilini seç. Yeni diller daha sonra buraya eklenebilir.',
    'language.current': 'Türkçe',
    'language.turkish': 'Türkçe',
    'language.english': 'İngilizce',
    'language.turkishDescription': 'Uygulamayı Türkçe kullan.',
    'language.englishDescription': 'Uygulamayı İngilizce kullan.',
    'auth.eyebrow': 'TRACKSNAP // ERİŞİM',
    'auth.heroTitle': 'Yolun sosyal ağı.',
    'auth.heroCopy': 'Sürüşünü takip et, topluluğunu bul ve rotanı paylaş.',
    'auth.login': 'Giriş',
    'auth.register': 'Kayıt Ol',
    'auth.email': 'E-posta *',
    'auth.password': 'Şifre *',
    'auth.passwordPlaceholder': 'En az 8 karakter',
    'auth.enter': "TRACKSNAP'e Gir",
    'auth.required': 'Zorunlu alan',
    'auth.fullName': 'Görünen Ad *',
    'auth.plate': 'Plaka *',
    'auth.vehicleType': 'Araç Türü *',
    'auth.car': 'Otomobil',
    'auth.motorcycle': 'Motosiklet',
    'auth.vehicleModel': 'Araç Modeli *',
    'auth.odometer': 'Güncel Kilometre *',
    'auth.consent': 'KVKK aydınlatma metnini ve kullanım koşullarını okudum, onaylıyorum.',
    'auth.createAccount': 'Hesabımı Oluştur',
    'auth.errorRequired': 'Zorunlu alanları doldurun.',
    'auth.errorPassword': 'Şifre en az 8 karakter olmalıdır.',
    'auth.errorOdometer': 'Geçerli bir kilometre bilgisi girin.',
    'auth.errorConsent': 'KVKK metni ve kullanım koşulları onaylanmalıdır.',
    'settings.title': 'Ayarlar Merkezi',
    'settings.subtitle': 'Hesap, araç, konum ve güvenlik kontrolleri',
    'settings.appearance': 'Görünüm',
    'settings.appearanceDescription': 'Sistem temasını kullan veya açık ve koyu görünüm arasında seçim yap.',
    'settings.themeSystem': 'Sistem',
    'settings.themeLight': 'Açık',
    'settings.themeDark': 'Koyu',
    'settings.themeSystemDescription': 'Telefonunun açık veya koyu temasını takip eder.',
    'settings.themeLightDescription': 'Gündüz kullanımı için aydınlık ve yüksek okunabilirlik.',
    'settings.themeDarkDescription': 'Gece sürüşleri için düşük parlaklıklı görünüm.',
    'settings.appTheme': 'Uygulama Teması',
    'settings.themeDescription': 'Seçimin bu cihazda saklanır ve tüm ekranlara uygulanır.',
    'settings.privacy': 'Gizlilik ve Konum',
    'settings.privacyDescription': 'Canlı harita görünürlüğü, konum hassasiyeti ve güvenli bölge.',
    'settings.blocked': 'Engellenen Kullanıcılar',
    'settings.blockedDescription': 'Engellediğin sürücüleri görüntüle ve engelleri yönet.',
    'settings.vehicle': 'Araç ve Profil',
    'settings.vehicleDescription': 'Araç bilgileri, kilometre, bölge ve profil fotoğrafı.',
    'settings.account': 'Hesap ve Veri Kontrolleri',
    'settings.accountDescription': 'E-posta doğrulama, veri aktarımı ve hesap silme.',
    'settings.security': 'Şifre ve Güvenlik',
    'settings.securityDescription': 'Hesap e-postası ve güvenli şifre yenileme akışı.',
    'settings.logout': 'Oturumu Kapat',
    'settings.logoutHint': 'Hesap verilerin silinmez; yalnızca bu cihazdaki oturum kapanır.',
    'settings.driver': 'Sürücü',
    'settings.systemTheme': 'Sistem teması',
    'settings.lightTheme': 'Açık tema',
    'settings.darkTheme': 'Koyu tema',
    'tabs.liveMap': 'Canlı Harita',
    'tabs.events': 'Etkinlikler',
    'tabs.drive': 'Sürüş',
    'tabs.feed': 'Akış',
    'tabs.social': 'Sosyal',
    'tabs.leaderboard': 'Sıralama',
    'tabs.profile': 'Profil',
  },
  en: {
    'language.title': 'Language',
    'language.description': 'Choose the app language. More languages can be added here later.',
    'language.current': 'English',
    'language.turkish': 'Turkish',
    'language.english': 'English',
    'language.turkishDescription': 'Use the app in Turkish.',
    'language.englishDescription': 'Use the app in English.',
    'auth.eyebrow': 'TRACKSNAP // ACCESS',
    'auth.heroTitle': 'Your road. Your social network.',
    'auth.heroCopy': 'Track your drives, find your community and share your route.',
    'auth.login': 'Log In',
    'auth.register': 'Sign Up',
    'auth.email': 'Email *',
    'auth.password': 'Password *',
    'auth.passwordPlaceholder': 'At least 8 characters',
    'auth.enter': 'Enter TRACKSNAP',
    'auth.required': 'Required field',
    'auth.fullName': 'Display Name *',
    'auth.plate': 'License Plate *',
    'auth.vehicleType': 'Vehicle Type *',
    'auth.car': 'Car',
    'auth.motorcycle': 'Motorcycle',
    'auth.vehicleModel': 'Vehicle Model *',
    'auth.odometer': 'Current Odometer *',
    'auth.consent': 'I have read and accept the privacy notice and terms of use.',
    'auth.createAccount': 'Create My Account',
    'auth.errorRequired': 'Please complete all required fields.',
    'auth.errorPassword': 'Password must be at least 8 characters.',
    'auth.errorOdometer': 'Enter a valid odometer value.',
    'auth.errorConsent': 'You must accept the privacy notice and terms of use.',
    'settings.title': 'Settings',
    'settings.subtitle': 'Account, vehicle, location and security controls',
    'settings.appearance': 'Appearance',
    'settings.appearanceDescription': 'Follow the system theme or choose light and dark appearance.',
    'settings.themeSystem': 'System',
    'settings.themeLight': 'Light',
    'settings.themeDark': 'Dark',
    'settings.themeSystemDescription': "Follows your phone's light or dark theme.",
    'settings.themeLightDescription': 'A bright, highly readable appearance for daytime use.',
    'settings.themeDarkDescription': 'A low-brightness appearance for night drives.',
    'settings.appTheme': 'App Theme',
    'settings.themeDescription': 'Your choice is saved on this device and applied to every screen.',
    'settings.privacy': 'Privacy & Location',
    'settings.privacyDescription': 'Live Map visibility, location precision and Safe Zone.',
    'settings.blocked': 'Blocked Users',
    'settings.blockedDescription': 'View blocked drivers and manage your block list.',
    'settings.vehicle': 'Vehicle & Profile',
    'settings.vehicleDescription': 'Vehicle details, odometer, region and profile photo.',
    'settings.account': 'Account & Data Controls',
    'settings.accountDescription': 'Email verification, data export and account deletion.',
    'settings.security': 'Password & Security',
    'settings.securityDescription': 'Account email and secure password reset flow.',
    'settings.logout': 'Log Out',
    'settings.logoutHint': 'Your account data is kept; only this device session is closed.',
    'settings.driver': 'Driver',
    'settings.systemTheme': 'System theme',
    'settings.lightTheme': 'Light theme',
    'settings.darkTheme': 'Dark theme',
    'tabs.liveMap': 'Live Map',
    'tabs.events': 'Events',
    'tabs.drive': 'Drive',
    'tabs.feed': 'Feed',
    'tabs.social': 'Social',
    'tabs.leaderboard': 'Leaderboard',
    'tabs.profile': 'Profile',
  },
} as const;

export type TranslationKey = keyof typeof translations.tr;

type LanguageContextValue = {
  hydrated: boolean;
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey) => string;
};

const defaultContext: LanguageContextValue = {
  hydrated: true,
  language: 'tr',
  setLanguage: () => undefined,
  t: (key) => translations.tr[key],
};

const LanguageContext = createContext<LanguageContextValue>(defaultContext);

export function AppLanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<AppLanguage>('tr');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((stored) => {
        if (active && (stored === 'tr' || stored === 'en')) setLanguageState(stored);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  const value = useMemo<LanguageContextValue>(() => ({
    hydrated,
    language,
    setLanguage,
    t: (key) => translations[language][key],
  }), [hydrated, language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useAppLanguage() {
  return useContext(LanguageContext);
}
