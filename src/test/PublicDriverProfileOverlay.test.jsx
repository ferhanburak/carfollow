import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublicDriverProfileOverlay } from "../components/PublicDriverProfileOverlay";

const currentUser = {
  firebaseUid: "owner-1",
  plate: "06 OWNER 01",
  region: "Ankara",
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  blockedDrivers: [],
};

const stranger = {
  userId: "driver-2",
  plate: "34 DRIVER 02",
  fullName: "Test Driver",
  model: "Honda Civic",
  driverScore: 84,
};

function renderProfile(overrides = {}) {
  return render(
    <PublicDriverProfileOverlay
      hostableConvoys={[
        { id: "convoy-1", name: "Night Route", route: "Golbasi", time: "22:00", capacity: 12, attendees: [] },
        { id: "convoy-2", name: "Morning Route", route: "Incek", time: "08:00", capacity: 8, attendees: [] },
      ]}
      onClose={vi.fn()}
      onInviteFriendToClan={vi.fn()}
      onInviteToConvoy={vi.fn()}
      onOpenConversation={vi.fn()}
      onRequestFriend={vi.fn()}
      profile={stranger}
      user={currentUser}
      {...overrides}
    />,
  );
}

describe("PublicDriverProfileOverlay community invitations", () => {
  it("allows clan and convoy invitations without an accepted friendship", async () => {
    const user = userEvent.setup();
    const onInviteFriendToClan = vi.fn();
    const onInviteToConvoy = vi.fn();
    renderProfile({ onInviteFriendToClan, onInviteToConvoy });

    expect(screen.getByRole("button", { name: "Mesaj Gonder" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Klana Davet" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Konvoya Davet" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Klana Davet" }));
    await user.click(screen.getByRole("button", { name: "Konvoya Davet" }));
    expect(screen.getByText("Konvoy Sec")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Morning Route/i }));

    expect(onInviteFriendToClan).toHaveBeenCalledWith(stranger);
    expect(onInviteToConvoy).toHaveBeenCalledWith("convoy-2", stranger);
  });

  it("does not allow community invitations to a blocked driver", () => {
    renderProfile({
      user: { ...currentUser, blockedDrivers: [{ userId: stranger.userId, plate: stranger.plate }] },
    });

    expect(screen.getByRole("button", { name: "Klana Davet" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Konvoya Davet" })).toBeDisabled();
  });

  it("shows a persistent sent state when the driver is already invited", () => {
    renderProfile({
      hostableConvoys: [{
        id: "convoy-1",
        name: "Night Route",
        capacity: 12,
        attendees: [],
        invitedGuests: [stranger],
      }],
    });

    expect(screen.getByRole("button", { name: "Davet Gonderildi" })).toBeDisabled();
  });
});
