import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFirebaseServices: vi.fn(),
  invokeCallable: vi.fn(),
}));

vi.mock("../services/firebaseClient", () => ({
  getFirebaseServices: mocks.getFirebaseServices,
  isFirebaseModeEnabled: () => true,
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn((_functions, name) => (payload) => mocks.invokeCallable(name, payload)),
}));

import { submitFirebaseModerationReport } from "./firebaseModerationRepository";

beforeEach(() => {
  mocks.getFirebaseServices.mockReset();
  mocks.invokeCallable.mockReset();
  mocks.getFirebaseServices.mockResolvedValue({
    authUser: { uid: "reporter-1" },
    functions: { id: "functions" },
  });
});

describe("Firebase moderation repository", () => {
  it("submits reports only through the moderation callable", async () => {
    const payload = {
      targetType: "driver",
      targetId: "driver-2",
      reason: "dangerous-driving",
      details: "Convoy rules were repeatedly ignored.",
    };
    mocks.invokeCallable.mockResolvedValue({ data: { reportId: "report-1", status: "open" } });

    const result = await submitFirebaseModerationReport(payload);

    expect(mocks.invokeCallable).toHaveBeenCalledWith("submitModerationReport", payload);
    expect(result).toEqual({ reportId: "report-1", status: "open" });
  });
});
