import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/screen-shell';
import { useLiveTelemetry, type LiveDriver } from '@/hooks/use-live-telemetry';
import { useAuth } from '@/providers/auth-provider';
import { colors, fonts } from '@/theme/colors';

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
  const { profile } = useAuth();
  const { drivers, location } = useLiveTelemetry();
  const [follow, setFollow] = useState(true);
  const [selected, setSelected] = useState<LiveDriver | null>(null);

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
    <LinearGradient colors={[colors.background, '#0b0f08']} style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <AppHeader />

        <View style={styles.mapFrame}>
          <MapView
            initialRegion={DEFAULT_REGION}
            mapType="standard"
            onPanDrag={() => setFollow(false)}
            onPress={() => setSelected(null)}
            provider={mapProvider}
            ref={mapRef}
            rotateEnabled
            showsCompass={false}
            showsMyLocationButton={false}
            style={styles.map}
            userInterfaceStyle="dark"
          >
            {drivers.map((driver) => (
              <Marker
                coordinate={{
                  latitude: driver.latitude,
                  longitude: driver.longitude,
                }}
                key={driver.userId}
                onPress={() => setSelected(driver)}
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

          {selected ? (
            <View style={styles.driverCard}>
              <View style={[styles.relationStripe, { backgroundColor: relationColor(selected.relation) }]} />
              <View style={styles.driverCopy}>
                <Text style={styles.driverPlate}>
                  {selected.relation === 'self' ? profile?.fullName : selected.plate || 'CRUISER sürücüsü'}
                </Text>
                <Text style={styles.driverMeta}>
                  {relationLabel(selected.relation)} · {Math.round(selected.speed)} KM/H
                </Text>
              </View>
              <Pressable onPress={() => setSelected(null)} style={styles.dismiss}>
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
        </View>
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

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(5,6,5,0.88)',
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
    backgroundColor: 'rgba(5,6,5,0.9)',
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
    backgroundColor: 'rgba(8,10,7,0.94)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  relationStripe: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginRight: 11 },
  driverCopy: { flex: 1 },
  driverPlate: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 14 },
  driverMeta: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  dismiss: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
