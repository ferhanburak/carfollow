import { describe, expect, it } from "vitest";
import { getActionError } from "./actionFeedback";

describe("getActionError", () => {
  it("hides successful action messages", () => {
    expect(getActionError("Arkadaşlık isteği gönderildi.")).toBe("");
    expect(getActionError("Sürücü yönetici yapildi.")).toBe("");
  });

  it("keeps actionable failures visible", () => {
    expect(getActionError("Konvoy daveti gönderilemedi.")).toBe("Konvoy daveti gönderilemedi.");
    expect(getActionError("Bu işlem için yetkiniz yok.")).toBe("Bu işlem için yetkiniz yok.");
  });
});
