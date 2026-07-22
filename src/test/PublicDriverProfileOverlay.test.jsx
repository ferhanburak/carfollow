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
      hostableConvoy={{ id: "convoy-1", name: "Night Route" }}
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

    expect(onInviteFriendToClan).toHaveBeenCalledWith(stranger);
    expect(onInviteToConvoy).toHaveBeenCalledWith("convoy-1", stranger);
  });

  it("does not allow community invitations to a blocked driver", () => {
    renderProfile({
      user: { ...currentUser, blockedDrivers: [{ userId: stranger.userId, plate: stranger.plate }] },
    });

    expect(screen.getByRole("button", { name: "Klana Davet" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Konvoya Davet" })).toBeDisabled();
  });
});
