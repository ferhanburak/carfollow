import * as Location from 'expo-location';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import type { useMapWorld } from '@/hooks/use-map-world';
import {
  completeConvoyRouteSummary,
  recordConvoyRoutePoint,
  startBackgroundConvoyTracking,
  stopBackgroundConvoyTracking,
} from '@/lib/background-convoy';
import type { MapPin } from '@/types/cruiser';

const SYNC_INTERVAL_MS = 5_000;
const REFRESH_INTERVAL_MS = 20_000;
const PREPARE_BEFORE_START_MS = 60_000;

type MapWorld = ReturnType<typeof useMapWorld>;

export function useConvoyTracking(
  userId: string | undefined,
  mapWorld: MapWorld,
) {
  const lastSyncRef = useRef<Record<string, number>>({});
  const lastRefreshRef = useRef(0);
  const syncingRef = useRef(new Set<string>());
  const [clock, setClock] = useState(() => Date.now());

  const eligibleConvoys = useMemo(() => userId
    ? mapWorld.pins.filter((pin) => hasActiveMembership(pin, userId))
    : [], [mapWorld.pins, userId]);
  const trackingSignature = JSON.stringify(eligibleConvoys
    .filter((pin) => shouldTrackConvoy(pin, userId ?? '', clock))
    .map((pin) => ({ id: pin.id, title: pin.name }))
    .sort((a, b) => a.id.localeCompare(b.id)));

  const refreshConvoys = useEffectEvent(() => mapWorld.refreshConvoys());
  const handleLocation = useEffectEvent((position: Location.LocationObject) => {
    if (!userId) return;
    const now = Date.now();
    const trackedConvoys = mapWorld.pins.filter((pin) =>
      shouldTrackConvoy(pin, userId, now),
    );

    trackedConvoys.forEach((convoy) => {
      if (
        syncingRef.current.has(convoy.id)
        || now - Number(lastSyncRef.current[convoy.id] ?? 0) < SYNC_INTERVAL_MS
      ) return;

      syncingRef.current.add(convoy.id);
      lastSyncRef.current[convoy.id] = now;
      void recordConvoyRoutePoint({ id: convoy.id, title: convoy.name }, position);
      void mapWorld.syncConvoyLocation(convoy.id, {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: Math.max(0, Number(position.coords.accuracy ?? 0)),
      }).then(async (result) => {
        if (result.completed) await completeConvoyRouteSummary(convoy.id);
        const stateChanged = (
          result.lifecycleStatus !== convoy.lifecycleStatus
          || result.tripStatus !== convoy.viewerTripStatus
          || Boolean(result.completed)
        );
        if (stateChanged || now - lastRefreshRef.current >= REFRESH_INTERVAL_MS) {
          lastRefreshRef.current = Date.now();
          await mapWorld.refreshConvoys();
        }
      }).catch(() => undefined).finally(() => {
        syncingRef.current.delete(convoy.id);
      });
    });
  });

  useEffect(() => {
    if (!userId || !eligibleConvoys.length) return undefined;
    const timer = setInterval(() => {
      setClock(Date.now());
      void refreshConvoys();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [userId, eligibleConvoys.length]);

  useEffect(() => {
    const trackedConvoys = JSON.parse(trackingSignature) as { id: string; title: string }[];
    if (!userId || !trackedConvoys.length) return undefined;
    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    const start = async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!active || permission.status !== 'granted') return;

      await startBackgroundConvoyTracking(trackedConvoys)
        .catch(() => undefined);
      if (!active) {
        await stopBackgroundConvoyTracking().catch(() => undefined);
        return;
      }

      subscription = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 3,
        timeInterval: 2_000,
        mayShowUserSettingsDialog: true,
      }, handleLocation);
    };

    void start();
    return () => {
      active = false;
      subscription?.remove();
      void stopBackgroundConvoyTracking();
    };
  }, [trackingSignature, userId]);
}

function hasActiveMembership(pin: MapPin, userId: string) {
  if (
    pin.type !== 'meet'
    || pin.eventMode !== 'convoy'
    || !['planning', 'rolling', 'delayed'].includes(pin.lifecycleStatus ?? 'planning')
  ) return false;
  const membership = pin.attendees?.find((driver) => driver.userId === userId);
  return pin.viewerMembershipStatus === 'approved'
    || membership?.membershipStatus === 'approved'
    || Boolean(membership);
}

function shouldTrackConvoy(pin: MapPin, userId: string, now: number) {
  if (
    pin.type !== 'meet'
    || pin.eventMode !== 'convoy'
    || pin.automaticArrivalTracking === false
    || !['planning', 'rolling', 'delayed'].includes(pin.lifecycleStatus ?? 'planning')
  ) return false;

  const membership = pin.attendees?.find((driver) => driver.userId === userId);
  if (!hasActiveMembership(pin, userId)
    || pin.viewerTripStatus === 'cancelled'
    || membership?.tripStatus === 'cancelled') {
    return false;
  }

  if (pin.lifecycleStatus !== 'planning') return true;
  const startsAt = Number(pin.scheduledStartAtMs ?? 0);
  return startsAt > 0 && startsAt - now <= PREPARE_BEFORE_START_MS;
}
