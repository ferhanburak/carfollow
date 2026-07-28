import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Eyebrow, ScreenShell, Surface } from '@/components/screen-shell';
import { useDriveSession } from '@/hooks/use-drive-session';
import { useAuth } from '@/providers/auth-provider';
import { colors, fonts } from '@/theme/colors';

export default function DriveScreen() {
  const { profile } = useAuth();
  const drive = useDriveSession();
  const odometer = Number(profile?.odometer ?? 0) + drive.metrics.sessionKm;
  const canRetryFinish = !drive.isDriving && Boolean(drive.sessionId);

  const toggleDrive = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (drive.isDriving || canRetryFinish) {
      await drive.finish();
      return;
    }
    await drive.start();
  };

  return (
    <ScreenShell title="Sürüş Modu">
      <Surface accent>
        <View style={styles.statusRow}>
          <View style={styles.statusCopy}>
            <Eyebrow>{drive.isDriving ? 'SÜRÜŞ MODU AKTİF' : 'GPS HAZIR'}</Eyebrow>
            <Text numberOfLines={2} style={styles.statusMessage}>
              {drive.statusMessage}
            </Text>
          </View>
          <View style={[styles.dot, drive.isDriving && styles.dotActive]} />
        </View>

        <View style={styles.speedArea}>
          <Text style={styles.speed}>{Math.round(drive.currentSpeedKmh)}</Text>
          <Text style={styles.unit}>KM/H</Text>
          <Text style={styles.maxSpeed}>
            MAKSİMUM {Math.round(drive.metrics.maxSpeedKmh)} KM/H
          </Text>
        </View>

        <View style={styles.metrics}>
          <Metric label="Mesafe" value={`${formatDecimal(drive.metrics.sessionKm)} KM`} />
          <Metric label="Süre" value={formatDuration(drive.elapsedSeconds)} />
          <Metric
            label="GPS"
            value={drive.accuracy == null ? '--' : `±${Math.round(drive.accuracy)} M`}
          />
        </View>

        <View style={styles.secondaryMetrics}>
          <Text style={styles.secondaryText}>
            Ortalama <Text style={styles.secondaryValue}>
              {formatDecimal(drive.metrics.averageSpeedKmh)} KM/H
            </Text>
          </Text>
          <Text style={styles.secondaryText}>
            Odometre <Text style={styles.secondaryValue}>
              {formatNumber(odometer)} KM
            </Text>
          </Text>
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
            drive.isDriving && styles.stopAction,
            pressed && styles.pressed,
            drive.pending && styles.disabled,
          ]}
        >
          {drive.pending ? (
            <ActivityIndicator color={colors.black} size="small" />
          ) : (
            <>
              <Ionicons
                color={drive.isDriving ? colors.white : colors.black}
                name={drive.isDriving || canRetryFinish ? 'stop' : 'car-sport'}
                size={20}
              />
              <Text style={[styles.actionText, drive.isDriving && styles.stopActionText]}>
                {drive.isDriving
                  ? 'Sürüşü Bitir'
                  : canRetryFinish
                    ? 'Kaydı Tamamla'
                    : 'Sürüşe Başla'}
              </Text>
            </>
          )}
        </Pressable>
      </Surface>
    </ScreenShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatNumber(value: number) {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
}

function formatDecimal(value: number) {
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusCopy: { flex: 1 },
  statusMessage: {
    marginTop: 7,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  dot: {
    width: 12,
    height: 12,
    marginTop: 2,
    borderRadius: 6,
    backgroundColor: colors.textFaint,
  },
  dotActive: {
    backgroundColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  speedArea: {
    marginTop: 22,
    alignItems: 'center',
  },
  speed: {
    color: colors.lime,
    fontFamily: fonts.extraBold,
    fontSize: 84,
    letterSpacing: -5,
    lineHeight: 92,
  },
  unit: {
    marginTop: -7,
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 4,
  },
  maxSpeed: {
    marginTop: 10,
    color: colors.textFaint,
    fontFamily: fonts.semibold,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  metrics: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    flex: 1,
    minHeight: 70,
    paddingHorizontal: 8,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(4,6,4,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    color: colors.textFaint,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  metricValue: {
    marginTop: 6,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  secondaryMetrics: {
    minHeight: 44,
    marginTop: 10,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  secondaryText: {
    color: colors.textFaint,
    fontFamily: fonts.regular,
    fontSize: 10,
  },
  secondaryValue: {
    color: colors.text,
    fontFamily: fonts.bold,
  },
  error: {
    marginTop: 8,
    padding: 11,
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
    fontSize: 10,
    lineHeight: 15,
  },
  action: {
    minHeight: 52,
    marginTop: 10,
    borderRadius: 17,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stopAction: {
    backgroundColor: colors.rose,
  },
  actionText: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  stopActionText: { color: colors.white },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
});
