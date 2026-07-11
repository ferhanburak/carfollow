import { startTransition, useEffect, useState } from "react";
import {
  buildDriveTickState,
  incrementClanKm,
  incrementUserOdometer,
  syncActiveDriver,
} from "../repositories/cruiserRepository";

export function useDriveSession({ user, setUser, setClans, setDrivers, onTelemetrySync }) {
  const [isDriving, setIsDriving] = useState(false);
  const [driveHud, setDriveHud] = useState({ speed: 0, sessionKm: 0, etaNode: "Hazir" });

  useEffect(() => {
    if (!isDriving || !user) {
      return undefined;
    }

    const driveTimer = window.setInterval(() => {
      startTransition(() => {
        setDriveHud((current) => buildDriveTickState(current));

        setUser((current) => {
          if (!current) {
            return current;
          }

          return incrementUserOdometer(current);
        });

        setClans((current) => incrementClanKm(current, user.clan));
        setDrivers((current) => syncActiveDriver(current, user));
      });
    }, 1000);

    return () => window.clearInterval(driveTimer);
  }, [isDriving, setClans, setDrivers, setUser, user]);

  const toggleDrive = () => {
    setIsDriving((current) => !current);
    if (user) {
      onTelemetrySync?.({
        plate: user.plate,
        vehicle: user.model,
        node: driveHud.etaNode,
        speed: driveHud.speed,
      });
    }
  };

  const resetDriveSession = () => {
    setIsDriving(false);
    setDriveHud({ speed: 0, sessionKm: 0, etaNode: "Hazir" });
  };

  return {
    driveHud,
    isDriving,
    resetDriveSession,
    setDriveHud,
    toggleDrive,
  };
}
