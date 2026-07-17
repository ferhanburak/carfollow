import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, InfoWindowF, MarkerF, PolylineF, useJsApiLoader } from "@react-google-maps/api";
import { getPinIcon } from "../constants/pins";
import { getConvoyAccessState } from "../utils/meetVisibility";

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

function getMapsApiKey() {
  if (import.meta.env.MODE === "test") {
    return "";
  }

  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
}

function hasValidMapCoordinates(pin) {
  const lat = Number(pin?.lat);
  const lng = Number(pin?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function normalizeMapPinCoordinates(pin) {
  return {
    ...pin,
    lat: Number(pin.lat),
    lng: Number(pin.lng),
  };
}

function getPinGlyph(type) {
  return getPinIcon(type);
}

function getConvoyProgressRatio(selectedPin, driveHud, isDriving) {
  if (!isDriving || !Array.isArray(selectedPin?.routePath) || selectedPin.routePath.length < 2) {
    return 0;
  }

  let totalKm = 0;
  for (let index = 1; index < selectedPin.routePath.length; index += 1) {
    const start = selectedPin.routePath[index - 1];
    const end = selectedPin.routePath[index];
    const latKm = (end.lat - start.lat) * 111.32;
    const lngKm = (end.lng - start.lng) * 85.39;
    totalKm += Math.sqrt(latKm ** 2 + lngKm ** 2);
  }

  if (totalKm <= 0) {
    return 0;
  }

  return Math.min(1, (driveHud?.sessionKm ?? 0) / totalKm);
}

function interpolatePoint(path, ratio) {
  if (!Array.isArray(path) || path.length === 0) {
    return null;
  }
  if (path.length === 1) {
    return path[0];
  }

  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const scaledIndex = clampedRatio * (path.length - 1);
  const startIndex = Math.floor(scaledIndex);
  const endIndex = Math.min(path.length - 1, startIndex + 1);
  const localRatio = scaledIndex - startIndex;
  const start = path[startIndex];
  const end = path[endIndex];

  return {
    lat: start.lat + (end.lat - start.lat) * localRatio,
    lng: start.lng + (end.lng - start.lng) * localRatio,
  };
}

function getBearingDegrees(start, end) {
  if (!start || !end) {
    return 0;
  }

  const y = end.lng - start.lng;
  const x = end.lat - start.lat;
  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  return angle + 90;
}

function getAttendeeProgressOffset(attendee, index, convoyRatio) {
  if (attendee.tripStatus === "cancelled") {
    return null;
  }
  if (attendee.tripStatus === "arrived") {
    return 1;
  }
  if (attendee.tripStatus === "ready") {
    return Math.max(0, convoyRatio * 0.18 - 0.06 - index * 0.015);
  }

  return Math.max(0.04, convoyRatio - index * 0.055);
}

function getConvoyGhostMarkers(selectedPin, user, driveHud, isDriving) {
  if (
    selectedPin?.type !== "meet" ||
    !getConvoyAccessState(selectedPin, user).canViewDetails ||
    !Array.isArray(selectedPin.routePath) ||
    selectedPin.routePath.length < 2
  ) {
    return [];
  }

  const convoyRatio = getConvoyProgressRatio(selectedPin, driveHud, isDriving);

  return (selectedPin.attendees ?? [])
    .map((attendee, index) => {
      const progress = getAttendeeProgressOffset(attendee, index, convoyRatio);
      if (progress == null) {
        return null;
      }

      const position = interpolatePoint(selectedPin.routePath, progress);
      if (!position) {
        return null;
      }

      const nextPosition = interpolatePoint(selectedPin.routePath, Math.min(1, progress + 0.035)) ?? position;

      return {
        id: `${selectedPin.id}-${attendee.plate}`,
        fullName: attendee.fullName ?? attendee.plate,
        isSelf: attendee.plate === user?.plate,
        model: attendee.model ?? "Unknown Setup",
        plate: attendee.plate,
        score: attendee.score ?? 70,
        harmonyVotes: attendee.harmonyVotes ?? 0,
        alertVotes: attendee.alertVotes ?? 0,
        standing: attendee.status ?? "Convoy Ready",
        shortPlate: attendee.plate.replaceAll(" ", "").slice(-3),
        tripStatus: attendee.tripStatus ?? "ready",
        position,
        heading: getBearingDegrees(position, nextPosition),
      };
    })
    .filter(Boolean);
}

function getConvoyGhostTone(marker) {
  if (marker.tripStatus === "arrived") {
    return {
      fill: "#38bdf8",
      stroke: "#e0f2fe",
      text: "#f0f9ff",
    };
  }

  if (marker.tripStatus === "ready") {
    return {
      fill: "#f59e0b",
      stroke: "#fef3c7",
      text: "#fffbeb",
    };
  }

  return {
    fill: marker.isSelf ? "#a3e635" : "#22c55e",
    stroke: marker.isSelf ? "#ecfccb" : "#dcfce7",
    text: marker.isSelf ? "#0a0a0a" : "#f0fdf4",
  };
}

function createConvoyGhostIcon(marker) {
  if (typeof window === "undefined" || !window.google?.maps) {
    return undefined;
  }

  const tone = getConvoyGhostTone(marker);
  const badge = marker.shortPlate;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="54" height="54" viewBox="0 0 54 54">
      <g transform="rotate(${marker.heading} 27 27)">
        <path d="M27 9 L37 35 L27 30 L17 35 Z" fill="${tone.fill}" stroke="${tone.stroke}" stroke-width="3" stroke-linejoin="round" />
        <circle cx="27" cy="28" r="5" fill="#0a0a0a" fill-opacity="0.28" />
      </g>
      <rect x="16" y="36" rx="8" ry="8" width="22" height="12" fill="#0a0a0a" fill-opacity="0.9" stroke="${tone.stroke}" stroke-width="1.5" />
      <text x="27" y="44.5" text-anchor="middle" font-size="8" font-family="Arial, sans-serif" font-weight="700" fill="${tone.text}">${badge}</text>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(40, 40),
    anchor: new window.google.maps.Point(20, 20),
  };
}

function getLifecycleTone(lifecycleStatus, isSelected = false) {
  if (isSelected) {
    return {
      fill: "#a3e635",
      stroke: "#ecfccb",
      badge: "#0f172a",
      text: "#0a0a0a",
    };
  }

  if (lifecycleStatus === "rolling") {
    return {
      fill: "#22c55e",
      stroke: "#dcfce7",
      badge: "#14532d",
      text: "#f0fdf4",
    };
  }

  if (lifecycleStatus === "delayed") {
    return {
      fill: "#f59e0b",
      stroke: "#fef3c7",
      badge: "#78350f",
      text: "#fffbeb",
    };
  }

  if (lifecycleStatus === "completed") {
    return {
      fill: "#38bdf8",
      stroke: "#e0f2fe",
      badge: "#0c4a6e",
      text: "#f0f9ff",
    };
  }

  return {
    fill: "#171717",
    stroke: "#fafafa",
    badge: "#3f6212",
    text: "#ffffff",
  };
}

function createMeetMarkerIcon(pin, isSelected) {
  const attendees = Array.isArray(pin.attendees) ? pin.attendees.length : 0;
  const tone = getLifecycleTone(pin.lifecycleStatus ?? "planning", isSelected);
  const badgeValue = attendees > 9 ? "9+" : String(attendees || 0);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="${isSelected ? 18 : 16}" fill="${tone.fill}" stroke="${tone.stroke}" stroke-width="3" />
      <path d="M24 36 h16 l4 -6 h5" fill="none" stroke="#0a0a0a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="26" cy="39" r="3" fill="#0a0a0a" />
      <circle cx="40" cy="39" r="3" fill="#0a0a0a" />
      <path d="M28 28 l5 0 l4 4" fill="none" stroke="#0a0a0a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="39" y="9" rx="10" ry="10" width="18" height="18" fill="${tone.badge}" stroke="${tone.stroke}" stroke-width="2" />
      <text x="48" y="22" text-anchor="middle" font-size="10" font-family="Arial, sans-serif" font-weight="700" fill="${tone.text}">${badgeValue}</text>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(isSelected ? 64 : 58, isSelected ? 64 : 58),
    anchor: new window.google.maps.Point(isSelected ? 32 : 29, isSelected ? 32 : 29),
  };
}

