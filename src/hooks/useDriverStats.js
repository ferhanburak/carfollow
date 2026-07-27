import { useEffect, useRef, useState } from "react";
import { mergeDriverStatsIntoUser, normalizeIndividualLeaderboard } from "../domain/driverStats";
import {
  finishFirebaseDriveSession,
  isFirebaseRepositoryEnabled,
  loadFirebaseDriverStatsState,
  startFirebaseDriveSession,
} from "../repositories/cruiserRepository";

function createDriveSessionId(userId) {
  const safeUserId = String(userId ?? "driver").replace(/[^0-9A-Za-z_-]/g, "-").slice(0, 80);
  const randomToken = globalThis.crypto?.randomUUID?.().replaceAll("-", "")
    ?? Math.random().toString(36).slice(2, 14);
  return `ride-${safeUserId}-${Date.now()}-${randomToken}`;
}

function getDriverStatsError(error, fallback) {
  const messages = {
    "functions/failed-precondition": "Güvenli sürüş oturumu baslatilamadi. Vehicle Passport kaydini kontrol et.",
    "functions/not-found": "Sürüş backend Function'i henüz yayınlanmamış.",
    "functions/permission-denied": "Bu sürüş oturumu Firebase hesabinla eşleşmiyor.",
    "functions/unauthenticated": "Güvenli sürüş için yeniden giriş yapman gerekiyor.",
    "cruiser/functions-unavailable": "Firebase Functions bağlantısı hazır değil.",
  };

  return messages[error?.code] ?? (error instanceof Error ? error.message : fallback);
}

function mergePartHealthIntoUser(user, partHealth) {
  if (!user || !Array.isArray(partHealth) || partHealth.length === 0) {
    return user;
  }

  const healthByKey = new Map(partHealth.filter((part) => part?.key).map((part) => [part.key, part]));
  return {
    ...user,
    parts: (user.parts ?? []).map((part) => ({ ...part, ...(healthByKey.get(part.key) ?? {}) })),
  };
}

