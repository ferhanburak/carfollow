import { getConvoyAccessState } from "./meetVisibility";

export function hasValidMapCoordinates(pin) {
  const lat = Number(pin?.lat);
  const lng = Number(pin?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function normalizeMapPinCoordinates(pin) {
  return {
    ...pin,
    lat: Number(pin.lat),
    lng: Number(pin.lng),
  };
}

export function getActiveConvoyRoute(selectedPin, user) {
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

export function buildMapOverlayModel({ pins = [], selectedPinId, user }) {
  const markers = pins.filter(hasValidMapCoordinates).map(normalizeMapPinCoordinates);
  const selectedPin = markers.find((pin) => pin.id === selectedPinId) ?? markers[0] ?? null;

  return {
    markers,
    selectedPin,
    routePath: getActiveConvoyRoute(selectedPin, user),
  };
}
