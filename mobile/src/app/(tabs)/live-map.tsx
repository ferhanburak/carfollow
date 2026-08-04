import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocalizedPressable as Pressable, LocalizedText as Text, localizedAlert } from '@/components/localized-text';
import { MapNodeDetailModal, MapNodeMarker } from '@/components/map-node-ui';
import { AppHeader } from '@/components/screen-shell';
import { useLiveTelemetry, type LiveDriver } from '@/hooks/use-live-telemetry';
import { useAuth } from '@/providers/auth-provider';
import { useDriverProfile } from '@/providers/driver-profile-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { colors, createThemedStyles, fonts } from '@/theme/colors';
import type { MapPin } from '@/types/cruiser';

const DEFAULT_REGION = {
  latitude: 39.9334,
  longitude: 32.8597,
  latitudeDelta: 0.1,
  longitudeDelta: 0.08,
};

const mapProvider =
  Platform.OS === 'android' || process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY
    ? PROVIDER_GOOGLE
    : undefined;

export default function LiveMapScreen() {
  const mapRef = useRef<MapView>(null);
  const { resolvedTheme } = useAppTheme();
  const { profile, user } = useAuth();
  const { mapWorld, openDriverProfile } = useDriverProfile();
  const { drivers, location } = useLiveTelemetry();
  const [follow, setFollow] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<LiveDriver | null>(null);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);

  useEffect(() => {
    if (!follow || !location) return;
    mapRef.current?.animateCamera({
      center: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
      heading: Number(location.coords.heading ?? 0),
      pitch: 42,
      zoom: 16,
    }, { duration: 650 });
  }, [follow, location]);

  const recenter = () => {
    setFollow((current) => {
      const next = !current;
      if (!current && location) {
        mapRef.current?.animateCamera({
          center: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          heading: Number(location.coords.heading ?? 0),
          pitch: 42,
          zoom: 16,
        }, { duration: 500 });
      }
      return next;
    });
  };

  return (
    <LinearGradient colors={[colors.background, colors.backgroundRaised]} style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader />

        <View style={styles.mapFrame}>
          <MapView
            initialRegion={DEFAULT_REGION}
            mapType="standard"
            onPanDrag={() => setFollow(false)}
            onPress={() => {
              setSelectedDriver(null);
              setSelectedPin(null);
            }}
            provider={mapProvider}
            ref={mapRef}
            rotateEnabled
            showsCompass={false}
            showsMyLocationButton={false}
            style={styles.map}
            userInterfaceStyle={resolvedTheme}
          >
            {drivers.map((driver) => (
              <Marker
                coordinate={{
                  latitude: driver.latitude,
                  longitude: driver.longitude,
                }}
                key={driver.userId}
                onPress={(event) => {
                  event.stopPropagation();
                  setSelectedPin(null);
                  setSelectedDriver(driver);
                }}
                rotation={driver.relation === 'self' ? Number(location?.coords.heading ?? 0) : 0}
                tracksViewChanges={false}
              >
                <View style={[
                  styles.driverMarker,
                  { backgroundColor: relationColor(driver.relation) },
                  driver.relation === 'self' && styles.selfMarker,
                ]}>
                  <Ionicons
                    color={driver.relation === 'self' ? colors.white : colors.black}
                    name={driver.relation === 'self' ? 'navigate' : 'car-sport'}
                    size={driver.relation === 'self' ? 20 : 16}
                  />
                </View>
              </Marker>
            ))}
            {mapWorld.activePins.map((pin) => (
              <Marker
                coordinate={{
                  latitude: Number(pin.lat),
                  longitude: Number(pin.lng),
                }}
                key={`node-${pin.id}`}
                onPress={(event) => {
                  event.stopPropagation();
                  setSelectedDriver(null);
                  setSelectedPin(pin);
                }}
                tracksViewChanges={false}
                zIndex={selectedPin?.id === pin.id ? 10 : 2}
              >
                <MapNodeMarker pin={pin} selected={selectedPin?.id === pin.id} />
              </Marker>
            ))}
            {selectedPin?.type === 'meet' &&
            selectedPin.eventMode === 'convoy' &&
            selectedPin.backendCanViewDetails !== false &&
            (selectedPin.routePath?.length ?? 0) > 1 ? (
              <Polyline
                coordinates={(selectedPin.routePath ?? []).map((point) => ({
                  latitude: point.lat,
                  longitude: point.lng,
                }))}
                strokeColor={colors.rose}
                strokeWidth={5}
                zIndex={4}
              />
            ) : null}
          </MapView>

          <View style={styles.legend}>
            <Legend color="#22c55e" label="Arkadaş" />
            <Legend color={colors.amber} label="Klan" />
            <Legend color={colors.rose} label="Diğer" />
          </View>

          <Pressable
            onPress={recenter}
            style={({ pressed }) => [
              styles.followButton,
              follow && styles.followButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              color={follow ? colors.black : colors.text}
              name={follow ? 'navigate' : 'locate'}
              size={21}
            />
          </Pressable>

          {selectedDriver ? (
            <Pressable
              accessibilityLabel={`${selectedDriver.plate || 'Sürücü'} profilini aç`}
              onPress={() => void openDriverProfile({
                userId: selectedDriver.userId,
                fullName: selectedDriver.relation === 'self' ? profile?.fullName : undefined,
                plate: selectedDriver.plate,
                model: selectedDriver.model,
                relation: selectedDriver.relation === 'other' ? 'stranger' : selectedDriver.relation,
              })}
              style={({ pressed }) => [styles.driverCard, pressed && styles.driverCardPressed]}
            >
              <View
                style={[
                  styles.relationStripe,
                  { backgroundColor: relationColor(selectedDriver.relation) },
                ]}
              />
              <View style={styles.driverCopy}>
                <Text style={styles.driverPlate}>
                  {selectedDriver.relation === 'self'
                    ? profile?.fullName
                    : selectedDriver.plate || 'TrackSnap sürücüsü'}
                </Text>
                <Text style={styles.driverMeta}>
                  {relationLabel(selectedDriver.relation)} · {Math.round(selectedDriver.speed)} KM/H
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Sürücü kartını kapat"
                onPress={(event) => {
                  event.stopPropagation();
                  setSelectedDriver(null);
                }}
                style={styles.dismiss}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          ) : null}
        </View>

        <MapNodeDetailModal
          busy={Boolean(mapWorld.busy)}
          currentUserId={user?.uid}
          onClose={() => setSelectedPin(null)}
          onCancelTrip={selectedPin?.type === 'meet' ? () => localizedAlert(
            'Konvoy sürüşünden ayrıl',
            'GPS konvoy takibiniz durdurulacak. Devam edilsin mi?',
            [
              { text: 'Vazgeç', style: 'cancel' },
              { text: 'Ayrıl', style: 'destructive', onPress: () => void mapWorld.cancelConvoyTrip(selectedPin.id) },
            ],
          ) : undefined}
          onJoin={selectedPin?.backendCanJoin ? async () => {
            try {
              await mapWorld.joinConvoy(selectedPin.id);
              setSelectedPin(null);
              localizedAlert('İstek gönderildi', 'Etkinlik katılım isteğiniz iletildi.');
            } catch {
              localizedAlert('Katılım başarısız', mapWorld.error || 'İstek gönderilemedi.');
            }
          } : undefined}
          onLike={selectedPin && (selectedPin.type === 'meet' || selectedPin.type === 'spot') ? async () => {
            try {
              await mapWorld.likePin(selectedPin.id);
            } catch {
              localizedAlert('Beğeni başarısız', mapWorld.error || 'Beğeni güncellenemedi.');
            }
          } : undefined}
          onOpenDriver={(driver) => void openDriverProfile(driver, {
            convoyId: selectedPin?.type === 'meet' ? selectedPin.id : undefined,
          })}
          onRateMember={selectedPin?.type === 'meet' ? (driver, signal) => {
            localizedAlert(
              signal === 'harmony' ? 'Uyumlu sürücü' : 'Sorun bildir',
              `${driver.fullName || 'Bu sürücü'} için oyun kaydedilsin mi?`,
              [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Kaydet',
                  onPress: () => void mapWorld.rateConvoyMember(selectedPin.id, driver.userId, signal)
                    .then(() => localizedAlert('Puan kaydedildi', 'Konvoy değerlendirmeniz işlendi.'))
                    .catch(() => localizedAlert('Puanlama başarısız', mapWorld.error || 'Oy kaydedilemedi.')),
                },
              ],
            );
          } : undefined}
          onRemoveMember={selectedPin?.type === 'meet' ? (driver) => localizedAlert(
            'Katılımcıyı çıkar',
            `${driver.fullName || 'Bu sürücü'} konvoydan çıkarılsın mı?`,
            [
              { text: 'Vazgeç', style: 'cancel' },
              { text: 'Çıkar', style: 'destructive', onPress: () => void mapWorld.removeConvoyMember(selectedPin.id, driver.userId) },
            ],
          ) : undefined}
          onRespondRequest={selectedPin?.type === 'meet' ? (driver, decision) => {
            void mapWorld.respondConvoyRequest(selectedPin.id, driver.userId, decision)
              .catch(() => localizedAlert('İşlem başarısız', mapWorld.error || 'Katılım isteği güncellenemedi.'));
          } : undefined}
          onSetRole={selectedPin?.type === 'meet' ? (driver, role) => localizedAlert(
            'Konvoy rolünü değiştir',
            `${driver.fullName || 'Bu sürücü'} ${role === 'manager' ? 'yardımcı' : 'katılımcı'} yapılsın mı?`,
            [
              { text: 'Vazgeç', style: 'cancel' },
              { text: 'Onayla', onPress: () => void mapWorld.setConvoyMemberRole(selectedPin.id, driver.userId, role) },
            ],
          ) : undefined}
          pin={selectedPin
            ? mapWorld.pins.find((pin) => pin.id === selectedPin.id) ?? selectedPin
            : null}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function relationColor(relation: LiveDriver['relation']) {
  if (relation === 'self') return '#2563eb';
  if (relation === 'friend') return '#22c55e';
  if (relation === 'clan') return colors.amber;
  return colors.rose;
}

function relationLabel(relation: LiveDriver['relation']) {
  if (relation === 'self') return 'Siz';
  if (relation === 'friend') return 'Arkadaşınız';
  if (relation === 'clan') return 'Klan üyesi';
  return 'Yakındaki sürücü';
}

const styles = createThemedStyles(() => ({
  root: { flex: 1 },
  safe: { flex: 1 },
  mapFrame: {
    flex: 1,
    marginHorizontal: 8,
    marginTop: 10,
    marginBottom: 86,
    overflow: 'hidden',
    borderRadius: 27,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  map: { flex: 1 },
  driverMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfMarker: { width: 44, height: 44, borderRadius: 22 },
  legend: {
    position: 'absolute',
    left: 12,
    top: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: colors.backgroundRaised,
    gap: 5,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 9 },
  followButton: {
    position: 'absolute',
    right: 13,
    top: 13,
    width: 48,
    height: 48,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButtonActive: {
    borderColor: colors.lime,
    backgroundColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  driverCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 68,
    padding: 12,
    overflow: 'hidden',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  relationStripe: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginRight: 11 },
  driverCopy: { flex: 1 },
  driverPlate: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 14 },
  driverMeta: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  driverCardPressed: {
    borderColor: colors.lime,
    transform: [{ scale: 0.988 }],
  },
  dismiss: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
}));
