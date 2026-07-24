import { describe, expect, it } from "vitest";
import {
  createDriveMetrics,
  getDistanceMeters,
  getBearingDegrees,
  getGeolocationErrorStatus,
  processGpsPosition,
  smoothGpsLocation,
  updateDriveMetrics,
} from "./driveTelemetry";

function position({
  accuracy = 8,
  heading = null,
  lat = 39.92,
  lng = 32.85,
  speed = null,
  timestamp = 1_000,
} = {}) {
  return {
    coords: {
      accuracy,
      heading,
      latitude: lat,
      longitude: lng,
      speed,
    },
    timestamp,
  };
}

describe("drive telemetry", () => {
  it("uses the device GPS speed and establishes the initial baseline", () => {
    const reading = processGpsPosition(null, position({ speed: 10 }));

    expect(reading).toMatchObject({
      accepted: true,
      distanceKm: 0,
      gpsStatus: "live",
      reason: "initial-fix",
      speedKmh: 36,
    });
  });

  it("derives real speed and distance from consecutive GPS fixes", () => {
    const initial = processGpsPosition(null, position());
    const reading = processGpsPosition(initial.nextPoint, position({
      lat: 39.9209,
      timestamp: 11_000,
    }));

    expect(reading.accepted).toBe(true);
    expect(reading.reason).toBe("movement");
    expect(reading.distanceKm).toBeGreaterThan(0.09);
    expect(reading.distanceKm).toBeLessThan(0.11);
    expect(reading.speedKmh).toBeGreaterThan(32);
    expect(reading.speedKmh).toBeLessThan(40);
  });

  it("does not count weak GPS fixes or implausible jumps", () => {
    const initial = processGpsPosition(null, position());
    const weak = processGpsPosition(initial.nextPoint, position({
      accuracy: 180,
      lat: 39.921,
      timestamp: 2_000,
    }));
    const jump = processGpsPosition(initial.nextPoint, position({
      lat: 40.5,
      timestamp: 2_000,
    }));

    expect(weak).toMatchObject({ accepted: false, distanceKm: 0, reason: "weak-accuracy" });
    expect(jump).toMatchObject({ accepted: false, distanceKm: 0, reason: "implausible-jump" });
  });

  it("ignores minor stationary jitter", () => {
    const initial = processGpsPosition(null, position({ accuracy: 20 }));
    const reading = processGpsPosition(initial.nextPoint, position({
      accuracy: 20,
      lat: 39.92001,
      timestamp: 2_000,
    }));

    expect(getDistanceMeters(initial.nextPoint, reading.nextPoint)).toBeLessThan(2);
    expect(reading).toMatchObject({ accepted: true, distanceKm: 0, reason: "stationary" });
  });

  it("rejects coordinate drift when the device reports zero speed", () => {
    const initial = processGpsPosition(null, position({ accuracy: 6, speed: 0 }));
    const drift = processGpsPosition(initial.nextPoint, position({
      accuracy: 6,
      lat: 39.9201,
      speed: 0,
      timestamp: 2_000,
    }));

    expect(getDistanceMeters(initial.nextPoint, drift.location)).toBeGreaterThan(10);
    expect(drift).toMatchObject({
      accepted: true,
      distanceKm: 0,
      reason: "stationary",
      speedKmh: 0,
    });
  });

  it("does not convert slow accumulated GPS drift into distance", () => {
    const initial = processGpsPosition(null, position({ accuracy: 6 }));
    const drift = processGpsPosition(initial.nextPoint, position({
      accuracy: 6,
      lat: 39.9201,
      timestamp: 31_000,
    }));

    expect(drift).toMatchObject({
      accepted: true,
      distanceKm: 0,
      reason: "stationary",
      speedKmh: 0,
    });
  });

  it("maps browser permission failures to a clear status", () => {
    expect(getGeolocationErrorStatus({ code: 1 })).toEqual({
      status: "denied",
      message: "Konum izni reddedildi. Surus verisi kaydedilmiyor.",
    });
  });

  it("derives heading and smooths map movement without jumping to the raw fix", () => {
    const previous = { accuracy: 8, heading: 0, lat: 39.92, lng: 32.85, speedKmh: 0 };
    const reading = processGpsPosition(null, position({ heading: null, lat: 39.9203, timestamp: 2_000 }));
    const smoothed = smoothGpsLocation(previous, reading);

    expect(getBearingDegrees(previous, reading.location)).toBeCloseTo(0, 0);
    expect(smoothed.lat).toBeGreaterThan(previous.lat);
    expect(smoothed.lat).toBeLessThan(reading.location.lat);
  });

  it("counts moving time and derives average speed only from accepted movement", () => {
    const initial = processGpsPosition(null, position());
    const movement = processGpsPosition(initial.nextPoint, position({
      lat: 39.9209,
      timestamp: 11_000,
    }));
    const stationary = processGpsPosition(movement.nextPoint, position({
      lat: 39.9209,
      timestamp: 16_000,
    }));

    const afterMovement = updateDriveMetrics(createDriveMetrics(), movement);
    const metrics = updateDriveMetrics(afterMovement, stationary);

    expect(metrics.sessionKm).toBeGreaterThan(0.09);
    expect(metrics.movingSeconds).toBe(10);
    expect(metrics.averageSpeedKmh).toBeGreaterThan(32);
    expect(metrics.acceptedSampleCount).toBe(2);
  });

  it("requires two coherent quality samples before accepting a maximum speed", () => {
    const first = {
      accepted: true,
      accuracy: 8,
      derivedSpeedKmh: 119,
      deviceSpeedKmh: 120,
      distanceKm: 0.033,
      elapsedSeconds: 1,
      reason: "movement",
      speedKmh: 120,
    };
    const second = { ...first, derivedSpeedKmh: 123, deviceSpeedKmh: 124, speedKmh: 124 };

    const singleSample = updateDriveMetrics(createDriveMetrics(), first);
    const confirmed = updateDriveMetrics(singleSample, second);

    expect(singleSample.maxSpeedKmh).toBe(0);
    expect(confirmed.maxSpeedKmh).toBe(120);
    expect(confirmed.qualifiedSpeedSampleCount).toBe(2);
  });

  it("rejects weak or internally inconsistent readings from the maximum speed", () => {
    const weak = {
      accepted: true,
      accuracy: 80,
      derivedSpeedKmh: 140,
      deviceSpeedKmh: 140,
      distanceKm: 0.039,
      elapsedSeconds: 1,
      reason: "movement",
      speedKmh: 140,
    };
    const inconsistent = {
      ...weak,
      accuracy: 8,
      derivedSpeedKmh: 20,
      deviceSpeedKmh: 180,
      speedKmh: 180,
    };

    const metrics = updateDriveMetrics(updateDriveMetrics(createDriveMetrics(), weak), inconsistent);

    expect(metrics.maxSpeedKmh).toBe(0);
    expect(metrics.qualifiedSpeedSampleCount).toBe(0);
  });
});
