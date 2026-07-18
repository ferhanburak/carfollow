import { startTransition, useEffect, useRef, useState } from "react";
import {
  incrementClanKm,
  incrementUserOdometer,
} from "../repositories/cruiserRepository";
import { getGeolocationErrorStatus, processGpsPosition } from "../utils/driveTelemetry";

function createInitialDriveHud() {
  return {
    accuracy: null,
    etaNode: "GPS Hazir",
    gpsStatus: "idle",
    lastFixAt: null,
    sessionKm: 0,
    speed: 0,
  };
}

function getGpsNodeLabel(status) {
  if (status === "live") return "GPS Canli";
  if (status === "weak") return "Zayif GPS";
  if (status === "denied") return "Konum Kapali";
  if (status === "timeout") return "GPS Bekleniyor";
  if (status === "unavailable") return "GPS Yok";
  if (status === "error") return "GPS Hatasi";
  return "GPS Araniyor";
}

export function useDriveSession({
  user,
  setUser,
  setClans,
  onTelemetrySync,
  onSessionStart,
  onSessionFinish,
  serverOwnedDriverStats = false,
}) {
  const [isDriving, setIsDriving] = useState(false);
  const [driveHud, setDriveHud] = useState(createInitialDriveHud);
  const [driveSessionId, setDriveSessionId] = useState(null);
  const [driveSessionStatus, setDriveSessionStatus] = useState("idle");
  const [driveSessionFeedback, setDriveSessionFeedback] = useState("");
  const [driveSessionPending, setDriveSessionPending] = useState(false);
  const userRef = useRef(user);
  const telemetrySyncRef = useRef(onTelemetrySync);
  const actionLockRef = useRef(false);
  const liveLocationRef = useRef(null);
  const gpsPointRef = useRef(null);
  const gpsStatusRef = useRef("idle");

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    telemetrySyncRef.current = onTelemetrySync;
  }, [onTelemetrySync]);

  useEffect(() => {
    if (!isDriving) {
      liveLocationRef.current = null;
      gpsPointRef.current = null;
      gpsStatusRef.current = "idle";
      return undefined;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      gpsStatusRef.current = "unavailable";
      setDriveHud((current) => ({
        ...current,
        etaNode: getGpsNodeLabel("unavailable"),
        gpsStatus: "unavailable",
        speed: 0,
      }));
      setDriveSessionFeedback("Bu cihaz veya tarayici GPS erisimi sunmuyor; mesafe kaydedilmiyor.");
      return undefined;
    }

    setDriveHud((current) => ({
      ...current,
      etaNode: getGpsNodeLabel("requesting"),
      gpsStatus: "requesting",
      speed: 0,
    }));
    gpsStatusRef.current = "requesting";

    const geolocation = navigator.geolocation;
    const watchId = geolocation.watchPosition(
      (position) => {
        const reading = processGpsPosition(gpsPointRef.current, position);
        liveLocationRef.current = reading.location;
        if (reading.accepted) {
          gpsPointRef.current = reading.nextPoint;
        }

        const previousGpsStatus = gpsStatusRef.current;
        gpsStatusRef.current = reading.gpsStatus;
        startTransition(() => {
          setDriveHud((current) => ({
            ...current,
            accuracy: reading.accuracy ?? null,
            etaNode: getGpsNodeLabel(reading.gpsStatus),
            gpsStatus: reading.gpsStatus,
            lastFixAt: reading.timestamp ?? Date.now(),
            sessionKm: Number((current.sessionKm + reading.distanceKm).toFixed(4)),
            speed: reading.speedKmh,
          }));

          if (reading.distanceKm > 0) {
            setUser((current) => (
              current
                ? incrementUserOdometer(current, {
                  distanceKm: reading.distanceKm,
                  incrementMonthlyKm: !serverOwnedDriverStats,
                })
                : current
            ));

            if (!serverOwnedDriverStats) {
              setClans((current) => incrementClanKm(
                current,
                userRef.current?.clan,
                reading.distanceKm,
              ));
            }
          }
        });

        if (reading.gpsStatus === "live" && previousGpsStatus !== "live") {
          setDriveSessionFeedback("Gercek GPS telemetrisi aktif; hiz ve mesafe cihaz konumundan hesaplaniyor.");
        } else if (reading.gpsStatus === "weak" && previousGpsStatus !== "weak") {
          setDriveSessionFeedback("GPS dogrulugu zayif; guvenilir olmayan hareket mesafeye eklenmiyor.");
        }
      },
      (error) => {
        const gpsError = getGeolocationErrorStatus(error);
        liveLocationRef.current = null;
        gpsStatusRef.current = gpsError.status;
        setDriveHud((current) => ({
          ...current,
          accuracy: null,
          etaNode: getGpsNodeLabel(gpsError.status),
          gpsStatus: gpsError.status,
          speed: 0,
        }));
        setDriveSessionFeedback(gpsError.message);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );

    return () => {
      geolocation.clearWatch(watchId);
      liveLocationRef.current = null;
      gpsPointRef.current = null;
      gpsStatusRef.current = "idle";
    };
  }, [isDriving, serverOwnedDriverStats, setClans, setUser]);

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
      location: liveLocationRef.current,
      gpsAccuracy: driveHud.accuracy,
      gpsStatus: driveHud.gpsStatus,
    });
  }, [driveHud.accuracy, driveHud.etaNode, driveHud.gpsStatus, driveHud.lastFixAt, driveHud.speed, isDriving]);

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
            : "GPS tabanli surus oturumu hazirlaniyor...",
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
              ? "Sunucu kontrollu surus kaydi aktif; GPS bekleniyor."
              : "GPS tabanli surus kaydi aktif; konum bekleniyor.",
        );
        if (!result.resumed) {
          setDriveHud(createInitialDriveHud());
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
    setDriveHud(createInitialDriveHud());
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
