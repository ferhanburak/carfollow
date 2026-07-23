import { describe, expect, it } from "vitest";
import { getActionError } from "./actionFeedback";

describe("getActionError", () => {
  it("hides successful action messages", () => {
    expect(getActionError("Arkadaslik istegi gonderildi.")).toBe("");
    expect(getActionError("Surucu yonetici yapildi.")).toBe("");
  });

  it("keeps actionable failures visible", () => {
    expect(getActionError("Konvoy daveti gonderilemedi.")).toBe("Konvoy daveti gonderilemedi.");
    expect(getActionError("Bu islem icin yetkiniz yok.")).toBe("Bu islem icin yetkiniz yok.");
  });
});
