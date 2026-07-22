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

describe("MeetPinPanel convoy management", () => {
  it("lets the host edit convoy details", async () => {
    const user = userEvent.setup();
    const onUpdateConvoyDetails = vi.fn().mockResolvedValue(true);
    renderPanel({ onUpdateConvoyDetails });

    await user.click(screen.getByRole("button", { name: "Konvoy Bilgilerini Duzenle" }));
    const nameInput = screen.getByRole("textbox", { name: /Konvoy Adi/ });
    await user.clear(nameInput);
    await user.type(nameInput, "Ankara Gece Konvoyu");
    await user.click(screen.getByRole("button", { name: "Degisiklikleri Kaydet" }));

    expect(onUpdateConvoyDetails).toHaveBeenCalledWith(expect.objectContaining({
      name: "Ankara Gece Konvoyu",
      route: "Golbasi",
      capacity: 12,
    }));
  });

  it("lets the host promote an approved participant", async () => {
    const user = userEvent.setup();
    const onSetConvoyMemberRole = vi.fn().mockResolvedValue(true);
    const attendee = { ...driver, status: "approved", managementRole: "member" };
    renderPanel({
      pin: createPin({ attendees: [attendee] }),
      onSetConvoyMemberRole,
    });

    await user.click(screen.getByRole("button", { name: "Yonetici Yap" }));
    expect(onSetConvoyMemberRole).toHaveBeenCalledWith(expect.objectContaining({
      userId: driver.userId,
    }), "manager");
  });

  it("gives a delegated manager management tools without cancellation authority", () => {
    const manager = {
      firebaseUid: driver.userId,
      plate: driver.plate,
      fullName: driver.fullName,
    };
    renderPanel({
      user: manager,
      pin: createPin({
        viewerManagementRole: "manager",
        attendees: [{ ...driver, status: "approved", managementRole: "manager" }],
      }),
    });

    expect(screen.getByText("Convoy Management")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Konvoya davet edilecek plaka" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Iptal Edildi" })).not.toBeInTheDocument();
  });
});
