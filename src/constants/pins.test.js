import { describe, expect, it } from "vitest";
import { getPinIcon, getPinTypeMeta, PIN_TYPE_META } from "./pins";

describe("pin constants", () => {
  it("returns stable icons for supported pin types", () => {
    expect(getPinIcon("spot")).toBe("📸");
    expect(getPinIcon("wash")).toBe("🧼");
    expect(getPinIcon("meet")).toBe("🏍️");
  });

  it("falls back to cruise meet metadata for unknown pin types", () => {
    expect(getPinTypeMeta("unknown")).toEqual(PIN_TYPE_META.meet);
  });
});
