import { startTransition, useEffect, useRef, useState } from "react";
import {
  advanceConvoySimulation,
  buildDriveTickState,
  incrementClanKm,
  incrementUserOdometer,
} from "../repositories/cruiserRepository";

export function useDriveSession({
  user,
  setUser,
  setClans,
  setMapPins,
  onTelemetrySync,
  onSessionStart,
  onSessionFinish,
  serverOwnedDriverStats = false,
}) {
  const [isDriving, setIsDriving] = useState(false);
  const [driveHud, setDriveHud] = useState({ speed: 0, sessionKm: 0, etaNode: "Hazir" });
  const [driveSessionId, setDriveSessionId] = useState(null);
  const [driveSessionStatus, setDriveSessionStatus] = useState("idle");
  const [driveSessionFeedback, setDriveSessionFeedback] = useState("");
  const [driveSessionPending, setDriveSessionPending] = useState(false);
  const userRef = useRef(user);
  const telemetrySyncRef = useRef(onTelemetrySync);
  const actionLockRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    telemetrySyncRef.current = onTelemetrySync;
  }, [onTelemetrySync]);

  useEffect(() => {
    if (!isDriving || !userRef.current) {
      return;
    }

    telemetrySyncRef.current?.({
      active: true,
      plate: userRef.current.plate,
      vehicle: userRef.current.model,
      node: driveHud.etaNode,
      speed: driveHud.speed,
    });
  }, [driveHud.etaNode, driveHud.speed, isDriving]);

  useEffect(() => {
    if (!isDriving || !userRef.current) {
      return undefined;
    }

    const driveTimer = window.setInterval(() => {
      startTransition(() => {
        setDriveHud((current) => {
          const nextDriveHud = buildDriveTickState(current);
          setMapPins?.((currentPins) => advanceConvoySimulation(currentPins, nextDriveHud, userRef.current));
          return nextDriveHud;
        });

        setUser((current) => {
          if (!current) {
            return current;
          }

          return incrementUserOdometer(current, {
            incrementMonthlyKm: !serverOwnedDriverStats,
          });
        });

        if (!serverOwnedDriverStats) {
          setClans((current) => incrementClanKm(current, userRef.current?.clan));
        }
      });
    }, 1000);

    return () => window.clearInterval(driveTimer);
  }, [isDriving, serverOwnedDriverStats, setClans, setMapPins, setUser]);

  const toggleDrive = async () => {
    if (!user || actionLockRef.current) {
      return null;
    }

    actionLockRef.current = true;
    setDriveSessionPending(true);

    try {
      if (!isDriving) {
        setDriveSessionStatus("starting");
        setDriveSessionFeedback(
          serverOwnedDriverStats
            ? "Guvenli surus oturumu Firebase backend'de aciliyor..."
            : "Surus simulasyonu hazirlaniyor...",
        );
        const result = onSessionStart
          ? await onSessionStart({ user })
          : { ok: true, sessionId: `local-${Date.now()}`, status: "active" };
        if (result?.ok === false) {
          setDriveSessionStatus("error");
          setDriveSessionFeedback(result.error ?? "Surus oturumu baslatilamadi.");
          return result;
        }

        setDriveSessionId(result.sessionId);
        setDriveSessionStatus("active");
        setDriveSessionFeedback(
          result.resumed
            ? "Acik surus oturumuna yeniden baglanildi."
            : serverOwnedDriverStats
              ? "Sunucu kontrollu surus kaydi aktif."
              : "Surus simulasyonu aktif.",
        );
        if (!result.resumed) {
          setDriveHud({ speed: 0, sessionKm: 0, etaNode: "Hazir" });
        }
        setIsDriving(true);
      } else {
        setIsDriving(false);
        setDriveSessionStatus("finalizing");
        setDriveSessionFeedback("Surus mesafesi dogrulaniyor ve siralamaya isleniyor...");
        const result = onSessionFinish
          ? await onSessionFinish({ sessionId: driveSessionId, reportedKm: driveHud.sessionKm })
          : { ok: true, acceptedKm: driveHud.sessionKm, rejectedKm: 0 };
        if (result?.ok === false) {
          setIsDriving(true);
          setDriveSessionStatus("error");
          setDriveSessionFeedback(`${result.error} Suruse devam edip yeniden deneyebilirsin.`);
          return result;
        }

        const acceptedKm = Number(result.acceptedKm ?? driveHud.sessionKm ?? 0);
        const rejectedKm = Number(result.rejectedKm ?? 0);
        setDriveSessionId(null);
        setDriveSessionStatus("completed");
        setDriveSessionFeedback(
          rejectedKm > 0
            ? `${acceptedKm.toFixed(1)} KM onaylandi; ${rejectedKm.toFixed(1)} KM zaman siniri nedeniyle sayilmadi.`
            : `${acceptedKm.toFixed(1)} KM onaylandi ve aylik siralamaya eklendi.`,
        );
        await telemetrySyncRef.current?.({
          active: false,
          plate: user.plate,
          vehicle: user.model,
          node: driveHud.etaNode,
          speed: 0,
        });
      }
      return { ok: true };
    } finally {
      actionLockRef.current = false;
      setDriveSessionPending(false);
    }
  };

  const resetDriveSession = () => {
    if (userRef.current) {
      telemetrySyncRef.current?.({
        active: false,
        plate: userRef.current.plate,
        vehicle: userRef.current.model,
        node: "Hazir",
        speed: 0,
      });
    }
    setIsDriving(false);
    setDriveHud({ speed: 0, sessionKm: 0, etaNode: "Hazir" });
    setDriveSessionId(null);
    setDriveSessionStatus("idle");
    setDriveSessionFeedback("");
    setDriveSessionPending(false);
    actionLockRef.current = false;
  };

  return {
    driveHud,
    driveSessionFeedback,
    driveSessionId,
    driveSessionPending,
    driveSessionStatus,
    isDriving,
    resetDriveSession,
    setDriveHud,
    toggleDrive,
  };
}
