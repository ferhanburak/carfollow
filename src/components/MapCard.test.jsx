import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-google-maps/api", () => ({
  GoogleMap: ({ children, onClick }) => (
    <div
      data-testid="google-map"
      onClick={() => onClick?.({ latLng: { lat: () => 39.87, lng: () => 32.78 } })}
    >
      {children}
    </div>
  ),
  InfoWindowF: ({ children }) => <div>{children}</div>,
  MarkerF: ({ icon, position, title, zIndex }) => (
    <div data-testid="map-marker" data-icon={JSON.stringify(icon)} data-position={JSON.stringify(position)} data-title={title ?? ""} data-z-index={zIndex} />
  ),
  PolylineF: ({ path }) => <div data-testid="map-polyline" data-path={JSON.stringify(path)} />,
  useJsApiLoader: () => ({ isLoaded: true, loadError: null }),
}));

import { GoogleMapCard } from "./MapCard";

const routePath = [
  { lat: 39.9208, lng: 32.8541 },
  { lat: 39.9004, lng: 32.8093 },
  { lat: 39.9021, lng: 32.7029 },
];

describe("GoogleMapCard convoy overlays", () => {
  beforeEach(() => {
    window.google = {
      maps: {
        Point: class Point {},
        Size: class Size {},
        SymbolPath: { CIRCLE: "circle", FORWARD_CLOSED_ARROW: "forward-arrow" },
        importLibrary: vi.fn().mockResolvedValue({
          Route: {
            computeRoutes: vi.fn().mockResolvedValue({
              routes: [{ path: routePath, distanceMeters: 14500, duration: "1200s" }],
            }),
          },
        }),
      },
    };
  });

  it("renders the accessible convoy as a map marker and route polyline", async () => {
    const onSelect = vi.fn();
    const convoy = {
      id: "convoy-route-test",
      type: "meet",
      name: "Ankara test convoy",
      lat: routePath[0].lat,
      lng: routePath[0].lng,
      routePath,
      attendees: [],
      backendCanViewDetails: true,
      backendCanJoin: true,
    };

    render(
      <GoogleMapCard
        mapsApiKey="test-key"
        drivers={[]}
        pins={[convoy]}
        selectedPin={convoy}
        selectedPinId={convoy.id}
        onSelect={onSelect}
        user={{ firebaseUid: "member-1" }}
        driveHud={{}}
        draftRoutePath={[]}
        isDriving={false}
        mapPickMode="node"
        fullScreen={false}
        navigationMode={false}
        mapHeight="18rem"
      />,
    );

    expect(screen.getByTestId("google-map")).toBeInTheDocument();
    expect(screen.queryByText("Selected Node")).not.toBeInTheDocument();
    const convoyMarker = screen.getAllByTestId("map-marker").find((marker) =>
      marker.dataset.title.includes("Ankara test convoy"));
    expect(JSON.parse(convoyMarker.dataset.position)).toEqual(routePath[0]);

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("map-polyline").dataset.path)).toEqual(routePath);
    });

    fireEvent.click(screen.getByTestId("google-map"));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("keeps the full-screen Google map shell stretched to its parent", () => {
    render(
      <GoogleMapCard
        mapsApiKey="test-key"
        drivers={[]}
        pins={[]}
        selectedPin={null}
        selectedPinId={null}
        onSelect={vi.fn()}
        user={{ firebaseUid: "member-1" }}
        driveHud={{}}
        draftRoutePath={[]}
        isDriving={false}
        mapPickMode="node"
        fullScreen
        navigationMode
        mapHeight="18rem"
      />,
    );

    expect(screen.getByTestId("google-map-shell")).toHaveClass("absolute", "inset-0", "h-full", "w-full");
    expect(screen.getByTestId("google-map-shell")).not.toHaveClass("relative");
  });

  it("renders self, friend, clan and stranger markers with relationship priority", () => {
    const drivers = [
      { firebaseUid: "self-1", lat: 39.91, lng: 32.81, plate: "06 SELF 01", vehicle: "Self Car", locationVisibility: "exact" },
      { firebaseUid: "friend-clan-1", lat: 39.92, lng: 32.82, plate: "06 FRIEND 01", vehicle: "Friend Car", locationVisibility: "exact" },
      { firebaseUid: "clan-1", lat: 39.93, lng: 32.83, plate: "06 CLAN 01", vehicle: "Clan Car", locationVisibility: "exact" },
      { firebaseUid: "other-1", lat: 39.94, lng: 32.84, plate: "06 OTHER 01", vehicle: "Other Car", locationVisibility: "approximate" },
      { firebaseUid: "blocked-1", lat: 39.95, lng: 32.85, plate: "06 BLOCK 01", vehicle: "Blocked Car", locationVisibility: "exact" },
    ];

    render(
      <GoogleMapCard
        mapsApiKey="test-key"
        drivers={drivers}
        currentClanMembers={[{ userId: "friend-clan-1" }, { userId: "clan-1" }]}
        pins={[]}
        selectedPin={null}
        selectedPinId={null}
        onSelect={vi.fn()}
        user={{
          firebaseUid: "self-1",
          blockedDrivers: [{ userId: "blocked-1" }],
          friends: [{ userId: "friend-clan-1" }],
        }}
        driveHud={{}}
        liveLocation={{ location: { accuracy: 7, heading: 84, lat: 39.9, lng: 32.8 }, status: "live" }}
        draftRoutePath={[]}
        isDriving={false}
        mapPickMode="node"
        fullScreen
        navigationMode
        mapHeight="18rem"
      />,
    );

    const markers = screen.getAllByTestId("map-marker");
    const markerByTitle = (value) => markers.find((marker) => marker.dataset.title.includes(value));
    expect(JSON.parse(markerByTitle("Senin konumun").dataset.icon)).toMatchObject({ fillColor: "#38bdf8", path: "forward-arrow", rotation: 84 });
    expect(JSON.parse(markerByTitle("Friend Car").dataset.icon).fillColor).toBe("#22c55e");
    expect(JSON.parse(markerByTitle("Clan Car").dataset.icon).fillColor).toBe("#facc15");
    expect(JSON.parse(markerByTitle("Other Car").dataset.icon).fillColor).toBe("#f43f5e");
    expect(markerByTitle("Self Car")).toBeUndefined();
    expect(markerByTitle("Blocked Car")).toBeUndefined();
    expect(screen.getByLabelText("Surucu renkleri")).toBeInTheDocument();
  });
});
