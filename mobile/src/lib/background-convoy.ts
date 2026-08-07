import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { onAuthStateChanged } from 'firebase/auth';

import { firebaseAuth } from '@/lib/firebase';
import { callFirebase } from '@/lib/firebase-callable';
import {
  appendRoutePoint,
  calculateRouteDistanceKm,
  saveRouteSummary,
  type RoutePoint,
} from '@/lib/route-summary';

export const BACKGROUND_CONVOY_TASK = 'tracksnap-background-convoy';

const CONVOY_STORAGE_KEY = '@tracksnap/active-convoys-v1';
const finalizingConvoys = new Set<string>();
let stateWriteQueue: Promise<unknown> = Promise.resolve();

type BackgroundConvoyState = {
  convoyIds: string[];
  sessions: Record<string, ConvoyRouteSession>;
  version: 1;
};

type ConvoyRouteSession = {
  id: string;
  maxSpeedKmh: number;
  points: RoutePoint[];
  startedAt: number;
  title: string;
};

export type TrackedConvoy = {
  id: string;
  title: string;
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
      sessions: value.sessions && typeof value.sessions === 'object' ? value.sessions : {},
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

  await Promise.all(state.convoyIds.map((convoyId) => recordConvoyRoutePoint(
    { id: convoyId, title: state.sessions[convoyId]?.title || 'Konvoy Sürüşü' },
    position,
  )));

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

  await Promise.all([...completedIds].map((convoyId) => completeConvoyRouteSummary(convoyId)));

  const latestState = await readState();
  if (latestState) {
    await AsyncStorage.setItem(CONVOY_STORAGE_KEY, JSON.stringify({
      ...latestState,
      convoyIds: latestState.convoyIds.filter((id) => !completedIds.has(id)),
    } satisfies BackgroundConvoyState));
  }
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

export async function prepareConvoyTracking(convoys: TrackedConvoy[]) {
  const uniqueConvoys = [...new Map(
    convoys.filter((item) => item.id).map((item) => [item.id, item]),
  ).values()];
  const uniqueIds = uniqueConvoys.map((item) => item.id);
  const previous = await readState();
  const now = Date.now();
  const sessions = { ...(previous?.sessions ?? {}) };
  uniqueConvoys.forEach((convoy) => {
    sessions[convoy.id] ??= {
      id: convoy.id,
      maxSpeedKmh: 0,
      points: [],
      startedAt: now,
      title: convoy.title || 'Konvoy Sürüşü',
    };
  });
  await AsyncStorage.setItem(CONVOY_STORAGE_KEY, JSON.stringify({
    version: 1,
    convoyIds: uniqueIds,
    sessions,
  } satisfies BackgroundConvoyState));
  if (!uniqueIds.length) {
    await stopBackgroundConvoyTracking();
  }
}

export async function stopBackgroundConvoyTracking() {
  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_CONVOY_TASK);
  if (running) await Location.stopLocationUpdatesAsync(BACKGROUND_CONVOY_TASK);
  await AsyncStorage.removeItem(CONVOY_STORAGE_KEY);
}

export function recordConvoyRoutePoint(
  convoy: TrackedConvoy,
  position: Location.LocationObject,
) {
  const operation = stateWriteQueue.then(async () => {
    const state = await readState();
    if (!state || !state.convoyIds.includes(convoy.id)) return;
    const current = state.sessions[convoy.id] ?? {
      id: convoy.id,
      maxSpeedKmh: 0,
      points: [],
      startedAt: Date.now(),
      title: convoy.title || 'Konvoy Sürüşü',
    };
    const speedKmh = Math.max(0, Number(position.coords.speed ?? 0) * 3.6);
    const nextSession: ConvoyRouteSession = {
      ...current,
      maxSpeedKmh: Math.max(current.maxSpeedKmh, speedKmh),
      points: appendRoutePoint(current.points, {
        accuracy: Math.max(0, Number(position.coords.accuracy ?? 0)),
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        timestamp: position.timestamp,
      }),
      title: convoy.title || current.title,
    };
    await AsyncStorage.setItem(CONVOY_STORAGE_KEY, JSON.stringify({
      ...state,
      sessions: { ...state.sessions, [convoy.id]: nextSession },
    } satisfies BackgroundConvoyState));
  });
  stateWriteQueue = operation.catch(() => undefined);
  return operation;
}

export async function completeConvoyRouteSummary(convoyId: string) {
  if (finalizingConvoys.has(convoyId)) return null;
  finalizingConvoys.add(convoyId);
  try {
    await stateWriteQueue;
    const state = await readState();
    const session = state?.sessions[convoyId];
    if (!state || !session) return null;
    const endedAt = Date.now();
    const durationSeconds = Math.max(0, Math.round((endedAt - session.startedAt) / 1_000));
    const distanceKm = calculateRouteDistanceKm(session.points);
    const averageSpeedKmh = durationSeconds > 0 ? distanceKm / (durationSeconds / 3_600) : 0;
    const summary = await saveRouteSummary({
      averageSpeedKmh,
      distanceKm,
      durationSeconds,
      endedAt,
      id: `convoy-${convoyId}-${session.startedAt}`,
      kind: 'convoy',
      maxSpeedKmh: session.maxSpeedKmh,
      points: session.points,
      startedAt: session.startedAt,
      title: session.title,
    });
    const sessions = { ...state.sessions };
    delete sessions[convoyId];
    await AsyncStorage.setItem(CONVOY_STORAGE_KEY, JSON.stringify({
      ...state,
      convoyIds: state.convoyIds.filter((id) => id !== convoyId),
      sessions,
    } satisfies BackgroundConvoyState));
    return summary;
  } finally {
    finalizingConvoys.delete(convoyId);
  }
}
