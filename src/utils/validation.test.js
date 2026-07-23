import { describe, expect, it } from "vitest";
import { createMapPinForm } from "./garage";
import { validateMapPinForm } from "./validation";

describe("meet event route validation", () => {
  const validBase = () => ({
    ...createMapPinForm(),
    name: "Mogan Bulusmasi",
    route: "Mogan ana otopark",
  });

  it("accepts a single-point meetup without route nodes", () => {
    const errors = validateMapPinForm({ ...validBase(), eventMode: "meetup", routePoints: [] });
    expect(errors.routePoints).toBeUndefined();
  });

  it("requires two nodes for a route convoy", () => {
    const errors = validateMapPinForm({ ...validBase(), eventMode: "convoy", routePoints: [] });
    expect(errors.routePoints).toBe("Rota konvoyu icin en az 2 rota noktasi sec.");
  });
});
