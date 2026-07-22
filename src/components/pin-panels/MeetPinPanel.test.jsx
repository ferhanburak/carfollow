import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeetPinPanel } from "./MeetPinPanel";

const host = {
  firebaseUid: "host-1",
  plate: "06 HOST 01",
  fullName: "Convoy Host",
  driverScore: 90,
  harmonyVotes: 4,
  alertVotes: 0,
};

const driver = {
  userId: "driver-2",
  plate: "34 DRIVER 02",
  fullName: "Guest Driver",
  model: "Honda Civic",
};

function createPin(overrides = {}) {
  return {
    id: "convoy-1",
    type: "meet",
    name: "Night Route",
    route: "Golbasi",
    time: "22:00",
    capacity: 12,
    createdByPlate: host.plate,
    hostUserId: host.firebaseUid,
    visibility: "public",
    detailVisibility: "public",
    accessPolicy: "open",
    lifecycleStatus: "planning",
    attendees: [],
    pendingRequests: [],
    invitedGuests: [],
    ...overrides,
  };
}

function renderPanel(overrides = {}) {
  const props = {
    pin: createPin(),
    user: host,
    driverSearchResults: [driver],
    onDriverSearchChange: vi.fn(),
    onInviteDriver: vi.fn().mockResolvedValue(true),
    onJoinCruise: vi.fn(),
    onSetConvoyLifecycleStatus: vi.fn(),
    ...overrides,
  };
  return { ...render(<MeetPinPanel {...props} />), props };
}

describe("MeetPinPanel convoy invitations", () => {
  it("lets the host search by plate and invite from convoy details", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.type(screen.getByRole("textbox", { name: "Konvoya davet edilecek plaka" }), driver.plate);
    expect(screen.getByText("Guest Driver")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Davet Et" }));

    expect(props.onDriverSearchChange).toHaveBeenLastCalledWith("");
    expect(props.onInviteDriver).toHaveBeenCalledWith("convoy-1", driver);
  });

  it("prevents inviting a driver who is already invited", async () => {
    const user = userEvent.setup();
    renderPanel({ pin: createPin({ invitedGuests: [driver] }) });

    await user.type(screen.getByRole("textbox", { name: "Konvoya davet edilecek plaka" }), driver.plate);
    expect(screen.getByRole("button", { name: "Davet Edildi" })).toBeDisabled();
  });
});
