import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

import type { AppLanguage } from '@/providers/language-provider';

export type HelpTopicId =
  | 'live-map'
  | 'events'
  | 'drive'
  | 'forum'
  | 'social'
  | 'leaderboard'
  | 'profile';

type LocalizedCopy = {
  en: string;
  tr: string;
};

export type HelpTopic = {
  id: HelpTopicId;
  icon: ComponentProps<typeof Ionicons>['name'];
  title: LocalizedCopy;
  summary: LocalizedCopy;
  steps: LocalizedCopy[];
  tip: LocalizedCopy;
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'live-map',
    icon: 'map-outline',
    title: { tr: 'Canlı Harita', en: 'Live Map' },
    summary: {
      tr: 'Kendini, topluluğunu ve aktif etkinlik noktalarını anlık haritada gör.',
      en: 'See yourself, your community and active event points on the live map.',
    },
    steps: [
      {
        tr: 'Mavi ok seni; yeşil arkadaşlarını, sarı klan üyelerini ve kırmızı diğer sürücüleri gösterir.',
        en: 'The blue arrow is you; green marks friends, yellow clan members and red other drivers.',
      },
      {
        tr: 'Bir sürücüye veya etkinlik ikonuna dokunarak güvenli profil ve etkinlik ayrıntılarını aç.',
        en: 'Tap a driver or event icon to open its safe profile or event details.',
      },
      {
        tr: 'Konum düğmesi yeşilken harita seni takip eder. Haritayı sürükleyerek takibi kapatabilirsin.',
        en: 'The map follows you while the location button is green. Drag the map to stop following.',
      },
    ],
    tip: {
      tr: 'Ev çevrendeki konum paylaşımını Ayarlar > Gizlilik ve Konum içindeki Güvenli Bölge ile sınırla.',
      en: 'Limit location sharing near home with Safe Zone under Settings > Privacy & Location.',
    },
  },
  {
    id: 'events',
    icon: 'calendar-outline',
    title: { tr: 'Etkinlikler', en: 'Events' },
    summary: {
      tr: 'Buluşma, konvoy, fotoğraf noktası ve yıkama noktalarını keşfet veya oluştur.',
      en: 'Discover or create meets, convoys, photo spots and car wash points.',
    },
    steps: [
      {
        tr: 'Haritadaki ikona dokunarak etkinliğin katılım, güven puanı ve rota bilgilerini incele.',
        en: 'Tap a map icon to inspect attendance, trust score and route details.',
      },
      {
        tr: 'Etkinlik Ekle ile türü seç; konumu mini haritadan belirle ve gerekli alanları doldur.',
        en: 'Choose a type with Add Event, select its location on the mini map and complete required fields.',
      },
      {
        tr: 'Konvoy sahibiyken istekleri, katılımcıları, yardımcı rolleri ve rota noktalarını yönetebilirsin.',
        en: 'As a convoy host, manage requests, participants, assistant roles and route points.',
      },
    ],
    tip: {
      tr: 'Özel etkinliklerin kesin konum ve rota ayrıntıları yalnızca erişim hakkı olan sürücülere gösterilir.',
      en: 'Exact locations and routes of private events are shown only to eligible drivers.',
    },
  },
  {
    id: 'drive',
    icon: 'speedometer-outline',
    title: { tr: 'Sürüş Modu', en: 'Drive Mode' },
    summary: {
      tr: 'GPS ile gerçek mesafe, hareket süresi ve hız verilerini güvenli biçimde kaydet.',
      en: 'Securely record real distance, moving time and speed with GPS.',
    },
    steps: [
      {
        tr: 'Araç düğmesine dokunup konum izinlerini vererek doğrulanabilir sürüş oturumunu başlat.',
        en: 'Tap the car button and grant location access to start a verifiable drive session.',
      },
      {
        tr: 'Ekran kapalıyken üst bildirimde hız, mesafe ve süreyi takip edebilirsin.',
        en: 'Track speed, distance and time from the persistent notification while the screen is off.',
      },
      {
        tr: 'Sürüşü bitirdiğinde doğrulanan değerler kilometreye, parça ömrüne ve sıralamalara işlenir.',
        en: 'When you finish, verified values update odometer, part health and leaderboards.',
      },
    ],
    tip: {
      tr: 'Güvenlik için sürüş aktifken eğitim pencereleri kendiliğinden açılmaz.',
      en: 'For safety, tutorial windows never open automatically during a drive.',
    },
  },
  {
    id: 'forum',
    icon: 'chatbox-ellipses-outline',
    title: { tr: 'Forum ve Akış', en: 'Forum & Feed' },
    summary: {
      tr: 'Yol, modifiye, teknik ve günlük hayat içeriklerini toplulukla paylaş.',
      en: 'Share road, build, technical and daily-life content with the community.',
    },
    steps: [
      {
        tr: 'Paylaşım alanından metin, görsel, konum, anket, kullanıcı etiketi veya etkinlik bağlantısı ekle.',
        en: 'Add text, image, location, poll, user mentions or an event link from the composer.',
      },
      {
        tr: 'Bir gönderiye dokunarak ayrıntıları, yanıtları, beğenileri ve paylaşım seçeneklerini aç.',
        en: 'Tap a post to open details, replies, likes and sharing options.',
      },
      {
        tr: 'Teknik ve modifiye konularında gönderi sahibi en yararlı yanıtı çözüm olarak sabitleyebilir.',
        en: 'In technical and build topics, the author can pin the most useful reply as the solution.',
      },
    ],
    tip: {
      tr: 'Etiketlediğin kullanıcıya uygulama içi bildirim gider; gereksiz telefon bildirimi gönderilmez.',
      en: 'Mentioned users receive an in-app notification without an unnecessary phone alert.',
    },
  },
  {
    id: 'social',
    icon: 'people-outline',
    title: { tr: 'Sosyal ve Klan', en: 'Social & Clan' },
    summary: {
      tr: 'Sürücü bul, arkadaşlık ve davetleri yönet, klanınla iletişim kur.',
      en: 'Find drivers, manage friendships and invitations, and connect with your clan.',
    },
    steps: [
      {
        tr: 'Plaka veya araçla sürücü ara; kullanıcı kartına dokunarak güvenli profilini aç.',
        en: 'Search by plate or vehicle and tap a driver card to open their safe profile.',
      },
      {
        tr: 'Profilden arkadaşlık, klan ve konvoy daveti gönderebilir veya doğrudan mesaj açabilirsin.',
        en: 'From a profile, send friend, clan or convoy invitations, or start a direct message.',
      },
      {
        tr: 'Klan merkezinde üyeleri, rolleri, davetleri ve klana özel etkinlikleri yönet.',
        en: 'Manage members, roles, invitations and clan-only events from the clan center.',
      },
    ],
    tip: {
      tr: 'Rahatsızlık veren sürücüleri profil kartından engelleyebilir ve raporlayabilirsin.',
      en: 'Block or report disruptive drivers from their profile card.',
    },
  },
  {
    id: 'leaderboard',
    icon: 'stats-chart-outline',
    title: { tr: 'Sıralamalar', en: 'Leaderboards' },
    summary: {
      tr: 'Kilometre, sürüş süresi ve maksimum hız performansını karşılaştır.',
      en: 'Compare distance, drive time and maximum speed performance.',
    },
    steps: [
      {
        tr: 'Günlük, haftalık, aylık veya tüm zamanlar dönemini seç.',
        en: 'Choose daily, weekly, monthly or all-time period.',
      },
      {
        tr: 'KM, Sürüş Süresi ve Maksimum Hız sekmeleri arasında geçiş yap.',
        en: 'Switch between KM, Drive Time and Maximum Speed.',
      },
      {
        tr: 'İlk beş listesindeki boş alana veya tüm zamanlar kürsüsüne dokunarak tam sıralamayı aç.',
        en: 'Tap the top-five area or all-time podium to open the full ranking.',
      },
    ],
    tip: {
      tr: 'Yalnızca sunucu tarafından doğrulanan sürüşler sıralama değerlerini artırır.',
      en: 'Only server-verified drives increase leaderboard values.',
    },
  },
  {
    id: 'profile',
    icon: 'person-outline',
    title: { tr: 'Profil, Başarımlar ve Servis', en: 'Profile, Achievements & Service' },
    summary: {
      tr: 'Sürücü kimliğini, araç sağlığını, başarımları ve hesap tercihlerini yönet.',
      en: 'Manage your driver identity, vehicle health, achievements and account preferences.',
    },
    steps: [
      {
        tr: 'Profilde doğrulanmış sürüş istatistiklerini, topluluk katkısını ve rozetlerini incele.',
        en: 'Review verified drive stats, community contribution and badges on your profile.',
      },
      {
        tr: 'Servis bölümünde parça ömürlerini gör; bakım, parça değişimi ve yakıt kayıtlarını ekle.',
        en: 'View part health in Service and add maintenance, replacement and fuel records.',
      },
      {
        tr: 'Ayarlar bölümünden tema, dil, gizlilik, araç, hesap ve güvenlik seçeneklerini yönet.',
        en: 'Manage theme, language, privacy, vehicle, account and security options in Settings.',
      },
    ],
    tip: {
      tr: 'Hatalı servis kayıtlarını geçmiş listesinden silebilir, güncel kilometreyi araç ayarlarından düzeltebilirsin.',
      en: 'Delete incorrect service records from history and correct odometer data in vehicle settings.',
    },
  },
];

export function localizedHelp(copy: LocalizedCopy, language: AppLanguage) {
  return copy[language];
}

export function getHelpTopic(topicId: HelpTopicId) {
  return HELP_TOPICS.find((topic) => topic.id === topicId) ?? HELP_TOPICS[0];
}

export function getHelpTopicForPath(pathname: string): HelpTopicId | null {
  if (pathname.includes('/live-map')) return 'live-map';
  if (pathname.includes('/map')) return 'events';
  if (pathname.includes('/drive')) return 'drive';
  if (pathname.includes('/forum')) return 'forum';
  if (pathname.includes('/social')) return 'social';
  if (pathname.includes('/leaderboard')) return 'leaderboard';
  if (pathname.includes('/profile')) return 'profile';
  return null;
}
