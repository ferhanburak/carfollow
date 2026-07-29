import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScreenShell, Surface } from '@/components/screen-shell';
import { useGarage, type VehiclePart } from '@/hooks/use-garage';
import { firebaseAuth, firebaseStorage } from '@/lib/firebase';
import { callFirebase, getFirebaseErrorMessage } from '@/lib/firebase-callable';
import { APP_ID } from '@/lib/firebase-paths';
import { useAuth } from '@/providers/auth-provider';
import { useDriverProfile } from '@/providers/driver-profile-provider';
import { colors, fonts } from '@/theme/colors';

type Panel = 'settings' | 'service' | 'achievements' | null;
type Achievement = {
  key: string;
  title: string;
  description: string;
  current: number;
  target: number;
  unit: string;
  percent: number;
  unlocked: boolean;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{
    section?: string;
  }>();
  const { logout, profile, refreshProfile, user } = useAuth();
  const { social } = useDriverProfile();
  const garage = useGarage();
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState('');

  const stats = garage.driverStats ?? {};
  const achievements = Array.isArray(stats.achievements)
    ? stats.achievements as Achievement[]
    : [];
  const unlockedCount = achievements.filter((item) => item.unlocked).length;
  const topAchievement = [...achievements].sort((left, right) => right.percent - left.percent)[0];
  const profileCompletion = calculateProfileCompletion(profile);
  const badges = Array.from(new Set([
    ...(profile?.achievementBadges ?? []),
    ...(Array.isArray(stats.achievementBadges) ? stats.achievementBadges as string[] : []),
  ]));
  const harmonyVotes = Number(profile?.harmonyVotes ?? stats.harmonyVotesSnapshot ?? 0);
  const alertVotes = Number(profile?.alertVotes ?? 0);
  const harmonyRatio = harmonyVotes + alertVotes
    ? Math.round((harmonyVotes / (harmonyVotes + alertVotes)) * 100)
    : 100;
  const currentClan = social.currentClan?.name || profile?.clan || 'Klan yok';
  const personalStats = [
    { key: 'monthly-km', label: 'Bireysel Aylık KM', value: `${formatNumber(stats.monthlyKm ?? profile?.monthlyKm)} KM` },
    { key: 'night-km', label: 'Aylık Gece KM', value: `${formatNumber(stats.monthlyNightKm)} KM` },
    { key: 'verified-km', label: 'Onaylı Toplam', value: `${formatNumber(stats.lifetimeVerifiedKm ?? profile?.totalKm)} KM` },
    { key: 'drive-time', label: 'Aylık Sürüş', value: formatDuration(stats.monthlyDriveSeconds) },
    { key: 'max-speed', label: 'Aylık Maksimum Hız', value: `${formatNumber(stats.monthlyMaxSpeedKmh)} KM/H` },
    { key: 'average-speed', label: 'Ortalama Hız', value: `${formatNumber(stats.monthlyAverageSpeedKmh)} KM/H` },
    { key: 'driver-score', label: 'Sürücü Skoru', value: `${profile?.driverScore || 0}/100` },
    { key: 'service-logs', label: 'Servis Kaydı', value: `${garage.serviceLogs.length}` },
    { key: 'fuel-logs', label: 'Yakıt Fişi', value: `${garage.fuelLogs.length}` },
    { key: 'harmony', label: 'Uyum Oranı', value: `%${harmonyRatio}` },
  ];
  const socialSummary = [
    { key: 'friends', label: 'Arkadaş', value: `${social.friends.length}` },
    { key: 'incoming', label: 'Gelen İstek', value: `${social.incoming.length}` },
    { key: 'outgoing', label: 'Giden İstek', value: `${social.outgoing.length}` },
    { key: 'clan-invites', label: 'Klan Daveti', value: `${social.incomingClanInvites.length}` },
  ];

  const signOut = async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await logout();
    router.replace('/(auth)/login');
  };

  const showNotice = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(''), 2800);
  };

  return (
    <ScreenShell>
      <Surface accent>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            {profile?.avatar ? (
              <Image contentFit="cover" source={{ uri: profile.avatar }} style={styles.avatarImage} />
            ) : (
              <Ionicons color={colors.black} name="car-sport" size={27} />
            )}
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{profile?.fullName || 'CRUISER sürücüsü'}</Text>
            <Text style={styles.plate}>{profile?.plate || 'PLAKA YOK'}</Text>
            <Text style={styles.model}>{profile?.model || 'Araç bilgisi yok'}</Text>
          </View>
          <Pressable onPress={() => setPanel('settings')} style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={21} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.profileHealth}>
          <CompactMetric label="Profil" value={`%${profileCompletion}`} />
          <CompactMetric label="Unvan" value={`${badges.length}`} />
        </View>

        <View style={styles.overviewGrid}>
          <CompactMetric label="Profil Hazır" value={`%${profileCompletion}`} />
          <CompactMetric label="Sürücü Skoru" value={`${profile?.driverScore || 0}/100`} />
          <CompactMetric
            label="Aylık KM"
            value={`${formatNumber(stats.monthlyKm ?? profile?.monthlyKm)} KM`}
          />
          <CompactMetric label="Klan" value={currentClan} neutral />
        </View>

        <View style={styles.badgeList}>
          {badges.length ? badges.map((badge) => (
            <View key={badge} style={styles.badge}>
              <Ionicons name="ribbon" size={13} color={colors.limeBright} />
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )) : (
            <Text style={styles.badgeEmpty}>
              Henüz aktif unvan yok. Sürüş ve sosyal ilerlemeyle ilk unvanını açabilirsin.
            </Text>
          )}
        </View>
      </Surface>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Surface>
        <View style={styles.sectionHeader}>
          <Text style={styles.cardTitle}>Sürücü İstatistikleri</Text>
          <Text style={styles.sectionTag}>CANLI</Text>
        </View>
        <View style={styles.compactGrid}>
          {personalStats.map((item) => (
            <CompactMetric key={item.key} label={item.label} value={item.value} />
          ))}
        </View>
        <View style={styles.garageLine}>
          <Text style={styles.garageLabel}>Aktif Garaj</Text>
          <Text numberOfLines={1} style={styles.garageValue}>{profile?.garage || '--'}</Text>
        </View>
      </Surface>

      <Pressable onPress={() => setPanel('achievements')} style={({ pressed }) => [pressed && styles.pressed]}>
        <Surface>
          <View style={styles.cardTitleRow}>
            <View>
              <Text style={styles.cardTitle}>Başarımlar</Text>
              <Text style={styles.cardSubtitle}>{unlockedCount}/{achievements.length} tamamlandı</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.lime} />
          </View>
          {topAchievement ? (
            <>
              <View style={styles.achievementRow}>
                <Text style={styles.achievementName}>{topAchievement.title}</Text>
                <Text style={styles.achievementPercent}>%{topAchievement.percent}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${topAchievement.percent}%` }]} />
              </View>
            </>
          ) : (
            <Text style={styles.empty}>İstatistikler güncellendiğinde başarımlar burada görünür.</Text>
          )}
        </Surface>
      </Pressable>

      <Surface>
        <View style={styles.sectionHeader}>
          <Text style={styles.cardTitle}>Sosyal Özet</Text>
          <Text style={styles.sectionTag}>EKİP</Text>
        </View>
        <View style={styles.compactGrid}>
          {socialSummary.map((item) => (
            <CompactMetric key={item.key} label={item.label} value={item.value} />
          ))}
        </View>
        <View style={styles.clanSummary}>
          <View style={styles.clanSummaryCopy}>
            <Text style={styles.garageLabel}>Mevcut Klan</Text>
            <Text numberOfLines={1} style={styles.clanName}>{currentClan}</Text>
            <Text style={styles.clanMeta}>
              Rol: {roleLabel(social.membership?.role || profile?.clanRole)}
              {' · '}Uyum: {harmonyVotes}
              {' · '}Uyarı: {alertVotes}
            </Text>
          </View>
          <Ionicons name="shield-half" size={23} color={colors.lime} />
        </View>
      </Surface>

      <Pressable onPress={() => setPanel('service')} style={({ pressed }) => [pressed && styles.pressed]}>
        <Surface>
          <View style={styles.cardTitleRow}>
            <View>
              <Text style={styles.cardTitle}>Servis ve Garaj</Text>
              <Text style={styles.cardSubtitle}>
                {garage.parts.length} parça · {garage.serviceLogs.length} servis kaydı
              </Text>
            </View>
            <View style={styles.serviceIcon}>
              <Ionicons name="construct" size={21} color={colors.black} />
            </View>
          </View>
          <View style={styles.partPreview}>
            {garage.parts.slice(0, 4).map((part) => (
              <PartChip key={part.id} part={part} odometer={Number(profile?.odometer ?? 0)} />
            ))}
          </View>
        </Surface>
      </Pressable>

      <ModalShell onClose={() => setPanel(null)} title="Başarımlar" visible={panel === 'achievements'}>
        <View style={styles.modalList}>
          {achievements.map((achievement) => (
            <View key={achievement.key} style={styles.achievementCard}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.achievementName}>{achievement.title}</Text>
                <Text style={styles.achievementPercent}>%{achievement.percent}</Text>
              </View>
              <Text style={styles.achievementDescription}>{achievement.description}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${achievement.percent}%` }]} />
              </View>
              <Text style={styles.progressCaption}>
                {achievement.current.toLocaleString('tr-TR')} / {achievement.target.toLocaleString('tr-TR')} {achievement.unit}
              </Text>
            </View>
          ))}
        </View>
      </ModalShell>

      <ServicePanel
        garage={garage}
        odometer={Number(profile?.odometer ?? 0)}
        onClose={() => setPanel(null)}
        showNotice={showNotice}
        visible={panel === 'service'}
      />

      <SettingsPanel
        onClose={() => {
          setPanel(null);
          if (section === 'settings') router.replace('/(tabs)/profile');
        }}
        onLogout={() => void signOut()}
        profile={profile}
        refreshProfile={refreshProfile}
        showNotice={showNotice}
        userId={user?.uid ?? ''}
        visible={panel === 'settings' || section === 'settings'}
      />
    </ScreenShell>
  );
}

