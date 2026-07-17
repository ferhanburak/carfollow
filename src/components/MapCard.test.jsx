import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-google-maps/api", () => ({
  GoogleMap: ({ children }) => <div data-testid="google-map">{children}</div>,
  InfoWindowF: ({ children }) => <div>{children}</div>,
  MarkerF: ({ position, title }) => (
    <div data-testid="map-marker" data-position={JSON.stringify(position)} data-title={title ?? ""} />
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
        SymbolPath: { CIRCLE: "circle" },
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
        onSelect={() => {}}
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
    const convoyMarker = screen.getAllByTestId("map-marker").find((marker) =>
      marker.dataset.title.includes("Ankara test convoy"));
    expect(JSON.parse(convoyMarker.dataset.position)).toEqual(routePath[0]);

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("map-polyline").dataset.path)).toEqual(routePath);
    });
  });
});
