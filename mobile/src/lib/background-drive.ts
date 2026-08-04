import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import {
  createDriveMetrics,
  processGpsPosition,
  stabilizeDisplayedSpeed,
  updateDriveMetrics,
  type DisplayedSpeed,
  type DriveMetrics,
  type GpsPoint,
} from '@/lib/drive-telemetry';
import { localizeCopy } from '@/i18n/copy-catalog';
import { getPreferredLanguage } from '@/i18n/language-runtime';
import { appendRoutePoint, type RoutePoint } from '@/lib/route-summary';
import { updateDriveForegroundNotification } from 'tracksnap-drive-notification';

export const BACKGROUND_DRIVE_TASK = 'tracksnap-background-drive';

const DRIVE_SESSION_STORAGE_KEY = '@tracksnap/active-drive-v1';
const DRIVE_NOTIFICATION_ID = 'tracksnap-active-drive';
const NOTIFICATION_UPDATE_INTERVAL_MS = 5_000;

export type BackgroundDriveSnapshot = {
  accuracy: number | null;
  currentSpeedKmh: number;
  displayedSpeed: DisplayedSpeed | null;
  lastNotificationAt: number;
  location: { lat: number; lng: number; accuracy: number } | null;
  metrics: DriveMetrics;
  point: GpsPoint | null;
  routePoints: RoutePoint[];
  sessionId: string;
  startedAt: number;
  statusMessage: string;
  updatedAt: number;
  userId: string;
  version: 1;
};

type BackgroundLocationTaskData = {
  locations?: Location.LocationObject[];
};

type SnapshotListener = (snapshot: BackgroundDriveSnapshot) => void;

const snapshotListeners = new Set<SnapshotListener>();

function createSnapshot(sessionId: string, userId: string): BackgroundDriveSnapshot {
  const now = Date.now();
  return {
    accuracy: null,
    currentSpeedKmh: 0,
    displayedSpeed: null,
    lastNotificationAt: 0,
    location: null,
    metrics: createDriveMetrics(),
    point: null,
    routePoints: [],
    sessionId,
    startedAt: now,
    statusMessage: 'Arka plan GPS takibi aktif.',
    updatedAt: now,
    userId,
    version: 1,
  };
}

function isDriveSnapshot(value: unknown): value is BackgroundDriveSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<BackgroundDriveSnapshot>;
  return (
    snapshot.version === 1
    && typeof snapshot.sessionId === 'string'
    && typeof snapshot.userId === 'string'
    && Number.isFinite(snapshot.startedAt)
    && Boolean(snapshot.metrics)
  );
}

function emitSnapshot(snapshot: BackgroundDriveSnapshot) {
  snapshotListeners.forEach((listener) => listener(snapshot));
}

