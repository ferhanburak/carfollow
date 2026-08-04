import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
} from 'react-native';

import { LocalizedPressable as Pressable, LocalizedText as Text } from '@/components/localized-text';
import { ScreenShell } from '@/components/screen-shell';
import { useDriveSession } from '@/hooks/use-drive-session';
import { getRuntimeLocale } from '@/i18n/language-runtime';
import { useAuth } from '@/providers/auth-provider';
import { colors, createThemedStyles, fonts } from '@/theme/colors';

export default function DriveScreen() {
  const { profile } = useAuth();
  const drive = useDriveSession();
  const [locationLabel, setLocationLabel] = useState('');
  const odometer = Number(profile?.odometer ?? 0) + drive.metrics.sessionKm;
  const canRetryFinish = !drive.isDriving && Boolean(drive.sessionId);
  const locationKey = drive.location
    ? `${drive.location.lat.toFixed(4)},${drive.location.lng.toFixed(4)}`
    : '';

  useEffect(() => {
    let active = true;
    if (!locationKey) return undefined;
    const [latitude, longitude] = locationKey.split(',').map(Number);

    void Location.reverseGeocodeAsync({
      latitude,
      longitude,
    }).then(([address]) => {
      if (!active || !address) return;
      const area = address.district || address.subregion || address.name;
      const city = address.city || address.region;
      setLocationLabel([area, city].filter(Boolean).join(' / '));
    }).catch(() => {
      if (active) setLocationLabel('');
    });

    return () => {
      active = false;
    };
  }, [locationKey]);

  const toggleDrive = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (drive.isDriving || canRetryFinish) {
      await drive.finish();
      return;
    }
    await drive.start();
  };

  const gpsLabel = getGpsLabel(drive.status, drive.accuracy);
  const placeLabel = locationLabel || (
    drive.isDriving ? 'Konum belirleniyor' : profile?.region || 'Sürüşü başlat'
  );

  return (
    <ScreenShell>
      <View style={styles.hudCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>
              {drive.isDriving ? 'SÜRÜŞ MODU AKTİF' : 'SÜRÜŞE HAZIR'}
            </Text>
            <View style={styles.locationLine}>
              <Text numberOfLines={1} style={styles.gpsStatus}>{gpsLabel}</Text>
              <View style={styles.separator} />
              <Text numberOfLines={1} style={styles.location}>{placeLabel}</Text>
            </View>
          </View>
          <View style={[styles.dot, drive.isDriving && styles.dotActive]} />
        </View>

        <View style={styles.speedArea}>
          <View style={styles.speedLine}>
            <Text style={styles.speed}>{Math.round(drive.currentSpeedKmh)}</Text>
            <Text style={styles.unit}>KM/H</Text>
          </View>
          <Text style={styles.maxSpeed}>
            MAKSİMUM {Math.round(drive.metrics.maxSpeedKmh)} KM/H
          </Text>
        </View>

        <View style={styles.metrics}>
          <Metric
            accent
            label="Mesafe"
            value={`${formatDistance(drive.metrics.sessionKm)} KM`}
          />
          <Metric label="Oturum" value={formatDuration(drive.elapsedSeconds)} />
          <Metric
            label="GPS"
            value={drive.accuracy == null ? '--' : `±${Math.round(drive.accuracy)} M`}
          />
        </View>

        <View style={styles.secondaryMetrics}>
          <View style={styles.secondaryItem}>
            <Text style={styles.secondaryLabel}>ORTALAMA HIZ</Text>
            <Text numberOfLines={1} style={styles.secondaryValue}>
              {formatDecimal(drive.metrics.averageSpeedKmh)} KM/H
            </Text>
          </View>
          <View style={styles.secondaryDivider} />
          <View style={styles.secondaryItem}>
            <Text style={styles.secondaryLabel}>ARAÇ KM</Text>
            <Text numberOfLines={1} style={styles.secondaryValue}>
              {formatNumber(odometer)} KM
            </Text>
          </View>
        </View>

        {drive.error ? (
          <View style={styles.error}>
            <Ionicons color={colors.rose} name="warning-outline" size={17} />
            <Text style={styles.errorText}>{drive.error}</Text>
          </View>
        ) : null}

        <Pressable
          disabled={drive.pending}
          onPress={() => void toggleDrive()}
          style={({ pressed }) => [
            styles.action,
            (drive.isDriving || canRetryFinish) && styles.stopAction,
            pressed && styles.pressed,
            drive.pending && styles.disabled,
          ]}
        >
          {drive.pending ? (
            <ActivityIndicator
              color={drive.isDriving || canRetryFinish ? colors.white : colors.black}
              size="small"
            />
          ) : (
            <>
              <Ionicons
                color={drive.isDriving || canRetryFinish ? colors.white : colors.black}
                name={drive.isDriving || canRetryFinish ? 'stop' : 'car-sport'}
                size={19}
              />
              <Text style={[
                styles.actionText,
                (drive.isDriving || canRetryFinish) && styles.stopActionText,
              ]}>
                {drive.isDriving
                  ? 'Sürüşü Bitir'
                  : canRetryFinish
                    ? 'Kaydı Tamamla'
                    : 'Sürüşe Başla'}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.telemetryNote}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.lime} />
        <Text style={styles.telemetryNoteText} numberOfLines={2}>
          {drive.statusMessage}
        </Text>
      </View>
    </ScreenShell>
  );
}

