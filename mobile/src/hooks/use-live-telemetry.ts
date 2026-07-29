import * as Location from 'expo-location';
import { onValue, ref } from 'firebase/database';
import { useEffect, useMemo, useState } from 'react';

import { realtimeDb } from '@/lib/firebase';
import { realtimeTelemetryPath } from '@/lib/firebase-paths';
import { useAuth } from '@/providers/auth-provider';
import { useSocialWorld } from '@/hooks/use-social-world';

export type LiveDriver = {
  userId: string;
  latitude: number;
  longitude: number;
  speed: number;
  plate: string;
  model?: string;
  relation: 'self' | 'friend' | 'clan' | 'other';
  updatedAt: number;
};

export function useLiveTelemetry() {
  const { profile, user } = useAuth();
  const social = useSocialWorld();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [telemetry, setTelemetry] = useState<Record<string, Record<string, unknown>>>({});
  const [permission, setPermission] = useState<'loading' | 'granted' | 'denied'>('loading');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    void Location.requestForegroundPermissionsAsync().then(async (result) => {
      if (result.status !== 'granted') {
        setPermission('denied');
        return;
      }
      setPermission('granted');
      setLocation(await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }));
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: 2500,
        },
        setLocation,
      );
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => onValue(
    ref(realtimeDb, realtimeTelemetryPath()),
    (snapshot) => setTelemetry(snapshot.val() ?? {}),
  ), []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, []);

  const drivers = useMemo<LiveDriver[]>(() => {
    const friendIds = new Set(social.friends.map((driver) => driver.userId));
    const clanIds = new Set(social.members.map((member) => member.userId));
    return Object.entries(telemetry).flatMap(([userId, value]) => {
      const latitude = Number(value.lat);
      const longitude = Number(value.lng);
      const updatedAt = Number(value.updatedAt ?? 0);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      if (now - updatedAt > 120_000 || value.active === false) return [];
      return [{
        userId,
        latitude,
        longitude,
        speed: Number(value.speed ?? 0),
        plate: String(value.plate ?? ''),
        model: String(value.model ?? ''),
        relation: userId === user?.uid
          ? 'self' as const
          : friendIds.has(userId)
            ? 'friend' as const
            : clanIds.has(userId)
              ? 'clan' as const
              : 'other' as const,
        updatedAt,
      }];
    });
  }, [now, social.friends, social.members, telemetry, user?.uid]);

  const ownDriver: LiveDriver | null = location && user
    ? {
        userId: user.uid,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        speed: Math.max(0, Number(location.coords.speed ?? 0) * 3.6),
        plate: profile?.plate ?? '',
        model: profile?.model,
        relation: 'self',
        updatedAt: location.timestamp,
      }
    : null;

  return {
    location,
    permission,
    drivers: ownDriver
      ? [ownDriver, ...drivers.filter((driver) => driver.userId !== ownDriver.userId)]
      : drivers,
  };
}
