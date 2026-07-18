import { describe, expect, it } from "vitest";
import { incrementUserOdometer } from "../repositories/mockCruiserRepository";

describe("drive mileage updates", () => {
  it("keeps mock monthly mileage behavior by default", () => {
    expect(incrementUserOdometer({ odometer: 1000, monthlyKm: 20 })).toMatchObject({
      odometer: 1000.4,
      monthlyKm: 20.4,
    });
  });

  it("can hold monthly mileage for server-owned Firebase stats", () => {
    expect(incrementUserOdometer(
      { odometer: 1000, monthlyKm: 20 },
      { incrementMonthlyKm: false },
    )).toMatchObject({
      odometer: 1000.4,
      monthlyKm: 20,
    });
  });

  it("increments the odometer by the accepted GPS distance", () => {
    expect(incrementUserOdometer(
      { odometer: 1000, monthlyKm: 20 },
      { distanceKm: 0.0174, incrementMonthlyKm: false },
    )).toMatchObject({
      odometer: 1000.017,
      monthlyKm: 20,
    });
  });
});
