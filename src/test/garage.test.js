import { computeFuelInsights, getPartHealth } from "../utils/garage";
import { validateServiceLogForm } from "../utils/validation";

describe("garage utilities", () => {
  it("computes fuel insights from descending odometer history", () => {
    const logs = [
      { liters: 40, price: 2000, currentKm: 10100, station: "A" },
      { liters: 35, price: 1800, currentKm: 9600, station: "B" },
      { liters: 38, price: 1900, currentKm: 9100, station: "C" },
    ];

    const insights = computeFuelInsights(logs);

    expect(insights.average).toBeCloseTo(7.5, 1);
    expect(insights.costPerFill).toBeCloseTo(1900, 1);
    expect(insights.totalSpend).toBe(5700);
  });

  it("calculates part health by replaced kilometer and life expectancy", () => {
    const part = { replacedKm: 10000, lifeExpectancy: 5000 };
    expect(getPartHealth(part, 12000)).toBe(60);
    expect(getPartHealth(part, 15000)).toBe(0);
  });

  it("uses the stricter calendar lifetime for maintenance health", () => {
    const part = {
      replacedKm: 10000,
      lifeExpectancyKm: 50000,
      replacedAt: "2025-01-01",
      lifeExpectancyMonths: 12,
    };
    expect(getPartHealth(part, 12000, new Date("2026-07-01T00:00:00.000Z"))).toBe(0);
  });

  it("accepts historical service kilometers for passport imports", () => {
    const errors = validateServiceLogForm(
      {
        partKey: "oil",
        serviceDate: "2025-03-10",
        serviceKm: 64000,
        serviceShop: "Apex Garage",
        cost: 2250,
      },
      68420,
    );

    expect(errors).not.toHaveProperty("serviceKm");
  });
});
