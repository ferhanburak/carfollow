import { useEffect, useRef, useState } from "react";
import { GoogleMap, MarkerF, PolylineF, useJsApiLoader } from "@react-google-maps/api";

const mapContainerStyle = {
  width: "100%",
  height: "18rem",
};

const loaderLibraries = ["routes"];

const mapOptions = {
  disableDefaultUI: true,
  clickableIcons: false,
  gestureHandling: "greedy",
  styles: [
    { elementType: "geometry", stylers: [{ color: "#0d0d0d" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8f8f8f" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0a" }] },
    { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#171717" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#1b1b1b" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#222222" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#111827" }] },
  ],
};

const routeLineOptions = {
  geodesic: true,
  strokeColor: "#a3e635",
  strokeOpacity: 0.9,
  strokeWeight: 5,
  icons: [
    {
      icon: {
        path: "M 0,-1 0,1",
        strokeOpacity: 1,
        scale: 3,
      },
      offset: "0",
      repeat: "14px",
    },
  ],
};

const draftRouteLineOptions = {
  geodesic: true,
  strokeColor: "#f43f5e",
  strokeOpacity: 0.82,
  strokeWeight: 4,
  icons: [
    {
      icon: {
        path: "M 0,-1 0,1",
        strokeOpacity: 1,
        scale: 3,
      },
      offset: "0",
      repeat: "16px",
    },
  ],
};

const glyphByType = {
  spot: "\uD83D\uDCF8",
  wash: "\uD83E\uDDFC",
  meet: "\uD83C\uDFCD\uFE0F",
};

function getMapsApiKey() {
  if (import.meta.env.MODE === "test") {
    return "";
  }

  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
}

function getPinGlyph(type) {
  return glyphByType[type] ?? glyphByType.meet;
}

function getActiveRoutePath(selectedPin) {
  if (selectedPin?.type === "meet" && Array.isArray(selectedPin.routePath) && selectedPin.routePath.length > 1) {
    return selectedPin.routePath;
  }

  return [];
}

function formatDistance(distanceMeters) {
  if (!distanceMeters) {
    return "-- km";
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function formatDuration(durationValue) {
  if (!durationValue) {
    return "-- dk";
  }

  const rawSeconds = Number.parseInt(String(durationValue).replace("s", ""), 10);

  if (Number.isNaN(rawSeconds)) {
    return "-- dk";
  }

  const totalMinutes = Math.max(1, Math.round(rawSeconds / 60));

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}s ${minutes}dk` : `${hours}s`;
  }

  return `${totalMinutes} dk`;
}

function getCurrentLocationIcon() {
  if (typeof window === "undefined" || !window.google?.maps) {
    return undefined;
  }

  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: "#f43f5e",
    fillOpacity: 1,
    strokeColor: "#ffe4e6",
    strokeWeight: 3,
    scale: 9,
  };
}

function getDraftLocationIcon() {
  if (typeof window === "undefined" || !window.google?.maps) {
    return undefined;
  }

  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: "#a3e635",
    fillOpacity: 1,
    strokeColor: "#f7fee7",
    strokeWeight: 3,
    scale: 8,
  };
}

function getDraftWaypointIcon(kind) {
  if (typeof window === "undefined" || !window.google?.maps) {
    return undefined;
  }

  if (kind === "start") {
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      fillColor: "#22c55e",
      fillOpacity: 1,
      strokeColor: "#dcfce7",
      strokeWeight: 3,
      scale: 8,
    };
  }

  if (kind === "end") {
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      fillColor: "#f43f5e",
      fillOpacity: 1,
      strokeColor: "#ffe4e6",
      strokeWeight: 3,
      scale: 8,
    };
  }

  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: "#f59e0b",
    fillOpacity: 1,
    strokeColor: "#fef3c7",
    strokeWeight: 3,
    scale: 7,
  };
}

function getDraftWaypointMeta(index, total) {
  if (index === 0) {
    return {
      kind: "start",
      badge: "S",
      title: "Route start",
    };
  }

  if (index === total - 1) {
    return {
      kind: "end",
      badge: "F",
      title: "Route finish",
    };
  }

  return {
    kind: "mid",
    badge: String(index),
    title: `Waypoint ${index}`,
  };
}

function FallbackGridMap({ pins, selectedPinId, onSelect }) {
  return (
    <div className="relative h-72 overflow-hidden rounded-[1.5rem] border border-white/8 bg-[radial-gradient(circle_at_center,_rgba(163,230,53,0.12),_transparent_32%),linear-gradient(180deg,#0f0f0f,#090909)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <svg viewBox="0 0 400 280" className="absolute inset-0 h-full w-full">
        <path d="M20 215 C120 150, 145 90, 238 98 S330 130, 390 45" fill="none" stroke="#a3e635" strokeWidth="3" strokeDasharray="10 9" opacity="0.85" />
        <path d="M24 58 C90 70, 130 165, 235 172 S312 180, 382 240" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="8 8" opacity="0.7" />
        <path d="M50 255 C180 260, 170 50, 340 85" fill="none" stroke="#fafafa" strokeWidth="1.5" opacity="0.2" />
      </svg>
      {pins.map((pin) => (
        <button
          key={pin.id}
          type="button"
          onClick={() => onSelect(pin.id)}
          aria-label={`${pin.name} (${pin.type})`}
          className={`absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border text-lg transition ${
            selectedPinId === pin.id
              ? "border-lime-400 bg-lime-400/20 shadow-[0_0_22px_rgba(163,230,53,0.4)]"
              : "border-white/10 bg-black/50"
          }`}
          style={{ left: pin.x, top: pin.y }}
        >
          {getPinGlyph(pin.type)}
        </button>
      ))}
    </div>
  );
}

export function MapCard({ pins, selectedPinId, onSelect, draftLocation, draftRoutePath, mapPickMode, onPickLocation }) {
  const mapsApiKey = getMapsApiKey();
  const shouldUseGoogleMaps = Boolean(mapsApiKey) && pins.every((pin) => typeof pin.lat === "number" && typeof pin.lng === "number");
  const selectedPin = pins.find((pin) => pin.id === selectedPinId) ?? pins[0];

  if (!shouldUseGoogleMaps) {
    return (
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,#171717,#0d0d0d)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Interactive Map Layer</p>
            <h3 className="mt-1 text-lg font-black">Google Maps Cruise Grid</h3>
          </div>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">Fallback Grid</div>
        </div>
        <FallbackGridMap pins={pins} selectedPinId={selectedPinId} onSelect={onSelect} />
      </div>
    );
  }

  return <GoogleMapCard mapsApiKey={mapsApiKey} pins={pins} selectedPin={selectedPin} selectedPinId={selectedPinId} onSelect={onSelect} draftLocation={draftLocation} draftRoutePath={draftRoutePath} mapPickMode={mapPickMode} onPickLocation={onPickLocation} />;
}

function GoogleMapCard({ mapsApiKey, pins, selectedPin, selectedPinId, onSelect, draftLocation, draftRoutePath, mapPickMode, onPickLocation }) {
  const mapRef = useRef(null);
  const [routeState, setRouteState] = useState({
    path: [],
    distanceMeters: null,
    duration: null,
    source: "idle",
    error: "",
  });
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationState, setLocationState] = useState({
    source: "idle",
    error: "",
  });
  const { isLoaded, loadError } = useJsApiLoader({
    id: "cruiser-google-maps",
    googleMapsApiKey: mapsApiKey,
    libraries: loaderLibraries,
  });
  const mapCenter = selectedPin
    ? { lat: selectedPin.lat ?? 39.8687, lng: selectedPin.lng ?? 32.7766 }
    : { lat: 39.8687, lng: 32.7766 };
  const activeRoutePath = getActiveRoutePath(selectedPin);
  const hasMockRoute = activeRoutePath.length > 1;
  const displayedRoutePath = routeState.path.length > 1 ? routeState.path : activeRoutePath;
  const hasDisplayedRoute = displayedRoutePath.length > 1;

  useEffect(() => {
    if (!isLoaded || typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationState({
        source: "unsupported",
        error: "",
      });
      return;
    }

    let cancelled = false;

    setLocationState({
      source: "loading",
      error: "",
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) {
          return;
        }

        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationState({
          source: "ready",
          error: "",
        });
      },
      (error) => {
        if (cancelled) {
          return;
        }

        setLocationState({
          source: "blocked",
          error: error.message || "Location access denied.",
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60000,
        timeout: 10000,
      },
    );

    return () => {
      cancelled = true;
    };
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded || !hasMockRoute || selectedPin?.type !== "meet") {
      setRouteState({
        path: [],
        distanceMeters: null,
        duration: null,
        source: "idle",
        error: "",
      });
      return;
    }

    let cancelled = false;

    async function syncLiveRoute() {
      setRouteState((current) => ({
        ...current,
        path: [],
        distanceMeters: null,
        duration: null,
        source: "loading",
        error: "",
      }));

      try {
        const { Route } = await window.google.maps.importLibrary("routes");
        const origin = activeRoutePath[0];
        const destination = activeRoutePath[activeRoutePath.length - 1];
        const intermediates = activeRoutePath.slice(1, -1).map((point) => ({ location: point }));
        const request = {
          origin,
          destination,
          intermediates,
          travelMode: "DRIVING",
          fields: ["path", "distanceMeters", "duration"],
        };
        const { routes } = await Route.computeRoutes(request);
        const firstRoute = routes?.[0];

        if (!firstRoute?.path?.length) {
          throw new Error("No drivable route returned.");
        }

        if (!cancelled) {
          setRouteState({
            path: firstRoute.path,
            distanceMeters: firstRoute.distanceMeters ?? null,
            duration: firstRoute.duration ?? null,
            source: "google",
            error: "",
          });
        }
      } catch (error) {
        if (!cancelled) {
          setRouteState({
            path: activeRoutePath,
            distanceMeters: null,
            duration: null,
            source: "fallback",
            error: error instanceof Error ? error.message : "Route request failed.",
          });
        }
      }
    }

    void syncLiveRoute();

    return () => {
      cancelled = true;
    };
  }, [activeRoutePath, hasMockRoute, isLoaded, selectedPin]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !selectedPin) {
      return;
    }

    if (hasDisplayedRoute) {
      const bounds = new window.google.maps.LatLngBounds();
      displayedRoutePath.forEach((point) => bounds.extend(point));
      mapRef.current.fitBounds(bounds, 48);
      return;
    }

    mapRef.current.panTo(mapCenter);
    mapRef.current.setZoom(12);
  }, [displayedRoutePath, hasDisplayedRoute, isLoaded, mapCenter, selectedPin]);

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,#171717,#0d0d0d)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Interactive Map Layer</p>
          <h3 className="mt-1 text-lg font-black">Google Maps Cruise Grid</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!mapRef.current || !currentLocation) {
                return;
              }

              mapRef.current.panTo(currentLocation);
              mapRef.current.setZoom(13);
            }}
            disabled={!currentLocation}
            className="min-h-12 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-neutral-500"
          >
            Konumum
          </button>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">Ankara Live</div>
        </div>
      </div>

      {isLoaded && !loadError ? (
        <div className="relative overflow-hidden rounded-[1.5rem] border border-white/8">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-[linear-gradient(180deg,rgba(10,10,10,0.75),transparent)]" />
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter}
            zoom={11}
            options={mapOptions}
            onClick={(event) => {
              const lat = event.latLng?.lat();
              const lng = event.latLng?.lng();
              if (typeof lat === "number" && typeof lng === "number") {
                onPickLocation?.({ lat, lng });
              }
            }}
            onLoad={(map) => {
              mapRef.current = map;
            }}
            onUnmount={() => {
              mapRef.current = null;
            }}
          >
            {hasDisplayedRoute ? <PolylineF path={displayedRoutePath} options={routeLineOptions} /> : null}
            {draftRoutePath?.length > 1 ? <PolylineF path={draftRoutePath} options={draftRouteLineOptions} /> : null}
            {currentLocation ? (
              <MarkerF
                position={currentLocation}
                title="Current location"
                zIndex={999}
                icon={getCurrentLocationIcon()}
              />
            ) : null}
            {draftRoutePath?.map((point, index) => {
              const waypoint = getDraftWaypointMeta(index, draftRoutePath.length);

              return (
                <MarkerF
                  key={`draft-route-${point.lat}-${point.lng}-${index}`}
                  position={point}
                  title={waypoint.title}
                  zIndex={997}
                  label={{
                    text: waypoint.badge,
                    color: "#0a0a0a",
                    fontSize: "11px",
                    fontWeight: "700",
                  }}
                  icon={getDraftWaypointIcon(waypoint.kind)}
                />
              );
            })}
            {draftLocation ? (
              <MarkerF
                position={{ lat: draftLocation.lat, lng: draftLocation.lng }}
                title="Draft location"
                zIndex={998}
                icon={getDraftLocationIcon()}
              />
            ) : null}
            {pins.map((pin) => (
              <MarkerF
                key={pin.id}
                position={{ lat: pin.lat, lng: pin.lng }}
                onClick={() => onSelect(pin.id)}
                title={pin.name}
                label={{
                  text: getPinGlyph(pin.type),
                  fontSize: "20px",
                }}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  fillColor: selectedPinId === pin.id ? "#a3e635" : "#171717",
                  fillOpacity: 1,
                  strokeColor: selectedPinId === pin.id ? "#d9f99d" : "#fafafa",
                  strokeWeight: 2,
                  scale: selectedPinId === pin.id ? 13 : 11,
                }}
              />
            ))}
          </GoogleMap>
          <div className="absolute inset-x-3 bottom-3 z-10 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.26em] text-lime-400">Selected Node</p>
                <p className="mt-1 text-sm font-semibold text-neutral-100">{selectedPin?.name}</p>
                <p className="mt-1 text-xs text-neutral-400">
                  {hasMockRoute ? selectedPin.route : "Tap a cruise meet to preview its live convoy route."}
                </p>
                {routeState.source === "fallback" ? (
                  <p className="mt-2 text-[11px] text-amber-300">Google route unavailable, showing mock cruise path.</p>
                ) : null}
                {locationState.source === "ready" ? (
                  <p className="mt-2 text-[11px] text-rose-200">Live location locked and visible on the map.</p>
                ) : null}
                {draftLocation ? (
                  <p className="mt-2 text-[11px] text-lime-200">
                    {mapPickMode === "route"
                      ? "Route builder aktif. Haritaya dokundukca event rota dugumleri ekleniyor."
                      : "Map uzerine dokunarak yeni node konumu secili halde tutuluyor."}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className={`rounded-2xl border px-3 py-2 text-[11px] ${routeState.source === "google" ? "border-lime-400/40 bg-lime-400/10 text-lime-300" : "border-white/10 bg-white/5 text-neutral-400"}`}>
                  {routeState.source === "loading" ? "Syncing route" : hasDisplayedRoute ? `${displayedRoutePath.length} route nodes` : "No route"}
                </div>
                {routeState.source === "google" ? (
                  <div className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-right text-[11px] text-neutral-300">
                    <div>{formatDistance(routeState.distanceMeters)}</div>
                    <div>{formatDuration(routeState.duration)}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <>
          <FallbackGridMap pins={pins} selectedPinId={selectedPinId} onSelect={onSelect} />
          <p className="mt-3 text-xs text-rose-300">
            Google Maps could not load. Check API restrictions for `localhost` and `127.0.0.1`.
          </p>
        </>
      ) : null}

      {routeState.error ? <p className="mt-3 text-xs text-neutral-500">{routeState.error}</p> : null}
      {locationState.source === "blocked" ? <p className="mt-2 text-xs text-neutral-500">{locationState.error}</p> : null}
    </div>
  );
}
