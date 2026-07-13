import { InsightCard } from "../ui";
import { getConvoyAccessState, getMeetAccessPolicyLabel, getMeetDetailVisibilityLabel, getMeetVisibilityLabel } from "../../utils/meetVisibility";

function ReputationBadge({ attendee }) {
  const styles =
    attendee.status === "Watchlist"
      ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
      : attendee.status === "Uyumlu"
        ? "border-lime-400/30 bg-lime-400/10 text-lime-200"
        : attendee.status === "Pending Review"
          ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
          : "border-white/10 bg-white/5 text-neutral-300";

  return <span className={`rounded-full border px-3 py-1 text-[11px] ${styles}`}>{attendee.status}</span>;
}

function normalizeAttendee(attendee) {
  if (typeof attendee === "string") {
    return {
      plate: attendee,
      fullName: attendee,
      model: "Unknown Setup",
      region: "Unknown Region",
      score: 70,
      harmonyVotes: 0,
      alertVotes: 0,
      status: "Convoy Ready",
    };
  }

  return attendee;
}

function getJoinState(pin, user) {
  const attendees = (pin.attendees ?? []).map(normalizeAttendee);
  const requests = (pin.pendingRequests ?? []).map(normalizeAttendee);
  const invitedGuests = pin.invitedGuests ?? [];

  if (pin.createdByPlate === user.plate) {
    return "host";
  }
  if (attendees.some((entry) => entry.plate === user.plate)) {
    return "joined";
  }
  if (requests.some((entry) => entry.plate === user.plate)) {
    return "requested";
  }
  if (invitedGuests.some((entry) => entry.plate === user.plate)) {
    return "invited";
  }

  return "available";
}

function getJoinButtonLabel(joinState, visibility) {
  if (joinState === "host") {
    return "Host Panel";
  }
  if (joinState === "joined") {
    return "Konvoyda";
  }
  if (joinState === "requested") {
    return "Istek Gonderildi";
  }
  if (joinState === "invited") {
    return "Daveti Kabul Et";
  }
  if (visibility === "public") {
    return "Join Cruise";
  }

  return "Katilim Istegi Gonder";
}

function getLifecycleLabel(value) {
  if (value === "rolling") {
    return "Basladi";
  }
  if (value === "delayed") {
    return "Gecikiyor";
  }
  if (value === "completed") {
    return "Tamamlandi";
  }

  return "Hazirlaniyor";
}

function getTripStatusLabel(value) {
  if (value === "enroute") {
    return "Yolda";
  }
  if (value === "arrived") {
    return "Vardi";
  }
  if (value === "cancelled") {
    return "Iptal";
  }

  return "Hazir";
}