function Metric({
  accent = false,
  label,
  value,
}: {
  accent?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[styles.metricValue, accent && styles.metricValueAccent]}
      >
        {value}
      </Text>
    </View>
  );
}

function getGpsLabel(status: string, accuracy: number | null) {
  if (status === 'requesting-permission') return 'GPS İZNİ';
  if (status === 'starting') return 'GPS BAĞLANIYOR';
  if (status === 'error') return 'GPS HATASI';
  if (status === 'finalizing') return 'KAYIT İŞLENİYOR';
  if (status === 'active') {
    if (accuracy != null && accuracy > 35) return 'ZAYIF SİNYAL';
    return 'GPS CANLI';
  }
  return 'GPS HAZIR';
}

function formatDuration(seconds: number) {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}S ${minutes}DK` : `${minutes} DK`;
}

function formatNumber(value: number) {
  return value.toLocaleString(getRuntimeLocale(), { maximumFractionDigits: 1 });
}

function formatDistance(value: number) {
  return Math.max(0, value).toLocaleString(getRuntimeLocale(), {
    minimumFractionDigits: value < 1 ? 2 : 1,
    maximumFractionDigits: value < 1 ? 2 : 1,
  });
}

function formatDecimal(value: number) {
  return value.toLocaleString(getRuntimeLocale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

const styles = createThemedStyles(() => ({
  hudCard: {
    overflow: 'hidden',
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.surface,
    shadowColor: colors.lime,
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusCopy: { flex: 1, minWidth: 0 },
  statusTitle: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  locationLine: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  gpsStatus: {
    maxWidth: '40%',
    color: colors.lime,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.1,
  },
  separator: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.textFaint,
  },
  location: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
  },
  dot: {
    width: 12,
    height: 12,
    marginTop: 3,
    borderRadius: 6,
    backgroundColor: colors.textFaint,
  },
  dotActive: {
    backgroundColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  speedArea: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  speedLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  speed: {
    color: colors.lime,
    fontFamily: fonts.extraBold,
    fontSize: 58,
    letterSpacing: -3,
    lineHeight: 64,
  },
  unit: {
    paddingBottom: 8,
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 2.2,
  },
  maxSpeed: {
    marginTop: 3,
    color: colors.textFaint,
    fontFamily: fonts.semibold,
    fontSize: 8,
    letterSpacing: 1.2,
  },
  metrics: {
    flexDirection: 'row',
    gap: 7,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    color: colors.textFaint,
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metricValue: {
    marginTop: 5,
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 11,
  },
  metricValueAccent: { color: colors.lime },
  secondaryMetrics: {
    minHeight: 40,
    marginTop: 9,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.025)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  secondaryDivider: {
    width: 1,
    height: 18,
    marginHorizontal: 7,
    backgroundColor: colors.border,
  },
  secondaryLabel: {
    color: colors.textFaint,
    fontFamily: fonts.bold,
    fontSize: 7,
    letterSpacing: 0.6,
  },
  secondaryValue: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 9,
  },
  error: {
    marginTop: 9,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.28)',
    backgroundColor: 'rgba(244,63,94,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#fda4af',
    fontFamily: fonts.semibold,
    fontSize: 9,
    lineHeight: 14,
  },
  action: {
    minHeight: 50,
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stopAction: { backgroundColor: colors.rose },
  actionText: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  stopActionText: { color: colors.white },
  telemetryNote: {
    minHeight: 54,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  telemetryNoteText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 9,
    lineHeight: 14,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
}));
