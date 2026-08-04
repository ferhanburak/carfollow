import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import {
  LocalizedPressable as Pressable,
  LocalizedText as Text,
  localizedAlert,
} from '@/components/localized-text';
import { createGpx, trimRouteEndpoints, type RouteSummary } from '@/lib/route-summary';
import { colors, createThemedStyles, fonts } from '@/theme/colors';

type Props = {
  onClose: () => void;
  protectEndpoints?: boolean;
  summary: RouteSummary | null;
};

const mapProvider = Platform.OS === 'android' || process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY
  ? PROVIDER_GOOGLE
  : undefined;

export function RouteSummaryModal({ onClose, protectEndpoints = true, summary }: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const shareCardRef = useRef<View>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapImageUri, setMapImageUri] = useState('');
  const [sharing, setSharing] = useState<'image' | 'gpx' | ''>('');
  const sharePoints = useMemo(
    () => summary ? (protectEndpoints ? trimRouteEndpoints(summary.points) : summary.points) : [],
    [protectEndpoints, summary],
  );
  const coordinates = useMemo(() => sharePoints.map((point) => ({
    latitude: point.lat,
    longitude: point.lng,
  })), [sharePoints]);

  useEffect(() => {
    if (!summary || !mapReady || coordinates.length < 2) return undefined;
    const timeout = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coordinates, {
        animated: false,
        edgePadding: { top: 46, right: 42, bottom: 46, left: 42 },
      });
      setTimeout(() => {
        void mapRef.current?.takeSnapshot({
          format: 'png',
          quality: 1,
          result: 'file',
          width: 900,
          height: 500,
        }).then(setMapImageUri).catch(() => undefined);
      }, 450);
    }, 250);
    return () => clearTimeout(timeout);
  }, [coordinates, mapReady, summary]);

  if (!summary) return null;

  const shareImage = async () => {
    if (!shareCardRef.current) return;
    setSharing('image');
    try {
      if (!await Sharing.isAvailableAsync()) {
        localizedAlert('Paylaşım kullanılamıyor', 'Bu cihazda sistem paylaşım menüsü açılamadı.');
        return;
      }
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await Sharing.shareAsync(uri, {
        dialogTitle: 'TrackSnap rota özetini paylaş',
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch {
      localizedAlert('Paylaşım başarısız', 'Rota kartı oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setSharing('');
    }
  };

  const shareGpx = async () => {
    if (sharePoints.length < 2) {
      localizedAlert('Rota verisi yetersiz', 'GPX oluşturmak için en az iki GPS noktası gerekir.');
      return;
    }
    setSharing('gpx');
    try {
      if (!await Sharing.isAvailableAsync()) {
        localizedAlert('Paylaşım kullanılamıyor', 'Bu cihazda sistem paylaşım menüsü açılamadı.');
        return;
      }
      const file = new File(Paths.cache, `tracksnap-${safeFileName(summary.id)}.gpx`);
      file.create({ intermediates: true, overwrite: true });
      file.write(createGpx({ ...summary, points: sharePoints }));
      await Sharing.shareAsync(file.uri, {
        dialogTitle: 'TrackSnap GPX rotasını dışa aktar',
        mimeType: 'application/gpx+xml',
        UTI: 'com.topografix.gpx',
      });
    } catch {
      localizedAlert('Dışa aktarma başarısız', 'GPX rota dosyası oluşturulamadı.');
    } finally {
      setSharing('');
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
          <Pressable accessibilityLabel="Rota özetini kapat" onPress={onClose} style={styles.headerButton}>
            <Ionicons color={colors.text} name="arrow-back" size={22} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Rota Özeti</Text>
            <Text numberOfLines={1} style={styles.headerMeta}>{summary.title}</Text>
          </View>
          <View style={styles.kindBadge}>
            <Ionicons
              color={colors.lime}
              name={summary.kind === 'convoy' ? 'people' : 'car-sport'}
              size={18}
            />
          </View>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          <View ref={shareCardRef} collapsable={false} style={styles.shareCard}>
            <View style={styles.brandRow}>
              <View>
                <Text style={styles.brand}>TRACKSNAP</Text>
                <Text style={styles.cardTitle}>{summary.title}</Text>
              </View>
              <View style={styles.brandIcon}>
                <Ionicons color={colors.black} name="navigate" size={19} />
              </View>
            </View>

            <View style={styles.cardMap}>
              {mapImageUri ? (
                <Image contentFit="cover" source={{ uri: mapImageUri }} style={styles.mapImage} />
              ) : (
                <View style={styles.mapPlaceholder}>
                  <Ionicons color={colors.lime} name="map-outline" size={32} />
                  <Text style={styles.mapPlaceholderText}>
                    {coordinates.length > 1 ? 'Rota görseli hazırlanıyor' : 'GPS rota izi bulunamadı'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.cardMetrics}>
              <SummaryMetric label="Mesafe" value={`${formatDecimal(summary.distanceKm)} KM`} />
              <SummaryMetric label="Süre" value={formatDuration(summary.durationSeconds)} />
              <SummaryMetric label="Ort. hız" value={`${formatDecimal(summary.averageSpeedKmh)} KM/H`} />
              <SummaryMetric label="Maksimum" value={`${Math.round(summary.maxSpeedKmh)} KM/H`} />
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.date}>{formatDate(summary.startedAt)}</Text>
              <Text style={styles.tag}>#TrackSnap</Text>
            </View>
          </View>

          <View style={styles.liveMapFrame}>
            {coordinates.length ? (
              <MapView
                initialRegion={regionForCoordinates(coordinates)}
                onMapReady={() => setMapReady(true)}
                provider={mapProvider}
                ref={mapRef}
                rotateEnabled
                scrollEnabled
                style={styles.liveMap}
                toolbarEnabled={false}
                zoomEnabled
              >
                {coordinates.length > 1 ? (
                  <Polyline coordinates={coordinates} strokeColor={colors.lime} strokeWidth={6} />
                ) : null}
              </MapView>
            ) : (
              <View style={styles.emptyRoute}>
                <Ionicons color={colors.textFaint} name="map-outline" size={30} />
                <Text style={styles.emptyRouteText}>Bu oturumda paylaşılabilir GPS izi oluşmadı.</Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable
              disabled={Boolean(sharing)}
              onPress={() => void shareImage()}
              style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
            >
              {sharing === 'image' ? (
                <ActivityIndicator color={colors.black} size="small" />
              ) : (
                <Ionicons color={colors.black} name="share-social" size={20} />
              )}
              <Text style={styles.primaryActionText}>Görseli Paylaş</Text>
            </Pressable>
            <Pressable
              disabled={Boolean(sharing) || sharePoints.length < 2}
              onPress={() => void shareGpx()}
              style={({ pressed }) => [
                styles.secondaryAction,
                sharePoints.length < 2 && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {sharing === 'gpx' ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Ionicons color={colors.text} name="download-outline" size={20} />
              )}
              <Text style={styles.secondaryActionText}>GPX Aktar</Text>
            </Pressable>
          </View>
          <Text style={styles.privacyNote}>
            {protectEndpoints
              ? 'Güvenli Bölge açık: paylaşımda rotanın başlangıç ve bitiş bölümü gizlendi.'
              : 'GPX dosyası hassas rota koordinatlarını içerir; yalnızca güvendiğiniz kişilerle paylaşın.'}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function regionForCoordinates(coordinates: { latitude: number; longitude: number }[]) {
  const latitudes = coordinates.map((item) => item.latitude);
  const longitudes = coordinates.map((item) => item.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max(0.01, (maxLatitude - minLatitude) * 1.4),
    longitudeDelta: Math.max(0.01, (maxLongitude - minLongitude) * 1.4),
  };
}

function formatDecimal(value: number) {
  return Math.max(0, value).toLocaleString('tr-TR', {
    minimumFractionDigits: value < 1 ? 2 : 1,
    maximumFractionDigits: value < 1 ? 2 : 1,
  });
}

function formatDuration(seconds: number) {
  const minutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} SA ${minutes % 60} DK` : `${minutes} DK`;
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 80);
}

const styles = createThemedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 78,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 18 },
  headerMeta: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  kindBadge: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: colors.limeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 14, gap: 14 },
  shareCard: {
    padding: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: colors.lime, fontFamily: fonts.extraBold, fontSize: 10, letterSpacing: 3 },
  cardTitle: { marginTop: 4, color: colors.text, fontFamily: fonts.extraBold, fontSize: 17 },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMap: {
    height: 176,
    marginTop: 13,
    overflow: 'hidden',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
  },
  mapImage: { width: '100%', height: '100%' },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapPlaceholderText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 9 },
  cardMetrics: { marginTop: 11, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metric: {
    width: '48%',
    minHeight: 58,
    padding: 9,
    borderRadius: 14,
    backgroundColor: colors.backgroundRaised,
  },
  metricLabel: {
    color: colors.textFaint,
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metricValue: { marginTop: 5, color: colors.lime, fontFamily: fonts.extraBold, fontSize: 13 },
  cardFooter: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  date: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 8 },
  tag: { color: colors.lime, fontFamily: fonts.bold, fontSize: 8 },
  liveMapFrame: {
    height: 230,
    overflow: 'hidden',
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  liveMap: { flex: 1 },
  emptyRoute: { flex: 1, padding: 30, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyRouteText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 9 },
  primaryAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: 17,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: { color: colors.black, fontFamily: fonts.bold, fontSize: 11 },
  secondaryAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionText: { color: colors.text, fontFamily: fonts.bold, fontSize: 11 },
  privacyNote: {
    color: colors.textFaint,
    fontFamily: fonts.regular,
    fontSize: 8,
    lineHeight: 13,
    textAlign: 'center',
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
}));