function createDefaultMarkerIcon(isSelected) {
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: isSelected ? "#a3e635" : "#171717",
    fillOpacity: 1,
    strokeColor: isSelected ? "#d9f99d" : "#fafafa",
    strokeWeight: 2,
    scale: isSelected ? 13 : 11,
  };
}

function getMarkerIcon(pin, isSelected) {
  if (typeof window === "undefined" || !window.google?.maps) {
    return undefined;
  }

  if (pin.type === "meet") {
    return createMeetMarkerIcon(pin, isSelected);
  }

  return createDefaultMarkerIcon(isSelected);
}

function getMarkerLabel(pin) {
  if (pin.type === "meet") {
    return undefined;
  }

  return {
    text: getPinGlyph(pin.type),
    fontSize: "20px",
  };
}

function getActiveRoutePath(selectedPin, user) {
  if (
    selectedPin?.type === "meet" &&
    getConvoyAccessState(selectedPin, user).canViewDetails &&
    Array.isArray(selectedPin.routePath) &&
    selectedPin.routePath.length > 1
  ) {
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

function getActiveDriverIcon(locationVisibility) {
  if (typeof window === "undefined" || !window.google?.maps) return undefined;
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: locationVisibility === "approximate" ? "#facc15" : "#a3e635",
    fillOpacity: 0.95,
    strokeColor: "#0a0a0a",
    strokeWeight: 4,
    scale: locationVisibility === "approximate" ? 8 : 7,
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

function getMeetStatusBadge(pin) {
  const attendees = Array.isArray(pin.attendees) ? pin.attendees.length : 0;
  const status =
    pin.lifecycleStatus === "rolling"
      ? "Live"
      : pin.lifecycleStatus === "delayed"
        ? "Delay"
        : pin.lifecycleStatus === "completed"
          ? "Done"
          : "Plan";

  return `${status} · ${attendees}`;
}

function getTripStatusLabel(value) {
  if (value === "enroute") {
    return "Yolda";
  }
  if (value === "arrived") {
    return "Vardi";
  }
  if (value === "cancelled") {
    return "Iptal";
  }

  return "Hazir";
}

function getFriendshipStatus(user, plate) {
  if (!user || !plate) {
    return "none";
  }
  if (user.plate === plate) {
    return "self";
  }
  if ((user.blockedDrivers ?? []).some((entry) => entry.plate === plate)) {
    return "blocked";
  }
  if ((user.friends ?? []).some((entry) => entry.plate === plate)) {
    return "friend";
  }
  if ((user.incomingRequests ?? []).some((entry) => entry.plate === plate)) {
    return "incoming";
  }
  if ((user.outgoingRequests ?? []).some((entry) => entry.plate === plate)) {
    return "outgoing";
  }

  return "none";
}

function FallbackGridMap({ pins, selectedPinId, onSelect, fullScreen = false, mapHeight = "18rem" }) {
  return (
    <div
      className={`relative overflow-hidden border border-white/8 bg-[radial-gradient(circle_at_center,_rgba(163,230,53,0.12),_transparent_32%),linear-gradient(180deg,#0f0f0f,#090909)] ${fullScreen ? "h-full rounded-none" : "rounded-[1.5rem]"}`}
      style={fullScreen ? undefined : { height: mapHeight }}
    >
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
          {pin.type === "meet" ? (
            <span className="absolute -right-1 -top-1 rounded-full border border-white/10 bg-black/85 px-1.5 py-0.5 text-[9px] font-bold text-lime-300">
              {Array.isArray(pin.attendees) ? pin.attendees.length : 0}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function MapCard({
  drivers = [],
  pins,
  selectedPinId,
  onSelect,
  onOpenDriverConversation,
  onOpenDriverProfile,
  onRequestFriend,
  user,
  driveHud,
  draftLocation,
  draftRoutePath,
  isDriving = false,
  mapPickMode,
  onPickLocation,
  fullScreen = false,
  navigationMode = false,
  mapHeight = "18rem",
}) {
  const mapsApiKey = getMapsApiKey();
  // Legacy or partially-created nodes must not disable the whole Google map.
  const mappablePins = pins.filter(hasValidMapCoordinates).map(normalizeMapPinCoordinates);
  const shouldUseGoogleMaps = Boolean(mapsApiKey);
  const selectedPin = mappablePins.find((pin) => pin.id === selectedPinId) ?? mappablePins[0];

  if (!shouldUseGoogleMaps) {
    return (
      <div
        className={`relative overflow-hidden ${
          fullScreen
            ? "h-full w-full bg-[#050505]"
            : "rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,#171717,#0d0d0d)] p-4"
        }`}
      >
        {!fullScreen ? (
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Interactive Map Layer</p>
              <h3 className="mt-1 text-lg font-black">Google Maps Cruise Grid</h3>
            </div>
            <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">Fallback Grid</div>
          </div>
        ) : null}
        <div className={fullScreen ? "absolute inset-0 p-0" : ""}>
          <FallbackGridMap
            pins={pins}
            selectedPinId={selectedPinId}
            onSelect={onSelect}
            fullScreen={fullScreen}
            mapHeight={mapHeight}
          />
        </div>
      </div>
    );
  }

  return (
    <GoogleMapCard
      mapsApiKey={mapsApiKey}
      drivers={drivers}
      pins={mappablePins}
      selectedPin={selectedPin}
      selectedPinId={selectedPinId}
      onSelect={onSelect}
      onOpenDriverConversation={onOpenDriverConversation}
      onOpenDriverProfile={onOpenDriverProfile}
      onRequestFriend={onRequestFriend}
      user={user}
      driveHud={driveHud}
      draftLocation={draftLocation}
      draftRoutePath={draftRoutePath}
      isDriving={isDriving}
      mapPickMode={mapPickMode}
      onPickLocation={onPickLocation}
      fullScreen={fullScreen}
      navigationMode={navigationMode}
      mapHeight={mapHeight}
    />
  );
}

function GoogleMapCard({
  mapsApiKey,
  drivers,
  pins,
  selectedPin,
  selectedPinId,
  onSelect,
  onOpenDriverConversation,
  onOpenDriverProfile,
  onRequestFriend,
  user,
  driveHud,
  draftLocation,
  draftRoutePath,
  isDriving,
  mapPickMode,
  onPickLocation,
  fullScreen,
  navigationMode,
  mapHeight,
}) {
  const mapRef = useRef(null);
  const watchIdRef = useRef(null);
  const shouldAutoFrameRouteRef = useRef(true);
  const previousSelectedPinIdRef = useRef(selectedPinId);
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
  const [selectedGhostMarkerId, setSelectedGhostMarkerId] = useState(null);
  const [followCurrentLocation, setFollowCurrentLocation] = useState(Boolean(navigationMode));
  const { isLoaded, loadError } = useJsApiLoader({
    id: "cruiser-google-maps",
    googleMapsApiKey: mapsApiKey,
    libraries: loaderLibraries,
  });
  const mapCenter = selectedPin
    ? { lat: selectedPin.lat ?? 39.8687, lng: selectedPin.lng ?? 32.7766 }
    : { lat: 39.8687, lng: 32.7766 };
  const activeRoutePath = useMemo(
    () => getActiveRoutePath(selectedPin, user),
    [selectedPin, user],
  );
  const hasMockRoute = activeRoutePath.length > 1;
  const displayedRoutePath = routeState.path.length > 1 ? routeState.path : activeRoutePath;
  const hasDisplayedRoute = displayedRoutePath.length > 1;
  const convoyAccess = selectedPin?.type === "meet" ? getConvoyAccessState(selectedPin, user) : null;
  const convoyGhostMarkers = getConvoyGhostMarkers(selectedPin, user, driveHud, isDriving);
  const selectedGhostMarker = convoyGhostMarkers.find((marker) => marker.id === selectedGhostMarkerId) ?? null;
  const selectedGhostFriendship = selectedGhostMarker ? getFriendshipStatus(user, selectedGhostMarker.plate) : "none";

  useEffect(() => {
    setFollowCurrentLocation(Boolean(navigationMode));
  }, [navigationMode]);

  useEffect(() => {
    if (previousSelectedPinIdRef.current !== selectedPinId) {
      previousSelectedPinIdRef.current = selectedPinId;
      shouldAutoFrameRouteRef.current = true;
      setSelectedGhostMarkerId(null);
    }
  }, [selectedPinId]);

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

    watchIdRef.current = navigator.geolocation.watchPosition(
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
          error: error.message || "Location tracking denied.",
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      },
    );

    return () => {
      cancelled = true;
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
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
    if (!isLoaded || !mapRef.current) {
      return;
    }

    // Google Maps can render into a black/blank canvas if the container size
    // settles after the map instance is created. Force a resize once visible.
    const resizeMap = () => {
      if (!mapRef.current || !window.google?.maps?.event) {
        return;
      }

      window.google.maps.event.trigger(mapRef.current, "resize");
    };

    const animationFrame = window.requestAnimationFrame(resizeMap);
    const timeoutId = window.setTimeout(resizeMap, 120);

    if (hasDisplayedRoute && shouldAutoFrameRouteRef.current) {
      const bounds = new window.google.maps.LatLngBounds();
      displayedRoutePath.forEach((point) => bounds.extend(point));
      mapRef.current.fitBounds(bounds, 48);
      shouldAutoFrameRouteRef.current = false;
      return () => {
        window.cancelAnimationFrame(animationFrame);
        window.clearTimeout(timeoutId);
      };
    }

    if (navigationMode && currentLocation && followCurrentLocation) {
      mapRef.current.panTo(currentLocation);
      mapRef.current.setZoom(14);
      return () => {
        window.cancelAnimationFrame(animationFrame);
        window.clearTimeout(timeoutId);
      };
    }

    if (!selectedPin) {
      return () => {
        window.cancelAnimationFrame(animationFrame);
        window.clearTimeout(timeoutId);
      };
    }

    mapRef.current.panTo(mapCenter);
    mapRef.current.setZoom(12);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeoutId);
    };
  }, [currentLocation, displayedRoutePath, followCurrentLocation, hasDisplayedRoute, isLoaded, mapCenter, navigationMode, selectedPin]);

  return (
    <div
      className={`relative overflow-hidden ${
        fullScreen
          ? "h-full w-full bg-[#050505]"
          : "rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,#171717,#0d0d0d)] p-4"
      }`}
    >
      <div className={`${fullScreen ? "pointer-events-none absolute right-4 top-4 z-20" : "mb-3 flex items-center justify-between"}`}>
        <div>
          {!fullScreen ? <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Interactive Map Layer</p> : null}
          {!fullScreen ? <h3 className="mt-1 text-lg font-black">Google Maps Cruise Grid</h3> : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!mapRef.current || !currentLocation) {
                return;
              }

              mapRef.current.panTo(currentLocation);
              mapRef.current.setZoom(14);
              setFollowCurrentLocation(true);
            }}
            disabled={!currentLocation}
            className={`pointer-events-auto min-h-12 rounded-2xl border px-3 py-2 text-xs transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-neutral-500 ${
              followCurrentLocation
                ? "border-lime-400/40 bg-lime-400/15 text-lime-200"
                : "border-rose-400/30 bg-rose-500/10 text-rose-200"
            }`}
          >
            {followCurrentLocation ? "Bana Kilitli" : "Konumuma Git"}
          </button>
          {!fullScreen ? <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">Ankara Live</div> : null}
        </div>
      </div>

      {isLoaded && !loadError ? (
        <div
          className={`relative overflow-hidden ${
            fullScreen ? "absolute inset-0" : "rounded-[1.5rem] border border-white/8"
          }`}
        >
          {fullScreen ? (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(163,230,53,0.08),_transparent_36%),linear-gradient(180deg,#0a0a0a,#050505)]" />
          ) : null}
          {!fullScreen ? <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-[linear-gradient(180deg,rgba(10,10,10,0.75),transparent)]" /> : null}
          <GoogleMap
            mapContainerStyle={fullScreen ? { width: "100%", height: "100%" } : { width: "100%", height: mapHeight }}
            center={mapCenter}
            zoom={11}
            options={mapOptions}
            onClick={(event) => {
              if (navigationMode) {
                return;
              }

              const lat = event.latLng?.lat();
              const lng = event.latLng?.lng();
              if (typeof lat === "number" && typeof lng === "number") {
                onPickLocation?.({ lat, lng });
              }
            }}
            onLoad={(map) => {
              mapRef.current = map;
            }}
            onDragStart={() => {
              if (navigationMode) {
                setFollowCurrentLocation(false);
              }
              shouldAutoFrameRouteRef.current = false;
            }}
            onZoomChanged={() => {
              if (navigationMode) {
                setFollowCurrentLocation(false);
              }
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
            {drivers
              .filter((driver) => hasValidMapCoordinates(driver))
              .map((driver) => (
                <MarkerF
                  key={`active-driver-${driver.firebaseUid}`}
                  position={{ lat: Number(driver.lat), lng: Number(driver.lng) }}
                  title={`${driver.plate} / ${driver.vehicle}`}
                  zIndex={996}
                  icon={getActiveDriverIcon(driver.locationVisibility)}
                />
              ))}
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
                title={pin.type === "meet" ? `${pin.name} · ${getMeetStatusBadge(pin)}` : pin.name}
                label={getMarkerLabel(pin)}
                icon={getMarkerIcon(pin, selectedPinId === pin.id)}
              />
            ))}
            {convoyGhostMarkers.map((marker) => (
              <MarkerF
                key={marker.id}
                position={marker.position}
                title={`${marker.plate} · ${marker.tripStatus}`}
                zIndex={996}
                icon={createConvoyGhostIcon(marker)}
                onClick={() => setSelectedGhostMarkerId(marker.id)}
              />
            ))}
            {selectedGhostMarker ? (
              <InfoWindowF
                position={selectedGhostMarker.position}
                onCloseClick={() => setSelectedGhostMarkerId(null)}
                options={{ pixelOffset: new window.google.maps.Size(0, -24) }}
              >
                <div className="min-w-[11rem] rounded-2xl bg-[#0d0d0d] p-1 text-white">
                  <p className="font-mono text-[11px] tracking-[0.18em] text-lime-300">{selectedGhostMarker.plate}</p>
                  <p className="mt-1 text-sm font-bold text-white">{selectedGhostMarker.fullName}</p>
                  <p className="text-[11px] text-neutral-400">{selectedGhostMarker.model}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-neutral-200">
                      {getTripStatusLabel(selectedGhostMarker.tripStatus)}
                    </span>
                    <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-2 py-1 text-[10px] text-lime-200">
                      Score {selectedGhostMarker.score}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-neutral-300">
                    <div className="rounded-xl border border-white/8 bg-white/[0.04] px-2 py-1.5">
                      Uyum {selectedGhostMarker.harmonyVotes}
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.04] px-2 py-1.5">
                      Alert {selectedGhostMarker.alertVotes}
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                    {selectedGhostMarker.standing}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDriverProfile?.(selectedGhostMarker)}
                      className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-2 text-[10px] font-semibold text-neutral-200"
                    >
                      Profili Ac
                    </button>
                    <button
                      type="button"
                      disabled={selectedGhostFriendship !== "none"}
                      onClick={() => onRequestFriend?.(selectedGhostMarker)}
                      className="min-h-10 rounded-xl bg-lime-400 px-2 text-[10px] font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {selectedGhostFriendship === "friend"
                        ? "Arkadas"
                        : selectedGhostFriendship === "incoming"
                          ? "Bekliyor"
                          : selectedGhostFriendship === "outgoing"
                            ? "Gonderildi"
                            : selectedGhostFriendship === "blocked"
                              ? "Engelli"
                            : selectedGhostFriendship === "self"
                              ? "Sen"
                              : "Arkadas Ekle"}
                    </button>
                    <button
                      type="button"
                      disabled={selectedGhostFriendship !== "friend"}
                      onClick={() => onOpenDriverConversation?.(selectedGhostMarker)}
                      className="min-h-10 rounded-xl border border-lime-400/20 bg-lime-400/10 px-2 text-[10px] font-semibold text-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      DM Gonder
                    </button>
                  </div>
                </div>
              </InfoWindowF>
            ) : null}
          </GoogleMap>
          {!fullScreen ? (
            <div className="absolute inset-x-3 bottom-3 z-10 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.26em] text-lime-400">Selected Node</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-100">
                    {selectedPin?.type === "meet" && !convoyAccess?.canViewDetails ? "Restricted Convoy" : selectedPin?.name}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {selectedPin?.type === "meet" && !convoyAccess?.canViewDetails
                      ? "Rota ve lokasyon detaylari yalnizca guvenilir suruculere acik."
                      : hasMockRoute
                        ? selectedPin.route
                        : "Tap a cruise meet to preview its live convoy route."}
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
          ) : null}
        </div>
      ) : null}

      {loadError ? (
        <>
          <FallbackGridMap pins={pins} selectedPinId={selectedPinId} onSelect={onSelect} />
          <p className="mt-3 text-xs text-rose-300">
            Google Maps could not load. Check that Maps JavaScript API is enabled and this key permits `localhost` and `127.0.0.1`.
          </p>
        </>
      ) : null}

      {routeState.error ? <p className="mt-3 text-xs text-neutral-500">{routeState.error}</p> : null}
      {locationState.source === "blocked" ? <p className="mt-2 text-xs text-neutral-500">{locationState.error}</p> : null}
    </div>
  );
}
