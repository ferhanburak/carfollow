import type { LocationObject } from 'expo-location';

const EARTH_RADIUS_METERS = 6_371_000;

export const MAX_GPS_ACCURACY_METERS = 100;
export const MAX_DRIVE_SPEED_KMH = 320;
export const MAX_GPS_SAMPLE_GAP_MS = 30_000;
export const MAX_SPEED_RECORD_ACCURACY_METERS = 35;
export const MAX_SPEED_SAMPLE_GAP_SECONDS = 15;
export const MIN_MOVING_SPEED_KMH = 3;
export const DISPLAY_SPEED_HOLD_MS = 3_000;

export type GpsPoint = {
  lat: number;
  lng: number;
  accuracy: number;
  deviceSpeedKmh: number | null;
  heading: number | null;
  timestamp: number;
};

export type GpsReading = {
  accepted: boolean;
  accuracy?: number;
  distanceKm: number;
  gpsStatus: 'live' | 'weak' | 'error';
  location: { lat: number; lng: number; accuracy: number } | null;
  nextPoint: GpsPoint | null;
  reason:
    | 'initial-fix'
    | 'movement'
    | 'stationary'
    | 'baseline-reset'
    | 'weak-accuracy'
    | 'implausible-jump'
    | 'stale-fix'
    | 'invalid-position';
  derivedSpeedKmh?: number | null;
  deviceSpeedKmh?: number | null;
  elapsedSeconds?: number;
  heading?: number | null;
  speedKmh: number;
  timestamp?: number;
};

export type DriveMetrics = {
  acceptedSampleCount: number;
  averageSpeedKmh: number;
  lastQualifiedSpeedKmh: number | null;
  maxSpeedKmh: number;
  movingSeconds: number;
  qualifiedSpeedSampleCount: number;
  sessionKm: number;
};

