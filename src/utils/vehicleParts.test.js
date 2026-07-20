import { describe, expect, it } from "vitest";
import { getVehiclePartCatalog, normalizeVehiclePart } from "./vehicleParts";

const expectedCarLimits = {
  oil: [15000, 365],
  oilFilter: [15000, 365],
  airFilter: [15000, 365],
  cabinFilter: [15000, 365],
  spark: [60000, 1095],
  coolant: [80000, 1095],
  battery: [999999, 1825],
  transmissionFluid: [90000, 1825],
  frontBrakes: [40000, 730],
  rearBrakes: [60000, 1095],
  frontTires: [50000, 1825],
  rearTires: [50000, 1825],
};

describe("vehicle maintenance limits", () => {
  it("uses the maximum standard kilometer and day boundaries for every car part", () => {
    const actualLimits = Object.fromEntries(
      getVehiclePartCatalog("car").map((part) => [
        part.key,
        [part.lifeExpectancyKm, part.lifeExpectancyDays],
      ]),
    );

    expect(actualLimits).toEqual(expectedCarLimits);
  });

  it("upgrades legacy persisted defaults to the canonical boundary", () => {
    const battery = normalizeVehiclePart({
      key: "battery",
      lifeExpectancyKm: 50000,
      lifeExpectancyMonths: 36,
      replacedKm: 12000,
      replacedAt: "2026-01-01",
    }, "car");

    expect(battery).toMatchObject({
      lifeExpectancyKm: 999999,
      lifeExpectancyDays: 1825,
      lifeExpectancyMonths: 60,
    });
  });
});
