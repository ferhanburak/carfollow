import { useEffect, useMemo, useRef, useState } from "react";
import { isFirebaseMapRepositoryEnabled, syncFirebaseConvoyLocation } from "../repositories/firebaseMapRepository";

const SYNC_INTERVAL_MS = 8_000;

function isApprovedAttendee(convoy, user) {
  return (convoy?.attendees ?? []).some((attendee) =>
    (attendee.userId && attendee.userId === user?.firebaseUid) || attendee.plate === user?.plate);
}

export function getTrackableConvoys(mapPins, user, nowMs = Date.now()) {
  if (!user) return [];
  return (mapPins ?? []).filter((convoy) => {
    if (convoy.type !== "meet" || !Array.isArray(convoy.routePath) || convoy.routePath.length < 2) return false;
    if (!["planning", "rolling", "delayed"].includes(convoy.lifecycleStatus ?? "planning")) return false;
    if (!isApprovedAttendee(convoy, user)) return false;
    if (["rolling", "delayed"].includes(convoy.lifecycleStatus)) return true;
    return Number(convoy.scheduledStartAtMs ?? 0) > 0 && Number(convoy.scheduledStartAtMs) <= nowMs;
  });
}

export function useConvoyTracking({ mapPins, user, onRefreshConvoys }) {
  const [clock, setClock] = useState(Date.now());
  const [tracking, setTracking] = useState({ status: "idle", convoyId: null, error: "" });
  const syncLockRef = useRef(false);
  const refreshRef = useRef(onRefreshConvoys);

  useEffect(() => {
    refreshRef.current = onRefreshConvoys;
  }, [onRefreshConvoys]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const trackableConvoys = useMemo(
    () => getTrackableConvoys(mapPins, user, clock).slice(0, 3),
    [clock, mapPins, user],
  );
  const trackingKey = trackableConvoys.map((convoy) => convoy.id).join("|");

  useEffect(() => {
    if (!isFirebaseMapRepositoryEnabled() || !user?.firebaseUid || !trackingKey) {
      setTracking((current) => current.status === "idle" ? current : { status: "idle", convoyId: null, error: "" });
      return undefined;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setTracking({ status: "unsupported", convoyId: null, error: "Bu cihaz GPS takibini desteklemiyor." });
      return undefined;
    }

    let cancelled = false;
    let latestLocation = null;
    let lastSyncAt = 0;
    setTracking({ status: "requesting", convoyId: trackableConvoys[0]?.id ?? null, error: "" });

    const syncLocation = async () => {
      if (cancelled || syncLockRef.current || !latestLocation || Date.now() - lastSyncAt < SYNC_INTERVAL_MS) return;
      syncLockRef.current = true;
      lastSyncAt = Date.now();
      try {
        const results = await Promise.all(trackableConvoys.map((convoy) =>
          syncFirebaseConvoyLocation(convoy.id, latestLocation)));
        if (cancelled) return;
        const primary = results[0] ?? {};
        setTracking({
          status: primary.completed ? "completed" : primary.tripStatus === "arrived" ? "arrived" : "tracking",
          convoyId: primary.convoyId ?? trackableConvoys[0]?.id ?? null,
          lifecycleStatus: primary.lifecycleStatus,
          tripStatus: primary.tripStatus,
          distanceToDestinationM: primary.distanceToDestinationM,
          error: "",
        });
        await refreshRef.current?.();
      } catch (error) {
        if (!cancelled) {
          setTracking({
            status: "error",
            convoyId: trackableConvoys[0]?.id ?? null,
            error: error instanceof Error ? error.message : "Konvoy konumu senkronize edilemedi.",
          });
        }
      } finally {
        syncLockRef.current = false;
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        latestLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        void syncLocation();
      },
      (error) => {
        if (!cancelled) setTracking({ status: "blocked", convoyId: null, error: error.message || "GPS izni reddedildi." });
      },
      { enableHighAccuracy: true, maximumAge: 3_000, timeout: 10_000 },
    );
    const syncTimer = window.setInterval(() => void syncLocation(), SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(syncTimer);
      navigator.geolocation.clearWatch(watchId);
      syncLockRef.current = false;
    };
  }, [trackingKey, user?.firebaseUid]);

  return tracking;
}
