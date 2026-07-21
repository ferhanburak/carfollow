import { startTransition, useEffect, useRef, useState } from "react";
import { getGeolocationErrorStatus, processGpsPosition, smoothGpsLocation } from "../utils/driveTelemetry";

const initialLocationState = Object.freeze({
  error: "",
  location: null,
  sample: null,
  status: "idle",
});

function copyPosition(position) {
  return {
    coords: {
      accuracy: position.coords.accuracy,
      heading: position.coords.heading,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      speed: position.coords.speed,
    },
    timestamp: position.timestamp,
  };
}

export function useLiveLocation({ enabled = false } = {}) {
  const [state, setState] = useState(initialLocationState);
  const previousPointRef = useRef(null);
  const filteredLocationRef = useRef(null);
  const sequenceRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      previousPointRef.current = null;
      filteredLocationRef.current = null;
      setState(initialLocationState);
      return undefined;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ ...initialLocationState, status: "unavailable", error: "Bu cihaz GPS erisimi sunmuyor." });
      return undefined;
    }

    previousPointRef.current = null;
    filteredLocationRef.current = null;
    setState({ ...initialLocationState, status: "requesting" });

    const geolocation = navigator.geolocation;
    const watchId = geolocation.watchPosition(
      (position) => {
        const samplePosition = copyPosition(position);
        const reading = processGpsPosition(previousPointRef.current, samplePosition);
        if (reading.accepted) previousPointRef.current = reading.nextPoint;
        filteredLocationRef.current = smoothGpsLocation(filteredLocationRef.current, reading);
        sequenceRef.current += 1;

        startTransition(() => {
          setState({
            error: reading.gpsStatus === "weak" ? "GPS hassasiyeti zayif; son guvenilir konum korunuyor." : "",
            location: filteredLocationRef.current,
            sample: { id: sequenceRef.current, position: samplePosition },
            status: reading.gpsStatus,
          });
        });
      },
      (error) => {
        const gpsError = getGeolocationErrorStatus(error);
        setState((current) => ({
          ...current,
          error: gpsError.message,
          status: gpsError.status,
        }));
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );

    return () => {
      geolocation.clearWatch(watchId);
      previousPointRef.current = null;
      filteredLocationRef.current = null;
    };
  }, [enabled]);

  return state;
}