function CompactMetric({
  label,
  neutral = false,
  value,
}: {
  label: string;
  neutral?: boolean;
  value: string;
}) {
  return (
    <View style={styles.compactMetric}>
      <Text style={styles.compactMetricLabel}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[styles.compactMetricValue, neutral && styles.compactMetricValueNeutral]}
      >
        {value}
      </Text>
    </View>
  );
}

function PartChip({ odometer, part }: { odometer: number; part: VehiclePart }) {
  const percent = partPercent(part, odometer);
  return (
    <View style={styles.partChip}>
      <View style={[styles.partDot, { backgroundColor: healthColor(percent) }]} />
      <Text numberOfLines={1} style={styles.partChipText}>{part.name}</Text>
      <Text style={[styles.partChipPercent, { color: healthColor(percent) }]}>%{percent}</Text>
    </View>
  );
}

function ModalShell({
  children,
  onClose,
  title,
  visible,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
  visible: boolean;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <View style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ServicePanel({
  garage,
  odometer,
  onClose,
  showNotice,
  visible,
}: {
  garage: ReturnType<typeof useGarage>;
  odometer: number;
  onClose: () => void;
  showNotice: (text: string) => void;
  visible: boolean;
}) {
  const [selectedPart, setSelectedPart] = useState<VehiclePart | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [serviceKm, setServiceKm] = useState(String(odometer));
  const [shop, setShop] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const save = async () => {
    if (!selectedPart || !shop.trim() || Number(serviceKm) < 0) return;
    try {
      await garage.addServiceLog({
        part: selectedPart,
        type: 'replacement',
        serviceDate: new Date().toISOString().slice(0, 10),
        serviceKm: Number(serviceKm),
        serviceShop: shop,
        cost: Math.max(0, Number(cost || 0)),
        notes,
      });
      setFormOpen(false);
      setSelectedPart(null);
      setShop('');
      setCost('');
      setNotes('');
      showNotice('Servis kaydı eklendi.');
    } catch {}
  };

  return (
    <ModalShell onClose={onClose} title="Servis ve Garaj" visible={visible}>
      {garage.error ? <Text style={styles.error}>{garage.error}</Text> : null}
      <Text style={styles.modalSectionTitle}>Parça Durumu</Text>
      <View style={styles.partsGrid}>
        {garage.parts.map((part) => {
          const percent = partPercent(part, odometer);
          return (
            <Pressable
              key={part.id}
              onPress={() => {
                setSelectedPart(part);
                setServiceKm(String(odometer));
                setFormOpen(true);
              }}
              style={styles.partCard}
            >
              <View style={[styles.healthRing, { borderColor: healthColor(percent) }]}>
                <Text style={[styles.healthValue, { color: healthColor(percent) }]}>%{percent}</Text>
              </View>
              <Text numberOfLines={2} style={styles.partName}>{part.name}</Text>
              <Text style={styles.partAction}>Değişimi kaydet</Text>
            </Pressable>
          );
        })}
      </View>

      {formOpen && selectedPart ? (
        <View style={styles.serviceForm}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{selectedPart.name}</Text>
            <Pressable onPress={() => setFormOpen(false)}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setServiceKm}
            placeholder="Değişim kilometresi *"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            value={serviceKm}
          />
          <TextInput
            onChangeText={setShop}
            placeholder="Servis / usta *"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            value={shop}
          />
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setCost}
            placeholder="Tutar (TL)"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            value={cost}
          />
          <TextInput
            multiline
            onChangeText={setNotes}
            placeholder="Not"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.textArea]}
            value={notes}
          />
          <Pressable
            disabled={!shop.trim() || garage.busy === 'service'}
            onPress={() => void save()}
            style={styles.saveButton}
          >
            {garage.busy === 'service'
              ? <ActivityIndicator color={colors.black} />
              : <Text style={styles.saveButtonText}>Parça Değişimini Kaydet</Text>}
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.modalSectionTitle}>Servis Geçmişi</Text>
      <View style={styles.modalList}>
        {garage.serviceLogs.length ? garage.serviceLogs.map((log) => {
          const part = garage.parts.find((item) => item.key === log.partKey);
          return (
            <View key={log.id} style={styles.logCard}>
              <View style={styles.logCopy}>
                <Text style={styles.driverName}>{part?.name || log.partKey}</Text>
                <Text style={styles.driverMeta}>
                  {log.serviceDate} · {log.serviceKm.toLocaleString('tr-TR')} KM
                </Text>
                <Text style={styles.driverMeta}>{log.serviceShop} · {log.cost.toLocaleString('tr-TR')} TL</Text>
              </View>
              <Pressable
                disabled={garage.busy === `delete-${log.id}`}
                onPress={() => Alert.alert(
                  'Kaydı sil',
                  'Bu servis kaydını silmek istediğinize emin misiniz?',
                  [
                    { text: 'Vazgeç', style: 'cancel' },
                    {
                      text: 'Sil',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await garage.deleteServiceLog(log.id);
                          showNotice('Servis kaydı silindi.');
                        } catch {}
                      },
                    },
                  ],
                )}
                style={styles.deleteButton}
              >
                <Ionicons name="trash-outline" size={18} color="#fda4af" />
              </Pressable>
            </View>
          );
        }) : <Text style={styles.empty}>Henüz servis kaydı yok.</Text>}
      </View>
    </ModalShell>
  );
}