export function MeetPinPanel({
  convoyFeedback,
  pin,
  user,
  onApproveCruiseJoinRequest,
  onDeclineCruiseJoinRequest,
  onJoinCruise,
  onRateAttendee,
  onSetAttendeeTripStatus,
  onSetConvoyLifecycleStatus,
}) {
  const attendees = (pin.attendees ?? []).map(normalizeAttendee);
  const pendingRequests = (pin.pendingRequests ?? []).map(normalizeAttendee);
  const invitedGuests = pin.invitedGuests ?? [];
  const joinState = getJoinState(pin, user);
  const isHost = joinState === "host";
  const accessState = getConvoyAccessState(pin, user);
  const isJoinDisabled = joinState === "host" || joinState === "joined" || joinState === "requested" || !accessState.canJoin;
  const selfAttendee = attendees.find((entry) => entry.plate === user.plate) ?? null;
  const lifecycleStatus = pin.lifecycleStatus ?? "planning";

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Group Meets & Cruises</p>
          <h3 className="mt-2 text-xl font-black">{pin.name}</h3>
        </div>
        <InsightCard label="Convoy Size" value={`${attendees.length}/${pin.capacity ?? attendees.length}`} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <InsightCard label="Launch Time" value={accessState.canViewDetails ? pin.time : "Restricted"} />
        <InsightCard label="Route" value={accessState.canViewDetails ? pin.route : "Trusted drivers only"} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <InsightCard label="Convoy Status" value={getLifecycleLabel(lifecycleStatus)} />
        <InsightCard label="My Status" value={selfAttendee ? getTripStatusLabel(selfAttendee.tripStatus) : "Disarda"} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-lime-300">
          {getMeetVisibilityLabel(pin.visibility)}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-neutral-300">
          Capacity {pin.capacity ?? attendees.length}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-neutral-300">
          {getMeetAccessPolicyLabel(pin.accessPolicy ?? "open")}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-neutral-300">
          {getMeetDetailVisibilityLabel(pin.detailVisibility ?? "public")}
        </span>
        {pin.createdByPlate ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-neutral-300">
            Host {pin.createdByPlate}
          </span>
        ) : null}
      </div>

      {convoyFeedback ? (
        <div className="mt-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-sm text-lime-100">
          {convoyFeedback}
        </div>
      ) : null}

      {!accessState.canViewDetails ? (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
          <p className="font-semibold">Restricted Convoy</p>
          <p className="mt-2">{accessState.reason}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-rose-100/90">
            <InsightCard label="Min Score" value={`${pin.minDriverScore ?? 0}`} />
            <InsightCard label="Min Uyum" value={`${pin.minHarmonyVotes ?? 0}`} />
            <InsightCard label="Max Alert" value={`${pin.maxAlertVotes ?? 999}`} />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        disabled={isJoinDisabled}
        onClick={onJoinCruise}
        className="mt-4 min-h-12 w-full rounded-2xl bg-lime-400 font-bold text-black shadow-[0_0_20px_rgba(163,230,53,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {getJoinButtonLabel(joinState, pin.visibility)}
      </button>

      {accessState.canViewDetails && isHost ? (
        <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Host Convoy Control</p>
            <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-lime-300">
              {getLifecycleLabel(lifecycleStatus)}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {["planning", "rolling", "delayed", "completed"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onSetConvoyLifecycleStatus(status)}
                className={`min-h-12 rounded-2xl px-3 text-xs font-semibold transition ${
                  lifecycleStatus === status ? "bg-lime-400 text-black" : "border border-white/10 bg-white/5 text-neutral-300"
                }`}
              >
                {getLifecycleLabel(status)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {accessState.canViewDetails && selfAttendee && !isHost ? (
        <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">My Convoy Status</p>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-neutral-300">
              {getTripStatusLabel(selfAttendee.tripStatus)}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {["ready", "enroute", "arrived", "cancelled"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onSetAttendeeTripStatus(user.plate, status)}
                className={`min-h-12 rounded-2xl px-3 text-xs font-semibold transition ${
                  selfAttendee.tripStatus === status ? "bg-lime-400 text-black" : "border border-white/10 bg-white/5 text-neutral-300"
                }`}
              >
                {getTripStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!accessState.canViewDetails ? null : (
        <>
          {invitedGuests.length ? (
            <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Invited Drivers</p>
                <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-neutral-300">
                  {invitedGuests.length} invited
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {invitedGuests.map((guest) => (
                  <div key={guest.plate} className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
                    <p className="font-mono text-xs tracking-[0.14em] text-lime-300">{guest.plate}</p>
                    <p className="mt-1 text-sm font-semibold">{guest.fullName}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isHost && pendingRequests.length ? (
            <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Pending RSVP Requests</p>
                <span className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-amber-200">
                  {pendingRequests.length} waiting
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {pendingRequests.map((attendee) => (
                  <div key={attendee.plate} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{attendee.plate}</p>
                        <p className="mt-1 text-sm font-semibold">{attendee.fullName}</p>
                        <p className="text-xs text-neutral-500">{attendee.model} / {attendee.region}</p>
                      </div>
                      <ReputationBadge attendee={attendee} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onApproveCruiseJoinRequest(attendee.plate)}
                        className="min-h-12 rounded-2xl bg-lime-400 px-4 text-sm font-bold text-black"
                      >
                        Kabul Et
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeclineCruiseJoinRequest(attendee.plate)}
                        className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-200"
                      >
                        Reddet
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {attendees.map((attendee) => {
              const isSelf = attendee.plate === user.plate;

              return (
                <div key={attendee.plate} className="rounded-2xl bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{attendee.plate}</p>
                      <p className="mt-1 text-sm font-semibold">{attendee.fullName}</p>
                      <p className="text-xs text-neutral-500">
                        {attendee.model} / {attendee.region}
                      </p>
                    </div>
                    <ReputationBadge attendee={attendee} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <InsightCard label="Score" value={`${attendee.score}`} />
                    <InsightCard label="Uyum" value={`${attendee.harmonyVotes}`} />
                    <InsightCard label="Alert" value={`${attendee.alertVotes}`} />
                  </div>
                  <div className="mt-2">
                    <InsightCard label="Trip Status" value={getTripStatusLabel(attendee.tripStatus)} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isSelf}
                      onClick={() => onRateAttendee(attendee.plate, "harmony")}
                      className="min-h-12 rounded-2xl border border-lime-400/30 bg-lime-400/10 px-4 text-sm font-semibold text-lime-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Uyumlu +1
                    </button>
                    <button
                      type="button"
                      disabled={isSelf}
                      onClick={() => onRateAttendee(attendee.plate, "alert")}
                      className="min-h-12 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 text-sm font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Tasinlik +1
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
