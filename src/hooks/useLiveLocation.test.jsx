import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveLocation } from "./useLiveLocation";

const geolocation = {
  clearWatch: vi.fn(),
  watchPosition: vi.fn(() => 71),
};

function position({ accuracy = 8, heading = null, lat = 39.92, lng = 32.85, speed = null, timestamp = 1_000 } = {}) {
  return {
    coords: { accuracy, heading, latitude: lat, longitude: lng, speed },
    timestamp,
  };
}

beforeEach(() => {
  geolocation.clearWatch.mockClear();
  geolocation.watchPosition.mockClear();
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: geolocation });
});

afterEach(() => {
  delete navigator.geolocation;
});

describe("useLiveLocation", () => {
  it("uses one high-accuracy watcher and exposes a smoothed heading-aware location", () => {
    const { result, rerender } = renderHook(({ enabled }) => useLiveLocation({ enabled }), {
      initialProps: { enabled: true },
    });
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);
    expect(geolocation.watchPosition.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true, maximumAge: 1000 });

    const onPosition = geolocation.watchPosition.mock.calls[0][0];
    act(() => onPosition(position({ heading: 42, speed: 8 })));
    expect(result.current).toMatchObject({ status: "live", location: { heading: 42, lat: 39.92, lng: 32.85 } });

    act(() => onPosition(position({ heading: null, lat: 39.9203, timestamp: 3_000 })));
    expect(result.current.location.lat).toBeGreaterThan(39.92);
    expect(result.current.location.lat).toBeLessThan(39.9203);

    rerender({ enabled: false });
    expect(geolocation.clearWatch).toHaveBeenCalledWith(71);
  });

  it("keeps the last reliable location when accuracy becomes weak", () => {
    const { result } = renderHook(() => useLiveLocation({ enabled: true }));
    const onPosition = geolocation.watchPosition.mock.calls[0][0];
    act(() => onPosition(position()));
    const reliableLocation = result.current.location;
    act(() => onPosition(position({ accuracy: 180, lat: 40, timestamp: 2_000 })));

    expect(result.current.status).toBe("weak");
    expect(result.current.location).toEqual(reliableLocation);
  });
});
