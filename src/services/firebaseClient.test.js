import { describe, expect, it, vi } from "vitest";

describe("firebaseClient diagnostics", () => {
  it("reports mock mode during tests", async () => {
    vi.resetModules();
    const { getFirebaseAppCheckDiagnostics, getFirebaseModeDiagnostics } = await import("./firebaseClient");

    expect(getFirebaseModeDiagnostics()).toEqual({
      mode: "mock",
      enabled: false,
      connection: "disabled",
      message: "Mock data mode active. Firebase sync is currently disabled.",
    });
    expect(getFirebaseAppCheckDiagnostics()).toEqual({
      enabled: false,
      mode: "disabled",
      message: "App Check is inactive outside Firebase mode.",
    });
  });
});