function SettingsPanel({
  onClose,
  onLogout,
  profile,
  refreshProfile,
  showNotice,
  userId,
  visible,
}: {
  onClose: () => void;
  onLogout: () => void;
  profile: ReturnType<typeof useAuth>['profile'];
  refreshProfile: () => Promise<void>;
  showNotice: (text: string) => void;
  userId: string;
  visible: boolean;
}) {
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [model, setModel] = useState(profile?.model ?? '');
  const [odometer, setOdometer] = useState(String(profile?.odometer ?? 0));
  const [horsepower, setHorsepower] = useState(String(profile?.horsepower ?? 0));
  const [garage, setGarage] = useState(profile?.garage || 'Garaj');
  const [region, setRegion] = useState(profile?.region || 'Belirtilmedi');
  const [avatar, setAvatar] = useState(profile?.avatar ?? '');
  const [showPlate, setShowPlate] = useState(profile?.privacy?.showPlateOnLiveMap === true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.78,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      setError('Görsel en fazla 10 MB olabilir.');
      return;
    }
    setBusy('avatar');
    try {
      const blob = await (await fetch(asset.uri)).blob();
      const storageRef = ref(
        firebaseStorage,
        `artifacts/${APP_ID}/users/${userId}/avatars/${Date.now()}.jpg`,
      );
      await uploadBytes(storageRef, blob, { contentType: asset.mimeType || 'image/jpeg' });
      setAvatar(await getDownloadURL(storageRef));
      showNotice('Profil fotoğrafı hazır. Değişiklikleri kaydedin.');
    } catch (uploadError) {
      setError(getFirebaseErrorMessage(uploadError, 'Fotoğraf yüklenemedi.'));
    } finally {
      setBusy('');
    }
  };

  const saveProfile = async () => {
    if (!fullName.trim() || !model.trim() || Number(horsepower) <= 0 || !garage.trim() || !region.trim()) {
      setError('Zorunlu alanları doldurun.');
      return;
    }
    setBusy('profile');
    setError('');
    try {
      await callFirebase('updateVehicleProfile', {
        profile: {
          fullName: fullName.trim(),
          model: model.trim(),
          odometer: Number(odometer),
          tuningStage: profile?.tuningStage || 'Stock',
          horsepower: Number(horsepower),
          garage: garage.trim(),
          region: region.trim(),
          avatar,
        },
      });
      await refreshProfile();
      showNotice('Araç ve profil bilgileri güncellendi.');
    } catch (saveError) {
      setError(getFirebaseErrorMessage(saveError));
    } finally {
      setBusy('');
    }
  };

  const savePrivacy = async (nextShowPlate: boolean) => {
    setShowPlate(nextShowPlate);
    try {
      await callFirebase('updatePrivacySettings', {
        privacy: {
          ...(profile?.privacy ?? {}),
          plateSearchEnabled: true,
          showPlateOnLiveMap: nextShowPlate,
          showModelInSearch: true,
          showRegionInSearch: profile?.privacy?.showRegionInSearch === true,
          locationPrecision: profile?.privacy?.locationPrecision || 'exact',
          safeZoneEnabled: profile?.privacy?.safeZoneEnabled !== false,
        },
        acceptKvkk: true,
      });
      await refreshProfile();
    } catch (privacyError) {
      setShowPlate(!nextShowPlate);
      setError(getFirebaseErrorMessage(privacyError));
    }
  };

  return (
    <ModalShell onClose={onClose} title="Ayarlar" visible={visible}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.modalSectionTitle}>Profil ve Araç</Text>
      <Pressable onPress={() => void pickAvatar()} style={styles.avatarEditor}>
        {avatar ? <Image source={{ uri: avatar }} style={styles.avatarEditorImage} /> : (
          <Ionicons name="camera" size={24} color={colors.black} />
        )}
        {busy === 'avatar' ? <ActivityIndicator color={colors.black} style={styles.avatarLoader} /> : null}
      </Pressable>
      <SettingInput label="Ad Soyad *" onChangeText={setFullName} value={fullName} />
      <SettingInput label="Araç Modeli *" onChangeText={setModel} value={model} />
      <SettingInput keyboardType="decimal-pad" label="Kilometre *" onChangeText={setOdometer} value={odometer} />
      <SettingInput keyboardType="number-pad" label="Beygir Gücü *" onChangeText={setHorsepower} value={horsepower} />
      <SettingInput label="Garaj / Servis *" onChangeText={setGarage} value={garage} />
      <SettingInput label="Bölge *" onChangeText={setRegion} value={region} />
      <Pressable onPress={() => void saveProfile()} style={styles.saveButton}>
        {busy === 'profile'
          ? <ActivityIndicator color={colors.black} />
          : <Text style={styles.saveButtonText}>Değişiklikleri Kaydet</Text>}
      </Pressable>

      <Text style={styles.modalSectionTitle}>Gizlilik ve Konum</Text>
      <View style={styles.settingRow}>
        <View style={styles.settingCopy}>
          <Text style={styles.settingTitle}>Canlı haritada plakayı göster</Text>
          <Text style={styles.settingDescription}>Kapalıyken diğer sürücüler plakanızı görmez.</Text>
        </View>
        <Switch
          onValueChange={(value) => void savePrivacy(value)}
          thumbColor={showPlate ? colors.black : colors.textMuted}
          trackColor={{ false: colors.surfaceAlt, true: colors.lime }}
          value={showPlate}
        />
      </View>

      <Text style={styles.modalSectionTitle}>Hesap ve Veri</Text>
      <SettingAction
        icon="key-outline"
        label="Şifremi Sıfırla"
        onPress={async () => {
          if (!firebaseAuth.currentUser?.email) return;
          await sendPasswordResetEmail(firebaseAuth, firebaseAuth.currentUser.email);
          showNotice('Şifre sıfırlama e-postası gönderildi.');
        }}
      />
      <SettingAction
        icon="download-outline"
        label="Verilerimi Dışa Aktar"
        onPress={async () => {
          await callFirebase('exportMyData');
          showNotice('Veri paketi güvenli şekilde hazırlandı.');
        }}
      />
      <SettingAction icon="log-out-outline" label="Oturumu Kapat" onPress={onLogout} danger />
      <SettingAction
        danger
        icon="trash-outline"
        label="Hesabımı Sil"
        onPress={() => Alert.alert(
          'Hesabı kalıcı olarak sil',
          'Bu işlem geri alınamaz. Devam etmek istiyor musunuz?',
          [
            { text: 'Vazgeç', style: 'cancel' },
            {
              text: 'Hesabı Sil',
              style: 'destructive',
              onPress: async () => {
                try {
                  await callFirebase('deleteMyAccount', {
                    confirmation: 'DELETE MY CRUISER ACCOUNT',
                  });
                } catch (deleteError) {
                  setError(getFirebaseErrorMessage(deleteError));
                }
              },
            },
          ],
        )}
      />
    </ModalShell>
  );
}

