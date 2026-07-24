import { useEffect, useRef, useState } from "react";
import {
  formatDistrictLocation,
  shouldRefreshResolvedLocation,
} from "../utils/reverseGeocoding";

const locationCache = new Map();

function getCacheKey(location) {
  return `${Number(location.lat).toFixed(3)},${Number(location.lng).toFixed(3)}`;
}

async function waitForGoogleMaps(timeoutMs = 8_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (globalThis.google?.maps?.importLibrary) return globalThis.google.maps;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

export function useReverseGeocodedLocation(location, enabled = true) {
  const [state, setState] = useState({ label: "", status: "idle" });
  const lastResolvedRef = useRef(null);

  useEffect(() => {
    if (!enabled || !location || !shouldRefreshResolvedLocation(lastResolvedRef.current, location)) {
      return undefined;
    }

    let cancelled = false;
    const cacheKey = getCacheKey(location);
    const cachedLabel = locationCache.get(cacheKey);
    if (cachedLabel) {
      lastResolvedRef.current = { location, resolvedAt: Date.now() };
      setState({ label: cachedLabel, status: "ready" });
      return undefined;
    }

    setState((current) => ({ ...current, status: "loading" }));

    async function resolveLocation() {
      try {
        const maps = await waitForGoogleMaps();
        if (!maps) throw new Error("Google Maps is unavailable.");

        const { Geocoder } = await maps.importLibrary("geocoding");
        const response = await new Geocoder().geocode({
          location: { lat: Number(location.lat), lng: Number(location.lng) },
          region: "TR",
        });
        const label = formatDistrictLocation(response.results) || "GPS konumu aktif";

        if (!cancelled) {
          locationCache.set(cacheKey, label);
          lastResolvedRef.current = { location, resolvedAt: Date.now() };
          setState({ label, status: "ready" });
        }
      } catch {
        if (!cancelled) {
          lastResolvedRef.current = { location, resolvedAt: Date.now() };
          setState({ label: "GPS konumu aktif", status: "unavailable" });
        }
      }
    }

    void resolveLocation();
    return () => {
      cancelled = true;
    };
  }, [enabled, location?.lat, location?.lng]);

  return state;
}
