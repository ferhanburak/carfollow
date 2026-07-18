const EARTH_RADIUS_METERS = 6_371_000;

export const MAX_GPS_ACCURACY_METERS = 100;
export const MAX_DRIVE_SPEED_KMH = 320;
export const MAX_GPS_SAMPLE_GAP_MS = 30_000;

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function finiteNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function getDistanceMeters(start, end) {
  if (!start || !end) {
    return 0;
  }

  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);
  const latitudeDelta = endLat - startLat;
  const longitudeDelta = toRadians(end.lng - start.lng);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function normalizeGpsPosition(position) {
  const latitude = finiteNumber(position?.coords?.latitude);
  const longitude = finiteNumber(position?.coords?.longitude);
  if (latitude == null || longitude == null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }

  const speedMetersPerSecond = finiteNumber(position.coords.speed);
  return {
    lat: latitude,
    lng: longitude,
    accuracy: Math.max(0, finiteNumber(position.coords.accuracy) ?? MAX_GPS_ACCURACY_METERS),
    deviceSpeedKmh: speedMetersPerSecond == null ? null : Math.max(0, speedMetersPerSecond * 3.6),
    timestamp: finiteNumber(position.timestamp) ?? Date.now(),
  };
}

export function processGpsPosition(previousPoint, position) {
  const point = normalizeGpsPosition(position);
  if (!point) {
    return {
      accepted: false,
      distanceKm: 0,
      gpsStatus: "error",
      location: null,
      nextPoint: previousPoint,
      reason: "invalid-position",
      speedKmh: 0,
    };
  }

  const location = {
    lat: point.lat,
    lng: point.lng,
    accuracy: point.accuracy,
  };

  if (point.accuracy > MAX_GPS_ACCURACY_METERS) {
    return {
      accepted: false,
      accuracy: point.accuracy,
      distanceKm: 0,
      gpsStatus: "weak",
      location,
      nextPoint: previousPoint,
      reason: "weak-accuracy",
      speedKmh: 0,
      timestamp: point.timestamp,
    };
  }

  const deviceSpeedKmh = point.deviceSpeedKmh != null && point.deviceSpeedKmh <= MAX_DRIVE_SPEED_KMH
    ? point.deviceSpeedKmh
    : null;
  if (!previousPoint) {
    return {
      accepted: true,
      accuracy: point.accuracy,
      distanceKm: 0,
      gpsStatus: "live",
      location,
      nextPoint: point,
      reason: "initial-fix",
      speedKmh: Number((deviceSpeedKmh ?? 0).toFixed(1)),
      timestamp: point.timestamp,
    };
  }

  const elapsedMs = point.timestamp - previousPoint.timestamp;
  if (elapsedMs <= 0) {
    return {
      accepted: false,
      accuracy: point.accuracy,
      distanceKm: 0,
      gpsStatus: "live",
      location,
      nextPoint: previousPoint,
      reason: "stale-fix",
      speedKmh: 0,
      timestamp: point.timestamp,
    };
  }

  if (elapsedMs > MAX_GPS_SAMPLE_GAP_MS) {
    return {
      accepted: true,
      accuracy: point.accuracy,
      distanceKm: 0,
      gpsStatus: "live",
      location,
      nextPoint: point,
      reason: "baseline-reset",
      speedKmh: Number((deviceSpeedKmh ?? 0).toFixed(1)),
      timestamp: point.timestamp,
    };
  }

  const elapsedSeconds = elapsedMs / 1000;
  const distanceMeters = getDistanceMeters(previousPoint, point);
  const accuracyAllowance = Math.max(previousPoint.accuracy, point.accuracy);
  const maximumDistanceMeters = (MAX_DRIVE_SPEED_KMH / 3.6) * elapsedSeconds + accuracyAllowance;
  if (distanceMeters > maximumDistanceMeters) {
    return {
      accepted: false,
      accuracy: point.accuracy,
      distanceKm: 0,
      gpsStatus: "weak",
      location,
      nextPoint: previousPoint,
      reason: "implausible-jump",
      speedKmh: 0,
      timestamp: point.timestamp,
    };
  }

  const jitterThresholdMeters = Math.max(
    1.5,
    Math.min(previousPoint.accuracy, point.accuracy) * 0.15,
  );
  const acceptedDistanceMeters = distanceMeters >= jitterThresholdMeters ? distanceMeters : 0;
  const derivedSpeedKmh = (acceptedDistanceMeters / elapsedSeconds) * 3.6;
  const speedKmh = deviceSpeedKmh ?? derivedSpeedKmh;

  return {
    accepted: true,
    accuracy: point.accuracy,
    distanceKm: Number((acceptedDistanceMeters / 1000).toFixed(4)),
    gpsStatus: "live",
    location,
    nextPoint: point,
    reason: acceptedDistanceMeters ? "movement" : "stationary",
    speedKmh: Number(Math.min(MAX_DRIVE_SPEED_KMH, Math.max(0, speedKmh)).toFixed(1)),
    timestamp: point.timestamp,
  };
}

export function getGeolocationErrorStatus(error) {
  if (error?.code === 1) {
    return { status: "denied", message: "Konum izni reddedildi. Surus verisi kaydedilmiyor." };
  }
  if (error?.code === 2) {
    return { status: "unavailable", message: "GPS konumu su anda alinamiyor." };
  }
  if (error?.code === 3) {
    return { status: "timeout", message: "GPS yaniti zaman asimina ugradi; yeniden deneniyor." };
  }

  return { status: "error", message: "GPS verisi okunamadi." };
}