async function persistSnapshot(snapshot: BackgroundDriveSnapshot) {
  await AsyncStorage.setItem(DRIVE_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  emitSnapshot(snapshot);
}

function formatNotificationDuration(startedAt: number, language: 'tr' | 'en') {
  const totalMinutes = Math.max(0, Math.floor((Date.now() - startedAt) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (language === 'en') return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;
  return hours > 0 ? `${hours} sa ${minutes} dk` : `${minutes} dk`;
}

function formatNotificationDistance(distanceKm: number, language: 'tr' | 'en') {
  return Math.max(0, distanceKm).toLocaleString(language === 'en' ? 'en-US' : 'tr-TR', {
    minimumFractionDigits: distanceKm < 1 ? 2 : 1,
    maximumFractionDigits: distanceKm < 1 ? 2 : 1,
  });
}

async function updateDriveNotification(snapshot: BackgroundDriveSnapshot) {
  if (Platform.OS !== 'android') return;
  const language = await getPreferredLanguage();
  const speedUnit = language === 'en' ? 'km/h' : 'km/sa';
  const speed = Math.round(snapshot.currentSpeedKmh);
  const distance = formatNotificationDistance(snapshot.metrics.sessionKm, language);
  const duration = formatNotificationDuration(snapshot.startedAt, language);
  const averageSpeed = Math.round(snapshot.metrics.averageSpeedKmh);
  const maxSpeed = Math.round(snapshot.metrics.maxSpeedKmh);
  const accuracy = snapshot.accuracy == null ? '--' : Math.round(snapshot.accuracy);
  const summary = `${speed} ${speedUnit} · ${distance} km · ${duration}`;
  const details = language === 'en'
    ? `Current speed: ${speed} ${speedUnit}\nDistance: ${distance} km · Duration: ${duration}\nAverage: ${averageSpeed} ${speedUnit} · Maximum: ${maxSpeed} ${speedUnit}\nGPS accuracy: ±${accuracy} m`
    : `Anlık hız: ${speed} ${speedUnit}\nMesafe: ${distance} km · Süre: ${duration}\nOrtalama: ${averageSpeed} ${speedUnit} · Maksimum: ${maxSpeed} ${speedUnit}\nGPS doğruluğu: ±${accuracy} m`;

  await updateDriveForegroundNotification(
    localizeCopy('TrackSnap · Sürüş modu aktif', language),
    summary,
    details,
  );
}

async function consumeLocations(locations: Location.LocationObject[]) {
  const current = await readBackgroundDriveSnapshot();
  if (!current || locations.length === 0) return;

  let next = current;
  const orderedLocations = [...locations].sort((a, b) => a.timestamp - b.timestamp);
  orderedLocations.forEach((position) => {
    const reading = processGpsPosition(next.point, position);
    const displayedSpeed = stabilizeDisplayedSpeed(next.displayedSpeed, reading);
    next = {
      ...next,
      accuracy: reading.accuracy ?? next.accuracy,
      currentSpeedKmh: displayedSpeed.speedKmh,
      displayedSpeed,
      location: reading.location ?? next.location,
      metrics: updateDriveMetrics(next.metrics, reading),
      point: reading.accepted ? reading.nextPoint : next.point,
      routePoints: reading.accepted && reading.location
        ? appendRoutePoint(next.routePoints, {
          accuracy: reading.accuracy ?? undefined,
          lat: reading.location.lat,
          lng: reading.location.lng,
          timestamp: position.timestamp,
        })
        : next.routePoints,
      statusMessage: reading.gpsStatus === 'weak'
        ? 'GPS doğruluğu zayıf; bu örnek mesafeye eklenmedi.'
        : reading.gpsStatus === 'error'
          ? 'GPS örneği doğrulanamadı.'
          : 'Arka plan GPS takibi aktif.',
      updatedAt: Date.now(),
    };
  });

  const shouldUpdateNotification = (
    Date.now() - next.lastNotificationAt >= NOTIFICATION_UPDATE_INTERVAL_MS
  );
  if (shouldUpdateNotification) {
    next = { ...next, lastNotificationAt: Date.now() };
  }
  await persistSnapshot(next);
  if (shouldUpdateNotification) await updateDriveNotification(next);
}

if (!TaskManager.isTaskDefined(BACKGROUND_DRIVE_TASK)) {
  TaskManager.defineTask<BackgroundLocationTaskData>(
    BACKGROUND_DRIVE_TASK,
    async ({ data, error }) => {
      if (error) {
        const snapshot = await readBackgroundDriveSnapshot();
        if (snapshot) {
          await persistSnapshot({
            ...snapshot,
            statusMessage: 'Arka plan GPS takibinde geçici bir hata oluştu.',
            updatedAt: Date.now(),
          });
        }
        return;
      }
      await consumeLocations(Array.isArray(data?.locations) ? data.locations : []);
    },
  );
}

export async function readBackgroundDriveSnapshot() {
  const stored = await AsyncStorage.getItem(DRIVE_SESSION_STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    return isDriveSnapshot(parsed)
      ? { ...parsed, routePoints: Array.isArray(parsed.routePoints) ? parsed.routePoints : [] }
      : null;
  } catch {
    return null;
  }
}

export function subscribeToBackgroundDrive(listener: SnapshotListener) {
  snapshotListeners.add(listener);
  return () => snapshotListeners.delete(listener);
}

export async function isBackgroundDriveRunning() {
  return Location.hasStartedLocationUpdatesAsync(BACKGROUND_DRIVE_TASK);
}

export async function startBackgroundDrive(sessionId: string, userId: string) {
  const language = await getPreferredLanguage();
  const snapshot = createSnapshot(sessionId, userId);
  await persistSnapshot(snapshot);
  if (Platform.OS === 'android') {
    await Notifications.dismissNotificationAsync(DRIVE_NOTIFICATION_ID).catch(() => undefined);
    await Notifications.cancelScheduledNotificationAsync(DRIVE_NOTIFICATION_ID)
      .catch(() => undefined);
  }

  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_DRIVE_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      activityType: Location.ActivityType.AutomotiveNavigation,
      distanceInterval: 1,
      timeInterval: 1_000,
      deferredUpdatesDistance: 0,
      deferredUpdatesInterval: 1_000,
      mayShowUserSettingsDialog: true,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: Platform.OS === 'android'
        ? {
          notificationTitle: localizeCopy('TrackSnap · Sürüş modu aktif', language),
          notificationBody: language === 'en'
            ? '0 km/h · 0.00 km · 0 min'
            : '0 km/sa · 0,00 km · 0 dk',
          killServiceOnDestroy: false,
        }
        : undefined,
    });
    await updateDriveNotification(snapshot);
    return snapshot;
  } catch (error) {
    await clearBackgroundDrive();
    throw error;
  }
}

export async function stopBackgroundDrive() {
  const running = await isBackgroundDriveRunning();
  if (running) await Location.stopLocationUpdatesAsync(BACKGROUND_DRIVE_TASK);
  if (Platform.OS === 'android') {
    await Notifications.dismissNotificationAsync(DRIVE_NOTIFICATION_ID).catch(() => undefined);
    await Notifications.cancelScheduledNotificationAsync(DRIVE_NOTIFICATION_ID)
      .catch(() => undefined);
  }
}

export async function clearBackgroundDrive() {
  await stopBackgroundDrive().catch(() => undefined);
  await AsyncStorage.removeItem(DRIVE_SESSION_STORAGE_KEY);
}
