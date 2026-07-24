import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  getFirebaseServices: vi.fn(),
  invokeCallable: vi.fn(),
}));

vi.mock("../services/firebaseClient", () => ({
  getFirebaseServices: mocks.getFirebaseServices,
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn((_functions, name) => (payload) => mocks.invokeCallable(name, payload)),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_firestore, path) => ({ path })),
  doc: vi.fn((_firestore, path) => ({ path })),
  getDoc: mocks.getDoc,
  getDocs: mocks.getDocs,
  query: vi.fn((reference) => reference),
}));

import {
  finishFirebaseDriveSession,
  loadFirebaseDriverStatsState,
  startFirebaseDriveSession,
} from "./firebaseDriverStatsRepository";

function documentSnapshot(data = null) {
  return {
    exists: () => data !== null,
    data: () => data,
  };
}

beforeEach(() => {
  mocks.getDoc.mockReset();
  mocks.getDocs.mockReset();
  mocks.invokeCallable.mockReset();
  mocks.getFirebaseServices.mockReset();
  mocks.getFirebaseServices.mockResolvedValue({
    authUser: { uid: "user-1" },
    firestore: { id: "firestore" },
    functions: { id: "functions" },
  });
  mocks.getDocs.mockResolvedValue({ docs: [] });
});

describe("Firebase driver stats repository", () => {
  it("refreshes private stats and reads the public leaderboard", async () => {
    mocks.invokeCallable.mockResolvedValue({
      data: {
        stats: { userId: "user-1", monthlyKm: 24.8 },
        partHealth: [{ key: "oil", healthPercent: 74 }],
      },
    });
    mocks.getDocs.mockResolvedValue({
      docs: [{
        id: "2026-07__user-1",
        data: () => ({ id: "2026-07__user-1", userId: "user-1", monthlyKm: 24.8 }),
      }],
    });

    const state = await loadFirebaseDriverStatsState();

    expect(mocks.invokeCallable).toHaveBeenCalledWith("refreshDriverStats", {});
    expect(state.stats.monthlyKm).toBe(24.8);
    expect(state.partHealth).toEqual([{ key: "oil", healthPercent: 74 }]);
    expect(state.leaderboardEntries).toHaveLength(1);
    expect(state.warning).toBe("");
  });

  it("falls back to the readable stats document when refresh is unavailable", async () => {
    mocks.invokeCallable.mockRejectedValue(Object.assign(new Error("Function missing"), {
      code: "functions/not-found",
    }));
    mocks.getDoc.mockResolvedValue(documentSnapshot({ userId: "user-1", monthlyKm: 12 }));

    const state = await loadFirebaseDriverStatsState();

    expect(state.stats.monthlyKm).toBe(12);
    expect(state.warning).toContain("Function missing");
  });

  it("sends idempotent start and finish payloads to callable functions", async () => {
    mocks.invokeCallable
      .mockResolvedValueOnce({ data: { sessionId: "ride-user-1-123456", status: "active" } })
      .mockResolvedValueOnce({ data: { sessionId: "ride-user-1-123456", acceptedKm: 4.8 } });

    await startFirebaseDriveSession("ride-user-1-123456");
    await finishFirebaseDriveSession("ride-user-1-123456", {
      acceptedSampleCount: 20,
      qualifiedSpeedSampleCount: 6,
      reportedKm: 4.8,
      reportedMaxSpeedKmh: 112,
      reportedMovingSeconds: 240,
    });

    expect(mocks.invokeCallable).toHaveBeenNthCalledWith(1, "startDriveSession", {
      sessionId: "ride-user-1-123456",
    });
    expect(mocks.invokeCallable).toHaveBeenNthCalledWith(2, "finishDriveSession", {
      acceptedSampleCount: 20,
      qualifiedSpeedSampleCount: 6,
      reportedMaxSpeedKmh: 112,
      reportedMovingSeconds: 240,
      sessionId: "ride-user-1-123456",
      reportedKm: 4.8,
    });
  });

  it("keeps the legacy numeric finish signature backward compatible", async () => {
    mocks.invokeCallable.mockResolvedValueOnce({ data: { acceptedKm: 2.4 } });

    await finishFirebaseDriveSession("ride-user-1-123456", 2.4);

    expect(mocks.invokeCallable).toHaveBeenCalledWith("finishDriveSession", {
      acceptedSampleCount: 0,
      qualifiedSpeedSampleCount: 0,
      reportedKm: 2.4,
      reportedMaxSpeedKmh: 0,
      reportedMovingSeconds: 0,
      sessionId: "ride-user-1-123456",
    });
  });
});
