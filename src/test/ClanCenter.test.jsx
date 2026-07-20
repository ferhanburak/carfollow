import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClanCenter, ClanCreatePanel, ClanSummaryCard } from "../components/ClanCenter";

describe("ClanCenter", () => {
  it("shows clan creation and incoming invitations for a clanless driver", async () => {
    const user = userEvent.setup();
    const onCreateClan = vi.fn();
    const onAcceptInvite = vi.fn();

    render(
      <ClanCreatePanel
        clanFeedback=""
        clanForm={{ name: "", tag: "", description: "" }}
        invites={[{ id: "invite-1", clanName: "Night Crew", clanTag: "NGHT", fromName: "Ece", fromPlate: "35 SRT 908" }]}
        isPending={false}
        onAcceptInvite={onAcceptInvite}
        onCreateClan={onCreateClan}
        onDeclineInvite={vi.fn()}
        onFormChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Klani Kur" })).toBeInTheDocument();
    expect(screen.getByText("Night Crew")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Kabul Et" }));
    expect(onAcceptInvite).toHaveBeenCalledWith("invite-1");
  });

  it("opens clan details from the compact membership card", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(
      <ClanSummaryCard
        clan={{ name: "Neon Wolves", tag: "WOLF", km: 14280, description: "Ankara crew" }}
        eventCount={3}
        memberCount={31}
        onOpen={onOpen}
        userRole="owner"
      />,
    );

    expect(screen.getByText("14.280")).toBeInTheDocument();
    expect(screen.getByText("31")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Neon Wolves klan detaylarini ac" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("exposes member management only to authorized clan roles", async () => {
    const user = userEvent.setup();
    const onUpdateMemberRole = vi.fn();
    const targetMember = { id: "member-2", userId: "member-2", plate: "06 TEST 02", fullName: "Test Driver", model: "Golf GTI", region: "Ankara", role: "member", driverScore: 82 };

    const { rerender } = render(
      <ClanCenter
        clan={{ id: "clan-1", name: "Neon Wolves", tag: "WOLF", members: 2, km: 500 }}
        clanFeedback=""
        events={[]}
        isOpen
        isPending={false}
        members={[{ ...targetMember, id: "owner", userId: "owner", role: "owner" }, targetMember]}
        onClose={vi.fn()}
        onLeave={vi.fn()}
        onOpenProfile={vi.fn()}
        onRemoveMember={vi.fn()}
        onRevokeInvite={vi.fn()}
        onTransferOwnership={vi.fn()}
        onUpdateMemberRole={onUpdateMemberRole}
        outgoingInvites={[]}
        user={{ id: "owner", clanRole: "owner", driverScore: 90 }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Kaptan Yap" }));
    expect(onUpdateMemberRole).toHaveBeenCalledWith(targetMember, "captain");

    rerender(
      <ClanCenter
        clan={{ id: "clan-1", name: "Neon Wolves", tag: "WOLF", members: 2, km: 500 }}
        clanFeedback=""
        events={[]}
        isOpen
        isPending={false}
        members={[targetMember]}
        onClose={vi.fn()}
        onLeave={vi.fn()}
        onOpenProfile={vi.fn()}
        onRemoveMember={vi.fn()}
        onRevokeInvite={vi.fn()}
        onTransferOwnership={vi.fn()}
        onUpdateMemberRole={onUpdateMemberRole}
        outgoingInvites={[]}
        user={{ id: "member-3", clanRole: "member", driverScore: 70 }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Kaptan Yap" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Klandan Cikar" })).not.toBeInTheDocument();
  });

  it("reveals past event attendees and requires confirmation before deletion", async () => {
    const user = userEvent.setup();
    const onDeleteEvent = vi.fn();
    const onOpenProfile = vi.fn();
    const event = {
      id: "event-1",
      name: "Ankara Night Run",
      route: "Golbasi - Incek",
      time: "22:30",
      lifecycleStatus: "completed",
      attendees: [{ userId: "driver-1", plate: "06 TEST 01", fullName: "Test Driver", model: "Golf GTI", driverScore: 88, tripStatus: "arrived" }],
    };

    render(
      <ClanCenter
        clan={{ id: "clan-1", name: "Neon Wolves", tag: "WOLF", members: 1, km: 500 }}
        clanEventFeedback=""
        clanFeedback=""
        eventPendingId=""
        events={[event]}
        isOpen
        isPending={false}
        members={[]}
        onClose={vi.fn()}
        onDeleteEvent={onDeleteEvent}
        onLeave={vi.fn()}
        onOpenProfile={onOpenProfile}
        onRemoveMember={vi.fn()}
        onRevokeInvite={vi.fn()}
        onTransferOwnership={vi.fn()}
        onUpdateMemberRole={vi.fn()}
        outgoingInvites={[]}
        user={{ id: "owner", plate: "06 OWNER 01", clanRole: "owner", driverScore: 90 }}
      />,
    );

    expect(screen.getByText("Gecmis")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ankara Night Run katilimcilarini goster" }));
    expect(screen.getByText("06 TEST 01")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /06 TEST 01/i }));
    expect(onOpenProfile).toHaveBeenCalledWith(expect.objectContaining({ userId: "driver-1", convoyId: "event-1" }));

    await user.click(screen.getByRole("button", { name: "Gecmisten Sil" }));
    expect(onDeleteEvent).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Silmeyi Onayla" }));
    expect(onDeleteEvent).toHaveBeenCalledWith("event-1");
  });

  it("lets clan management delete a planned event", async () => {
    const user = userEvent.setup();
    const onDeleteEvent = vi.fn();
    const event = {
      id: "planned-1",
      name: "Test Cruise",
      route: "Ankara - Mogan",
      time: "22:00",
      lifecycleStatus: "planning",
      attendees: [],
    };

    render(
      <ClanCenter
        clan={{ id: "clan-1", name: "Neon Wolves", tag: "WOLF", members: 1, km: 500 }}
        clanEventFeedback=""
        clanFeedback=""
        eventPendingId=""
        events={[event]}
        isOpen
        isPending={false}
        members={[]}
        onClose={vi.fn()}
        onDeleteEvent={onDeleteEvent}
        onLeave={vi.fn()}
        onOpenProfile={vi.fn()}
        onRemoveMember={vi.fn()}
        onRevokeInvite={vi.fn()}
        onTransferOwnership={vi.fn()}
        onUpdateMemberRole={vi.fn()}
        outgoingInvites={[]}
        user={{ id: "owner", plate: "06 OWNER 01", clanRole: "owner", driverScore: 90 }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Test Cruise katilimcilarini goster" }));
    await user.click(screen.getByRole("button", { name: "Planlanan Eventi Sil" }));
    await user.click(screen.getByRole("button", { name: "Silmeyi Onayla" }));
    expect(onDeleteEvent).toHaveBeenCalledWith("planned-1");
  });
});
