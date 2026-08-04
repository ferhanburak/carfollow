import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { onAuthStateChanged } from 'firebase/auth';
import { Platform } from 'react-native';

import { firebaseAuth } from '@/lib/firebase';
import { callFirebase } from '@/lib/firebase-callable';

export const BACKGROUND_CONVOY_TASK = 'tracksnap-background-convoy';

const CONVOY_STORAGE_KEY = '@tracksnap/active-convoys-v1';

type BackgroundConvoyState = {
  convoyIds: string[];
  version: 1;
};

type BackgroundLocationTaskData = {
  locations?: Location.LocationObject[];
};

async function readState(): Promise<BackgroundConvoyState | null> {
  const stored = await AsyncStorage.getItem(CONVOY_STORAGE_KEY);
  if (!stored) return null;
  try {
    const value = JSON.parse(stored) as Partial<BackgroundConvoyState>;
    if (value.version !== 1 || !Array.isArray(value.convoyIds)) return null;
    return {
      version: 1,
      convoyIds: [...new Set(value.convoyIds.filter((id): id is string => Boolean(id)))],
    };
  } catch {
    return null;
  }
}

async function waitForAuthenticatedUser() {
  if (firebaseAuth.currentUser) return true;
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, 5_000);
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(true);
    });
  });
}

async function consumeLocations(locations: Location.LocationObject[]) {
  const state = await readState();
  if (!state?.convoyIds.length || locations.length === 0) return;
  if (!await waitForAuthenticatedUser()) return;

  const position = locations.reduce((latest, item) =>
    item.timestamp > latest.timestamp ? item : latest,
  );
  const location = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: Math.max(0, Number(position.coords.accuracy ?? 0)),
  };

  const results = await Promise.allSettled(state.convoyIds.map(async (convoyId) => ({
    convoyId,
    result: await callFirebase<{
      completed?: boolean;
      lifecycleStatus?: string;
      tripStatus?: string;
    }>('syncConvoyLocation', { convoyId, ...location }),
  })));
  const completedIds = new Set(results.flatMap((entry) =>
    entry.status === 'fulfilled'
      && (entry.value.result.completed || entry.value.result.tripStatus === 'cancelled')
      ? [entry.value.convoyId]
      : [],
  ));
  if (!completedIds.size) return;

  await AsyncStorage.setItem(CONVOY_STORAGE_KEY, JSON.stringify({
    version: 1,
    convoyIds: state.convoyIds.filter((id) => !completedIds.has(id)),
  } satisfies BackgroundConvoyState));
  if (completedIds.size === state.convoyIds.length) {
    await stopBackgroundConvoyTracking();
  }
}

if (!TaskManager.isTaskDefined(BACKGROUND_CONVOY_TASK)) {
  TaskManager.defineTask<BackgroundLocationTaskData>(
    BACKGROUND_CONVOY_TASK,
    async ({ data, error }) => {
      if (error) return;
      await consumeLocations(Array.isArray(data?.locations) ? data.locations : [])
        .catch(() => undefined);
    },
  );
}

export async function startBackgroundConvoyTracking(convoyIds: string[]) {
  const uniqueIds = [...new Set(convoyIds.filter(Boolean))];
  await AsyncStorage.setItem(CONVOY_STORAGE_KEY, JSON.stringify({
    version: 1,
    convoyIds: uniqueIds,
  } satisfies BackgroundConvoyState));
  if (!uniqueIds.length) {
    await stopBackgroundConvoyTracking();
    return;
  }

  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_CONVOY_TASK);
  if (running) return;
  await Location.startLocationUpdatesAsync(BACKGROUND_CONVOY_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    activityType: Location.ActivityType.AutomotiveNavigation,
    distanceInterval: 3,
    timeInterval: 5_000,
    deferredUpdatesDistance: 0,
    deferredUpdatesInterval: 5_000,
    mayShowUserSettingsDialog: true,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: Platform.OS === 'android'
      ? {
        notificationTitle: 'TrackSnap · Konvoy takibi aktif',
        notificationBody: 'Konvoy ilerlemesi ve varış durumu GPS ile güncelleniyor.',
        notificationColor: '#a3e635',
        killServiceOnDestroy: false,
      }
      : undefined,
  });
}

export async function stopBackgroundConvoyTracking() {
  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_CONVOY_TASK);
  if (running) await Location.stopLocationUpdatesAsync(BACKGROUND_CONVOY_TASK);
  await AsyncStorage.removeItem(CONVOY_STORAGE_KEY);
}