export type DisplayedSpeed = {
  lastMovingAt: number;
  speedKmh: number;
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function finiteNumber(value: unknown) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function getDistanceMeters(
  start: Pick<GpsPoint, 'lat' | 'lng'> | null,
  end: Pick<GpsPoint, 'lat' | 'lng'> | null,
) {
  if (!start || !end) return 0;

  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);
  const latitudeDelta = endLat - startLat;
  const longitudeDelta = toRadians(end.lng - start.lng);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function createDriveMetrics(): DriveMetrics {
  return {
    acceptedSampleCount: 0,
    averageSpeedKmh: 0,
    lastQualifiedSpeedKmh: null,
    maxSpeedKmh: 0,
    movingSeconds: 0,
    qualifiedSpeedSampleCount: 0,
    sessionKm: 0,
  };
}

export function stabilizeDisplayedSpeed(
  previousState: DisplayedSpeed | null,
  reading: GpsReading,
): DisplayedSpeed {
  const timestamp = Number(reading.timestamp) || Date.now();
  const rawSpeedKmh = Math.max(0, Number(reading.speedKmh) || 0);
  const previousSpeedKmh = Math.max(0, Number(previousState?.speedKmh) || 0);
  const previousMovingAt = Number(previousState?.lastMovingAt) || 0;

  if (reading.gpsStatus === 'live' && rawSpeedKmh >= MIN_MOVING_SPEED_KMH) {
    return { lastMovingAt: timestamp, speedKmh: rawSpeedKmh };
  }

  const isTransientLiveDrop = (
    reading.accepted
    && reading.gpsStatus === 'live'
    && reading.reason === 'stationary'
    && previousSpeedKmh >= MIN_MOVING_SPEED_KMH
    && timestamp - previousMovingAt <= DISPLAY_SPEED_HOLD_MS
  );

  return {
    lastMovingAt: isTransientLiveDrop ? previousMovingAt : 0,
    speedKmh: isTransientLiveDrop ? previousSpeedKmh : 0,
  };
}

function isConsistentSpeedPair(previousSpeedKmh: number, currentSpeedKmh: number) {
  if (!Number.isFinite(previousSpeedKmh) || !Number.isFinite(currentSpeedKmh)) return false;
  const toleranceKmh = Math.max(18, Math.max(previousSpeedKmh, currentSpeedKmh) * 0.25);
  return Math.abs(previousSpeedKmh - currentSpeedKmh) <= toleranceKmh;
}

function isQualifiedSpeedReading(reading: GpsReading) {
  const speedKmh = Number(reading.speedKmh);
  const derivedSpeedKmh = Number(reading.derivedSpeedKmh);
  const deviceSpeedKmh = reading.deviceSpeedKmh == null
    ? null
    : Number(reading.deviceSpeedKmh);
  const elapsedSeconds = Number(reading.elapsedSeconds);
  if (
    !reading.accepted
    || reading.reason !== 'movement'
    || !Number.isFinite(speedKmh)
    || speedKmh < MIN_MOVING_SPEED_KMH
    || speedKmh > MAX_DRIVE_SPEED_KMH
    || !Number.isFinite(elapsedSeconds)
    || elapsedSeconds <= 0
    || elapsedSeconds > MAX_SPEED_SAMPLE_GAP_SECONDS
    || Number(reading.accuracy) > MAX_SPEED_RECORD_ACCURACY_METERS
  ) {
    return false;
  }

  if (deviceSpeedKmh == null || !Number.isFinite(derivedSpeedKmh)) return true;
  const allowedDifferenceKmh = Math.max(20, derivedSpeedKmh * 0.35);
  return Math.abs(deviceSpeedKmh - derivedSpeedKmh) <= allowedDifferenceKmh;
}

export function updateDriveMetrics(
  currentMetrics: DriveMetrics,
  reading: GpsReading,
): DriveMetrics {
  if (!reading.accepted) return currentMetrics;

  const distanceKm = Math.max(0, Number(reading.distanceKm) || 0);
  const elapsedSeconds = Math.max(0, Number(reading.elapsedSeconds) || 0);
  const isMoving = (
    reading.reason === 'movement'
    && distanceKm > 0
    && Number(reading.speedKmh) >= MIN_MOVING_SPEED_KMH
  );
  const sessionKm = Number((currentMetrics.sessionKm + distanceKm).toFixed(4));
  const movingSeconds = Number((
    currentMetrics.movingSeconds + (isMoving ? elapsedSeconds : 0)
  ).toFixed(1));
  const qualified = isQualifiedSpeedReading(reading);
  const speedKmh = Math.max(0, Number(reading.speedKmh) || 0);
  const lastQualifiedSpeedKmh = qualified ? speedKmh : null;
  const confirmedSpeedKmh = qualified && isConsistentSpeedPair(
    Number(currentMetrics.lastQualifiedSpeedKmh),
    speedKmh,
  )
    ? Math.min(Number(currentMetrics.lastQualifiedSpeedKmh), speedKmh)
    : 0;

  return {
    acceptedSampleCount: currentMetrics.acceptedSampleCount + 1,
    averageSpeedKmh: movingSeconds > 0
      ? Number(((sessionKm / movingSeconds) * 3600).toFixed(1))
      : 0,
    lastQualifiedSpeedKmh,
    maxSpeedKmh: Number(Math.max(currentMetrics.maxSpeedKmh, confirmedSpeedKmh).toFixed(1)),
    movingSeconds,
    qualifiedSpeedSampleCount: currentMetrics.qualifiedSpeedSampleCount + (qualified ? 1 : 0),
    sessionKm,
  };
}

export function normalizeGpsPosition(position: LocationObject): GpsPoint | null {
  const latitude = finiteNumber(position.coords.latitude);
  const longitude = finiteNumber(position.coords.longitude);
  if (
    latitude == null
    || longitude == null
    || Math.abs(latitude) > 90
    || Math.abs(longitude) > 180
  ) {
    return null;
  }

  const speedMetersPerSecond = finiteNumber(position.coords.speed);
  const reportedHeading = finiteNumber(position.coords.heading);
  return {
    lat: latitude,
    lng: longitude,
    accuracy: Math.max(
      0,
      finiteNumber(position.coords.accuracy) ?? MAX_GPS_ACCURACY_METERS,
    ),
    deviceSpeedKmh: speedMetersPerSecond == null
      ? null
      : Math.max(0, speedMetersPerSecond * 3.6),
    heading: reportedHeading == null ? null : (reportedHeading + 360) % 360,
    timestamp: finiteNumber(position.timestamp) ?? Date.now(),
  };
}

export function processGpsPosition(
  previousPoint: GpsPoint | null,
  position: LocationObject,
): GpsReading {
  const point = normalizeGpsPosition(position);
  if (!point) {
    return {
      accepted: false,
      distanceKm: 0,
      gpsStatus: 'error',
      location: null,
      nextPoint: previousPoint,
      reason: 'invalid-position',
      speedKmh: 0,
    };
  }

  const location = { lat: point.lat, lng: point.lng, accuracy: point.accuracy };
  if (point.accuracy > MAX_GPS_ACCURACY_METERS) {
    return {
      accepted: false,
      accuracy: point.accuracy,
      distanceKm: 0,
      gpsStatus: 'weak',
      location,
      nextPoint: previousPoint,
      reason: 'weak-accuracy',
      heading: point.heading,
      speedKmh: 0,
      timestamp: point.timestamp,
    };
  }

  const deviceSpeedKmh = point.deviceSpeedKmh != null
    && point.deviceSpeedKmh <= MAX_DRIVE_SPEED_KMH
    ? point.deviceSpeedKmh
    : null;
  if (!previousPoint) {
    return {
      accepted: true,
      accuracy: point.accuracy,
      distanceKm: 0,
      gpsStatus: 'live',
      location,
      nextPoint: point,
      reason: 'initial-fix',
      derivedSpeedKmh: null,
      deviceSpeedKmh,
      elapsedSeconds: 0,
      heading: point.heading,
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
      gpsStatus: 'live',
      location,
      nextPoint: previousPoint,
      reason: 'stale-fix',
      heading: point.heading,
      speedKmh: 0,
      timestamp: point.timestamp,
    };
  }

  if (elapsedMs > MAX_GPS_SAMPLE_GAP_MS) {
    return {
      accepted: true,
      accuracy: point.accuracy,
      distanceKm: 0,
      gpsStatus: 'live',
      location,
      nextPoint: point,
      reason: 'baseline-reset',
      derivedSpeedKmh: null,
      deviceSpeedKmh,
      elapsedSeconds: 0,
      heading: point.heading,
      speedKmh: Number((deviceSpeedKmh ?? 0).toFixed(1)),
      timestamp: point.timestamp,
    };
  }

  const elapsedSeconds = elapsedMs / 1000;
  const distanceMeters = getDistanceMeters(previousPoint, point);
  const accuracyAllowance = Math.max(previousPoint.accuracy, point.accuracy);
  const maximumDistanceMeters = (MAX_DRIVE_SPEED_KMH / 3.6) * elapsedSeconds
    + accuracyAllowance;
  if (distanceMeters > maximumDistanceMeters) {
    return {
      accepted: false,
      accuracy: point.accuracy,
      distanceKm: 0,
      gpsStatus: 'weak',
      location,
      nextPoint: previousPoint,
      reason: 'implausible-jump',
      heading: point.heading,
      speedKmh: 0,
      timestamp: point.timestamp,
    };
  }

  const jitterThresholdMeters = Math.max(
    8,
    Math.min(30, Math.max(previousPoint.accuracy, point.accuracy) * 1.5),
  );
  const derivedSpeedKmh = (distanceMeters / elapsedSeconds) * 3.6;
  const deviceReportsStationary = deviceSpeedKmh != null
    && deviceSpeedKmh < MIN_MOVING_SPEED_KMH;
  const candidateSpeedKmh = deviceSpeedKmh ?? derivedSpeedKmh;
  const isMovement = (
    !deviceReportsStationary
    && distanceMeters >= jitterThresholdMeters
    && candidateSpeedKmh >= MIN_MOVING_SPEED_KMH
  );
  const nextPoint = (
    isMovement
    || deviceReportsStationary
    || distanceMeters >= jitterThresholdMeters
  )
    ? point
    : previousPoint;

  return {
    accepted: true,
    accuracy: point.accuracy,
    distanceKm: Number(((isMovement ? distanceMeters : 0) / 1000).toFixed(4)),
    gpsStatus: 'live',
    location,
    nextPoint,
    reason: isMovement ? 'movement' : 'stationary',
    derivedSpeedKmh: Number(derivedSpeedKmh.toFixed(1)),
    deviceSpeedKmh: deviceSpeedKmh == null ? null : Number(deviceSpeedKmh.toFixed(1)),
    elapsedSeconds: Number(elapsedSeconds.toFixed(3)),
    heading: point.heading,
    speedKmh: Number(Math.min(
      MAX_DRIVE_SPEED_KMH,
      Math.max(0, isMovement ? candidateSpeedKmh : 0),
    ).toFixed(1)),
    timestamp: point.timestamp,
  };
}