function SettingInput({
  keyboardType,
  label,
  onChangeText,
  value,
}: {
  keyboardType?: 'decimal-pad' | 'number-pad';
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function SettingAction({
  danger = false,
  icon,
  label,
  onPress,
}: {
  danger?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void | Promise<void>;
}) {
  return (
    <Pressable onPress={() => void onPress()} style={[styles.settingAction, danger && styles.settingActionDanger]}>
      <Ionicons name={icon} size={19} color={danger ? '#fda4af' : colors.lime} />
      <Text style={[styles.settingActionText, danger && styles.settingActionTextDanger]}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
    </Pressable>
  );
}

function calculateProfileCompletion(profile: ReturnType<typeof useAuth>['profile']) {
  if (!profile) return 0;
  const fields = [
    profile.fullName,
    profile.plate,
    profile.model,
    profile.tuningStage,
    profile.horsepower,
    profile.garage,
    profile.region,
    profile.avatar,
    profile.odometer,
  ];
  const completed = fields.filter((value) => (
    typeof value === 'number' ? value > 0 : Boolean(String(value ?? '').trim())
  )).length;
  return Math.round((completed / fields.length) * 100);
}

function roleLabel(role?: string) {
  if (role === 'owner') return 'Kurucu';
  if (role === 'captain') return 'Kaptan';
  if (role === 'member') return 'Üye';
  return 'Yok';
}

function partPercent(part: VehiclePart, odometer: number) {
  const persisted = Number(part.lifePercent ?? part.remainingPercent);
  if (Number.isFinite(persisted)) return Math.max(0, Math.min(100, Math.round(persisted)));
  const expectancy = Math.max(1, Number(part.lifeExpectancyKm ?? 1));
  const used = Math.max(0, odometer - Number(part.replacedKm ?? 0));
  return Math.max(0, Math.min(100, Math.round(100 - (used / expectancy) * 100)));
}

function healthColor(percent: number) {
  if (percent < 20) return colors.rose;
  if (percent < 45) return colors.amber;
  return colors.lime;
}

function formatNumber(value: unknown) {
  return Number(value ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
}

function formatDuration(value: unknown) {
  const seconds = Number(value ?? 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}sa ${minutes}dk` : `${minutes}dk`;
}

const styles = StyleSheet.create({
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 66,
    height: 66,
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  profileCopy: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 20, letterSpacing: -0.4 },
  plate: { marginTop: 3, color: colors.lime, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.6 },
  model: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 },
  settingsButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHealth: {
    marginTop: 15,
    flexDirection: 'row',
    gap: 8,
  },
  overviewGrid: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  compactGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  compactMetric: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 0,
    minHeight: 58,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(4,6,4,0.42)',
    justifyContent: 'center',
  },
  compactMetricLabel: {
    color: colors.textFaint,
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  compactMetricValue: {
    marginTop: 5,
    color: colors.limeBright,
    fontFamily: fonts.extraBold,
    fontSize: 13,
  },
  compactMetricValueNeutral: { color: colors.text },
  badgeList: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  badge: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.limeMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: { color: colors.limeBright, fontFamily: fonts.semibold, fontSize: 9 },
  badgeEmpty: {
    width: '100%',
    padding: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 9,
    lineHeight: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTag: {
    color: colors.textFaint,
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1.8,
  },
  garageLine: {
    minHeight: 42,
    marginTop: 8,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(4,6,4,0.42)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  garageLabel: {
    color: colors.textFaint,
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  garageValue: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 10,
    textAlign: 'right',
  },
  clanSummary: {
    minHeight: 72,
    marginTop: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(4,6,4,0.42)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clanSummaryCopy: { flex: 1, minWidth: 0 },
  clanName: { marginTop: 5, color: colors.text, fontFamily: fonts.extraBold, fontSize: 12 },
  clanMeta: { marginTop: 4, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 8 },
  notice: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.limeMuted,
    color: colors.limeBright,
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'center',
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 16 },
  cardSubtitle: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  achievementRow: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' },
  achievementName: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  achievementPercent: { color: colors.lime, fontFamily: fonts.extraBold, fontSize: 12 },
  achievementDescription: {
    marginTop: 7,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 16,
  },
  progressTrack: {
    height: 7,
    marginTop: 9,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.lime },
  progressCaption: { marginTop: 6, color: colors.textFaint, fontFamily: fonts.semibold, fontSize: 8 },
  serviceIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partPreview: { marginTop: 13, gap: 7 },
  partChip: {
    minHeight: 39,
    paddingHorizontal: 11,
    borderRadius: 13,
    backgroundColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partDot: { width: 8, height: 8, borderRadius: 4 },
  partChipText: { flex: 1, color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 10 },
  partChipPercent: { fontFamily: fonts.extraBold, fontSize: 10 },
  modalRoot: { flex: 1, paddingTop: 44, backgroundColor: colors.background },
  modalHeader: {
    minHeight: 66,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 22 },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: { padding: 16, paddingBottom: 44 },
  modalList: { gap: 9 },
  modalSectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 16,
  },
  achievementCard: {
    padding: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  partsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  partCard: {
    width: '48.7%',
    minHeight: 142,
    padding: 12,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  healthRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthValue: { fontFamily: fonts.extraBold, fontSize: 13 },
  partName: { marginTop: 9, color: colors.text, fontFamily: fonts.bold, fontSize: 10, textAlign: 'center' },
  partAction: { marginTop: 5, color: colors.textFaint, fontFamily: fonts.regular, fontSize: 8 },
  serviceForm: {
    marginTop: 15,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.limeMuted,
  },
  field: { marginTop: 10 },
  fieldLabel: { marginBottom: 6, color: colors.textMuted, fontFamily: fonts.bold, fontSize: 9 },
  input: {
    minHeight: 50,
    marginTop: 8,
    paddingHorizontal: 13,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  textArea: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
  saveButton: {
    minHeight: 52,
    marginTop: 12,
    borderRadius: 17,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: colors.black, fontFamily: fonts.bold, fontSize: 13 },
  logCard: {
    minHeight: 76,
    padding: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logCopy: { flex: 1 },
  driverName: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  driverMeta: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  deleteButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(244,63,94,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditor: {
    width: 88,
    height: 88,
    overflow: 'hidden',
    borderRadius: 28,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditorImage: { width: '100%', height: '100%' },
  avatarLoader: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(163,230,53,0.7)' },
  settingRow: {
    minHeight: 70,
    padding: 13,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingCopy: { flex: 1 },
  settingTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  settingDescription: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  settingAction: {
    minHeight: 54,
    marginBottom: 8,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingActionDanger: { borderColor: 'rgba(244,63,94,0.25)', backgroundColor: 'rgba(244,63,94,0.06)' },
  settingActionText: { flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  settingActionTextDanger: { color: '#fda4af' },
  error: {
    padding: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(244,63,94,0.08)',
    color: '#fda4af',
    fontFamily: fonts.semibold,
    fontSize: 10,
  },
  empty: {
    paddingVertical: 18,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
    textAlign: 'center',
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
