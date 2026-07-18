import { describe, expect, it } from "vitest";
import {
  getDistanceMeters,
  getGeolocationErrorStatus,
  processGpsPosition,
} from "./driveTelemetry";

function position({
  accuracy = 8,
  lat = 39.92,
  lng = 32.85,
  speed = null,
  timestamp = 1_000,
} = {}) {
  return {
    coords: {
      accuracy,
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

  it("maps browser permission failures to a clear status", () => {
    expect(getGeolocationErrorStatus({ code: 1 })).toEqual({
      status: "denied",
      message: "Konum izni reddedildi. Surus verisi kaydedilmiyor.",
    });
  });
});
