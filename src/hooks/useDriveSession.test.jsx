import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDriveSession } from "./useDriveSession";

function createHookProps(overrides = {}) {
  return {
    user: {
      id: "user-1",
      plate: "06 TEST 01",
      model: "Test Car",
      clan: "Test Clan",
      monthlyKm: 0,
      odometer: 1000,
    },
    setUser: vi.fn(),
    setClans: vi.fn(),
    setMapPins: vi.fn(),
    onTelemetrySync: vi.fn(),
    onSessionStart: vi.fn().mockResolvedValue({
      ok: true,
      sessionId: "ride-user-1-123456",
      status: "active",
    }),
    onSessionFinish: vi.fn().mockResolvedValue({
      ok: true,
      acceptedKm: 0,
      rejectedKm: 0,
    }),
    serverOwnedDriverStats: true,
    liveLocation: { error: "", location: null, sample: null, status: "requesting" },
    ...overrides,
  };
}

describe("useDriveSession", () => {
  it("opens and finalizes a secure drive session", async () => {
    const props = createHookProps();
    const { result } = renderHook(() => useDriveSession(props));

    await act(async () => {
      await result.current.toggleDrive();
    });
    expect(result.current.isDriving).toBe(true);
    expect(result.current.driveSessionStatus).toBe("active");
    expect(result.current.driveSessionId).toBe("ride-user-1-123456");
    expect(props.onTelemetrySync).toHaveBeenCalledWith(expect.objectContaining({
      active: true,
      plate: "06 TEST 01",
    }));

    await act(async () => {
      await result.current.toggleDrive();
    });
    expect(props.onSessionFinish).toHaveBeenCalledWith({
      sessionId: "ride-user-1-123456",
      reportedKm: 0,
    });
    expect(result.current.isDriving).toBe(false);
    expect(result.current.driveSessionStatus).toBe("completed");
    expect(props.onTelemetrySync).toHaveBeenLastCalledWith(expect.objectContaining({
      active: false,
      speed: 0,
    }));
  });

  it("does not enter driving mode when the backend rejects start", async () => {
    const props = createHookProps({
      onSessionStart: vi.fn().mockResolvedValue({ ok: false, error: "Backend unavailable" }),
    });
    const { result } = renderHook(() => useDriveSession(props));

    await act(async () => {
      await result.current.toggleDrive();
    });

    expect(result.current.isDriving).toBe(false);
    expect(result.current.driveSessionStatus).toBe("error");
    expect(result.current.driveSessionFeedback).toBe("Backend unavailable");
  });

  it("keeps the drive active when finalization fails so it can be retried", async () => {
    const props = createHookProps({
      onSessionFinish: vi.fn().mockResolvedValue({ ok: false, error: "Finalize failed" }),
    });
    const { result } = renderHook(() => useDriveSession(props));

    await act(async () => {
      await result.current.toggleDrive();
    });
    await act(async () => {
      await result.current.toggleDrive();
    });

    expect(result.current.isDriving).toBe(true);
    expect(result.current.driveSessionId).toBe("ride-user-1-123456");
    expect(result.current.driveSessionStatus).toBe("error");
    expect(result.current.driveSessionFeedback).toContain("Finalize failed");
  });

  it("updates speed, distance, and odometer from real GPS fixes", async () => {
    let currentUser;
    let liveLocation = createHookProps().liveLocation;
    const props = createHookProps();
    currentUser = props.user;
    props.setUser.mockImplementation((updater) => {
      currentUser = updater(currentUser);
    });
    const { result, rerender } = renderHook(() => useDriveSession({ ...props, liveLocation }));

    await act(async () => {
      await result.current.toggleDrive();
    });

    liveLocation = {
      error: "",
      location: { accuracy: 8, heading: 0, lat: 39.92, lng: 32.85 },
      sample: {
        id: 1,
        position: {
          coords: { accuracy: 8, heading: 0, latitude: 39.92, longitude: 32.85, speed: 10 },
          timestamp: 1_000,
        },
      },
      status: "live",
    };
    act(() => {
      rerender();
    });
    liveLocation = {
      ...liveLocation,
      location: { accuracy: 8, heading: 0, lat: 39.9209, lng: 32.85 },
      sample: {
        id: 2,
        position: {
          coords: { accuracy: 8, heading: 0, latitude: 39.9209, longitude: 32.85, speed: null },
          timestamp: 11_000,
        },
      },
    };
    act(() => {
      rerender();
    });

    expect(result.current.driveHud.gpsStatus).toBe("live");
    expect(result.current.driveHud.speed).toBeGreaterThan(32);
    expect(result.current.driveHud.sessionKm).toBeGreaterThan(0.09);
    expect(currentUser.odometer).toBeGreaterThan(1000.09);
  });
});