export function useDriverStats({ user, setUser }) {
  const serverOwned = isFirebaseRepositoryEnabled();
  const loadedUserIdRef = useRef(null);
  const serviceLogCountRef = useRef(null);
  const [leaderboardEntries, setLeaderboardEntries] = useState([]);
  const [driverStatsStatus, setDriverStatsStatus] = useState({
    mode: serverOwned ? "firebase" : "mock",
    state: serverOwned ? "loading" : "mock",
    error: "",
    lastSyncAt: null,
  });

  useEffect(() => {
    if (!user) {
      setLeaderboardEntries([]);
      return undefined;
    }
    if (!serverOwned) {
      setDriverStatsStatus({ mode: "mock", state: "mock", error: "", lastSyncAt: Date.now() });
      return undefined;
    }

    const userId = user.firebaseUid ?? user.id;
    const serviceLogCount = user.serviceLogs?.length ?? 0;
    const forceRefresh = loadedUserIdRef.current === userId
      && serviceLogCountRef.current !== null
      && serviceLogCountRef.current !== serviceLogCount;
    loadedUserIdRef.current = userId;
    serviceLogCountRef.current = serviceLogCount;

    let cancelled = false;
    setDriverStatsStatus((current) => ({ ...current, state: "loading", error: "" }));
    void loadFirebaseDriverStatsState({ forceRefresh })
      .then((result) => {
        if (cancelled || !result) {
          return;
        }
        setLeaderboardEntries(result.leaderboardEntries ?? []);
        if (result.stats) {
          setUser((current) => {
            if (!current || (current.firebaseUid ?? current.id) !== result.authUid) {
              return current;
            }
            return mergePartHealthIntoUser(
              mergeDriverStatsIntoUser(current, result.stats),
              result.partHealth,
            );
          });
        }
        setDriverStatsStatus({
          mode: "firebase",
          state: result.warning ? "degraded" : "synced",
          error: result.warning ?? "",
          lastSyncAt: result.syncedAt,
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setDriverStatsStatus({
            mode: "firebase",
            state: "error",
            error: getDriverStatsError(error, "Sürücü istatistikleri yüklenemedi."),
            lastSyncAt: null,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    serverOwned,
    setUser,
    user?.firebaseUid,
    user?.id,
    user?.serviceLogs?.length,
  ]);

  const startDriveSession = async () => {
    if (!serverOwned) {
      return {
        ok: true,
        mode: "mock",
        resumed: false,
        sessionId: createDriveSessionId(user?.id),
        status: "active",
      };
    }

    setDriverStatsStatus((current) => ({ ...current, state: "starting", error: "" }));
    try {
      const result = await startFirebaseDriveSession(createDriveSessionId(user?.firebaseUid ?? user?.id));
      if (result?.stats) {
        setUser((current) => mergeDriverStatsIntoUser(current, result.stats));
      }
      if (result?.leaderboardEntry) {
        setLeaderboardEntries((current) => [
          ...current.filter((entry) => entry.id !== result.leaderboardEntry.id),
          result.leaderboardEntry,
        ]);
      }
      setDriverStatsStatus({ mode: "firebase", state: "active", error: "", lastSyncAt: Date.now() });
      return { ok: true, ...result };
    } catch (error) {
      const message = getDriverStatsError(error, "Güvenli sürüş oturumu baslatilamadi.");
      setDriverStatsStatus({ mode: "firebase", state: "error", error: message, lastSyncAt: null });
      return { ok: false, error: message };
    }
  };

  const finishDriveSession = async ({
    acceptedSampleCount,
    qualifiedSpeedSampleCount,
    reportedKm,
    reportedMaxSpeedKmh,
    reportedMovingSeconds,
    sessionId,
  }) => {
    const driveSummary = {
      acceptedSampleCount,
      qualifiedSpeedSampleCount,
      reportedKm,
      reportedMaxSpeedKmh,
      reportedMovingSeconds,
    };
    if (!serverOwned) {
      return {
        ok: true,
        mode: "mock",
        sessionId,
        acceptedKm: Number(reportedKm ?? 0),
        averageSpeedKmh: Number(reportedMovingSeconds) > 0
          ? Number(((Number(reportedKm ?? 0) / Number(reportedMovingSeconds)) * 3600).toFixed(1))
          : 0,
        maxSpeedKmh: Number(reportedMaxSpeedKmh ?? 0),
        movingSeconds: Number(reportedMovingSeconds ?? 0),
        rejectedKm: 0,
        rejectedMovingSeconds: 0,
      };
    }

    setDriverStatsStatus((current) => ({ ...current, state: "finalizing", error: "" }));
    try {
      const result = await finishFirebaseDriveSession(sessionId, driveSummary);
      setUser((current) => {
        const merged = mergeDriverStatsIntoUser(current, result?.stats);
        const authoritativeUser = merged
          ? { ...merged, odometer: Number(result?.odometer ?? merged.odometer ?? 0) }
          : merged;
        return mergePartHealthIntoUser(authoritativeUser, result?.partHealth);
      });
      if (result?.leaderboardEntry) {
        setLeaderboardEntries((current) => [
          ...current.filter((entry) => entry.id !== result.leaderboardEntry.id),
          result.leaderboardEntry,
        ]);
      }
      setDriverStatsStatus({ mode: "firebase", state: "synced", error: "", lastSyncAt: Date.now() });
      return { ok: true, ...result };
    } catch (error) {
      const message = getDriverStatsError(error, "Sürüş oturumu tamamlanamadi.");
      setDriverStatsStatus({ mode: "firebase", state: "error", error: message, lastSyncAt: null });
      return { ok: false, error: message };
    }
  };

  return {
    driverStatsStatus,
    finishDriveSession,
    individualLeaderboard: serverOwned
      ? normalizeIndividualLeaderboard(leaderboardEntries, user)
      : null,
    serverOwnedDriverStats: serverOwned,
    startDriveSession,
  };
}
