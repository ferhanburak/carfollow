import { useEffect, useState } from "react";
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
    "functions/failed-precondition": "Guvenli surus oturumu baslatilamadi. Vehicle Passport kaydini kontrol et.",
    "functions/not-found": "Surus backend Function'i henuz yayinlanmamis.",
    "functions/permission-denied": "Bu surus oturumu Firebase hesabinla eslesmiyor.",
    "functions/unauthenticated": "Guvenli surus icin yeniden giris yapman gerekiyor.",
    "cruiser/functions-unavailable": "Firebase Functions baglantisi hazir degil.",
  };

  return messages[error?.code] ?? (error instanceof Error ? error.message : fallback);
}

export function useDriverStats({ user, setUser }) {
  const serverOwned = isFirebaseRepositoryEnabled();
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

    let cancelled = false;
    setDriverStatsStatus((current) => ({ ...current, state: "loading", error: "" }));
    void loadFirebaseDriverStatsState()
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
            return mergeDriverStatsIntoUser(current, result.stats);
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
            error: getDriverStatsError(error, "Surucu istatistikleri yuklenemedi."),
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
    user?.driverScore,
    user?.firebaseUid,
    user?.harmonyVotes,
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
      const message = getDriverStatsError(error, "Guvenli surus oturumu baslatilamadi.");
      setDriverStatsStatus({ mode: "firebase", state: "error", error: message, lastSyncAt: null });
      return { ok: false, error: message };
    }
  };

  const finishDriveSession = async ({ sessionId, reportedKm }) => {
    if (!serverOwned) {
      return {
        ok: true,
        mode: "mock",
        sessionId,
        acceptedKm: Number(reportedKm ?? 0),
        rejectedKm: 0,
      };
    }

    setDriverStatsStatus((current) => ({ ...current, state: "finalizing", error: "" }));
    try {
      const result = await finishFirebaseDriveSession(sessionId, reportedKm);
      setUser((current) => {
        const merged = mergeDriverStatsIntoUser(current, result?.stats);
        return merged ? { ...merged, odometer: Number(result?.odometer ?? merged.odometer ?? 0) } : merged;
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
      const message = getDriverStatsError(error, "Surus oturumu tamamlanamadi.");
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
