import { useEffect, useState } from "react";
import { InsightCard } from "../ui";
import { getActionError } from "../../utils/actionFeedback";
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
  if (value === "cancelled") {
    return "Iptal Edildi";
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

function formatLaunchTime(pin) {
  const scheduledStartAtMs = Number(pin?.scheduledStartAtMs ?? 0);
  if (!scheduledStartAtMs) return pin?.time ?? "--";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(scheduledStartAtMs));
}

function matchesDriver(left, right) {
  const leftId = left?.userId ?? left?.firebaseUid ?? left?.id;
  const rightId = right?.userId ?? right?.firebaseUid ?? right?.id;
  if (leftId && rightId) return leftId === rightId;
  return Boolean(left?.plate && right?.plate && left.plate === right.plate);
}

function ConvoyInvitePanel({ attendees, invitedGuests, pendingRequests, onInviteDriver, onSearchChange, pin, searchResults, user }) {
  const [query, setQuery] = useState("");
  const [pendingUserId, setPendingUserId] = useState("");

  useEffect(() => {
    setQuery("");
    onSearchChange?.("");
  }, [onSearchChange, pin.id]);

  const inviteDriver = async (profile) => {
    const profileId = profile.userId ?? profile.firebaseUid ?? profile.id ?? profile.plate;
    if (!onInviteDriver || pendingUserId) return;
    setPendingUserId(profileId);
    try {
      const completed = await onInviteDriver(pin.id, profile);
      if (completed !== false) {
        setQuery("");
        onSearchChange?.("");
      }
    } finally {
      setPendingUserId("");
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/[0.05] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Konvoya Surucu Davet Et</p>
          <p className="mt-1 text-xs text-neutral-500">Arkadaslik gerekmeden tam plakayla surucu ara.</p>
        </div>
        <span className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-rose-200">Host</span>
      </div>
      <input
        aria-label="Konvoya davet edilecek plaka"
        value={query}
        onChange={(event) => {
          const value = event.target.value.toUpperCase();
          setQuery(value);
          onSearchChange?.(value);
        }}
        placeholder="Ornek: 06 PWA 101"
        className="mt-3 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 font-mono text-sm uppercase tracking-[0.12em] outline-none focus:border-rose-400"
      />
      <div className="mt-3 space-y-2">
        {query.trim() && searchResults.length ? searchResults.slice(0, 3).map((profile) => {
          const isSelf = matchesDriver(profile, user);
          const isAttendee = attendees.some((entry) => matchesDriver(entry, profile));
          const isInvited = invitedGuests.some((entry) => matchesDriver(entry, profile));
          const hasPendingRequest = pendingRequests.some((entry) => matchesDriver(entry, profile));
          const isUnavailable = isSelf || isAttendee || isInvited || hasPendingRequest;
          const profileId = profile.userId ?? profile.firebaseUid ?? profile.id ?? profile.plate;
          const buttonLabel = isSelf ? "Bu Sensin" : isAttendee ? "Konvoyda" : isInvited ? "Davet Edildi" : hasPendingRequest ? "Istek Bekliyor" : pendingUserId === profileId ? "Gonderiliyor..." : "Davet Et";
          return (
            <div key={profileId} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 p-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs tracking-[0.14em] text-lime-300">{profile.plate}</p>
                <p className="mt-1 truncate text-sm font-semibold text-white">{profile.fullName ?? "CRUISER Driver"}</p>
                <p className="truncate text-xs text-neutral-500">{profile.model || "Arac bilgisi gizli"}</p>
              </div>
              <button
                type="button"
                disabled={isUnavailable || Boolean(pendingUserId)}
                onClick={() => inviteDriver(profile)}
                className="min-h-12 shrink-0 rounded-xl bg-rose-500 px-3 text-xs font-bold text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {buttonLabel}
              </button>
            </div>
          );
        }) : null}
        {query.trim().length >= 5 && !searchResults.length ? (
          <p className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-xs text-neutral-500">Bu plakaya ait davet edilebilir bir surucu bulunamadi.</p>
        ) : null}
      </div>
    </div>
  );
}

function toDateTimeLocal(value) {
  const date = new Date(Number(value ?? 0));
  if (!Number(value) || Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function createConvoyEditForm(pin) {
  return {
    name: pin.name ?? "",
    route: pin.route ?? "",
    time: pin.time ?? "",
    scheduledStartAt: toDateTimeLocal(pin.scheduledStartAtMs),
    capacity: String(pin.capacity ?? 12),
    visibility: pin.visibility ?? "public",
    accessPolicy: pin.accessPolicy ?? "request",
    detailVisibility: pin.detailVisibility ?? "trusted",
    minDriverScore: String(pin.minDriverScore ?? 0),
    minHarmonyVotes: String(pin.minHarmonyVotes ?? 0),
    maxAlertVotes: String(pin.maxAlertVotes ?? 999),
  };
}

function ConvoyEditPanel({ onUpdate, pin }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState(() => createConvoyEditForm(pin));

  useEffect(() => {
    setForm(createConvoyEditForm(pin));
    setOpen(false);
  }, [pin.id]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!onUpdate || pending) return;
    setPending(true);
    try {
      const completed = await onUpdate({
        name: form.name,
        route: form.route,
        time: form.time,
        scheduledStartAtMs: form.scheduledStartAt ? new Date(form.scheduledStartAt).getTime() : Number(pin.scheduledStartAtMs ?? 0),
        capacity: Number(form.capacity),
        visibility: form.visibility,
        accessPolicy: form.accessPolicy,
        detailVisibility: form.detailVisibility,
        minDriverScore: Number(form.minDriverScore),
        minHarmonyVotes: Number(form.minHarmonyVotes),
        maxAlertVotes: Number(form.maxAlertVotes),
      });
      if (completed !== false) setOpen(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen((current) => !current)} className="min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-200">
        {open ? "Duzenlemeyi Kapat" : "Konvoy Bilgilerini Duzenle"}
      </button>
      {open ? (
        <form onSubmit={submit} className="mt-3 space-y-3 rounded-2xl border border-white/8 bg-black/25 p-3">
          <label className="block text-xs text-neutral-400">Konvoy Adi *
            <input required value={form.name} onChange={(event) => updateField("name", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm text-white outline-none focus:border-lime-400" />
          </label>
          <label className="block text-xs text-neutral-400">Rota Aciklamasi *
            <input required value={form.route} onChange={(event) => updateField("route", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm text-white outline-none focus:border-lime-400" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-neutral-400">Saat *
              <input required value={form.time} onChange={(event) => updateField("time", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm text-white outline-none focus:border-lime-400" />
            </label>
            <label className="block text-xs text-neutral-400">Kapasite *
              <input required type="number" min="2" max="50" value={form.capacity} onChange={(event) => updateField("capacity", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm text-white outline-none focus:border-lime-400" />
            </label>
          </div>
          <label className="block text-xs text-neutral-400">Baslangic Tarihi
            <input type="datetime-local" value={form.scheduledStartAt} onChange={(event) => updateField("scheduledStartAt", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm text-white outline-none focus:border-lime-400" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-neutral-400">Gorunurluk
              <select value={form.visibility} onChange={(event) => updateField("visibility", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-2 text-xs text-white outline-none focus:border-lime-400">
                <option value="public">Herkese Acik</option><option value="friends">Arkadaslar</option><option value="clan">Klan</option>
              </select>
            </label>
            <label className="block text-xs text-neutral-400">Katilim
              <select value={form.accessPolicy} onChange={(event) => updateField("accessPolicy", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-2 text-xs text-white outline-none focus:border-lime-400">
                <option value="open">Acik</option><option value="request">Onayli</option><option value="trusted">Guvenilir</option>
              </select>
            </label>
          </div>
          <label className="block text-xs text-neutral-400">Detay Gorunurlugu
            <select value={form.detailVisibility} onChange={(event) => updateField("detailVisibility", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm text-white outline-none focus:border-lime-400">
              <option value="public">Herkese Acik</option><option value="trusted">Guvenilir Suruculer</option>
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block text-[10px] text-neutral-500">Min Skor<input type="number" min="0" max="100" value={form.minDriverScore} onChange={(event) => updateField("minDriverScore", event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-2 text-xs text-white" /></label>
            <label className="block text-[10px] text-neutral-500">Min Uyum<input type="number" min="0" value={form.minHarmonyVotes} onChange={(event) => updateField("minHarmonyVotes", event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-2 text-xs text-white" /></label>
            <label className="block text-[10px] text-neutral-500">Max Uyari<input type="number" min="0" value={form.maxAlertVotes} onChange={(event) => updateField("maxAlertVotes", event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-2 text-xs text-white" /></label>
          </div>
          <button type="submit" disabled={pending} className="min-h-12 w-full rounded-2xl bg-lime-400 font-bold text-black disabled:cursor-wait disabled:opacity-50">{pending ? "Kaydediliyor..." : "Degisiklikleri Kaydet"}</button>
        </form>
      ) : null}
    </div>
  );
}

export function MeetPinPanel({
  convoyFeedback,
  driverSearchResults = [],
  pin,
  user,
  onApproveCruiseJoinRequest,
  onDeclineCruiseJoinRequest,
  onJoinCruise,
  onInviteDriver,
  onRateAttendee,
  onRemoveConvoyMember,
  onSetAttendeeTripStatus,
  onSetConvoyMemberRole,
  onSetConvoyLifecycleStatus,
  onDriverSearchChange,
  onUpdateConvoyDetails,
}) {
  const attendees = (pin.attendees ?? []).map(normalizeAttendee);
  const pendingRequests = (pin.pendingRequests ?? []).map(normalizeAttendee);
  const invitedGuests = pin.invitedGuests ?? [];
  const joinState = getJoinState(pin, user);
  const isHost = joinState === "host";
  const accessState = getConvoyAccessState(pin, user);
  const isJoinDisabled = joinState === "host" || joinState === "joined" || joinState === "requested" || !accessState.canJoin;
  const selfAttendee = attendees.find((entry) => entry.plate === user.plate) ?? null;
  const isManager = pin.viewerManagementRole === "manager" || selfAttendee?.managementRole === "manager";
  const canManage = isHost || isManager;
  const lifecycleStatus = pin.lifecycleStatus ?? "planning";
  const convoyError = getActionError(convoyFeedback);

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
        <InsightCard label="Launch Time" value={accessState.canViewDetails ? formatLaunchTime(pin) : "Restricted"} />
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

      {convoyError ? (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {convoyError}
        </div>
      ) : null}

      {accessState.canViewDetails && pin.automaticArrivalTracking !== false && ["planning", "rolling", "delayed"].includes(lifecycleStatus) ? (
        <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <p className="font-semibold">Otomatik konvoy takibi</p>
          <p className="mt-1 text-xs text-sky-100/75">
            Baslangic saatinde onayli suruculerin GPS takibi acilir. Her surucu hedefin 50 metre alaninda iki ardisik hassas konum olcumuyle dogrulanir. Son aktif surucu dogrulandiginda konvoy tamamlanir ve oylama acilir.
          </p>
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

      {accessState.canViewDetails && canManage ? (
        <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Convoy Management</p>
            <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-lime-300">
              {getLifecycleLabel(lifecycleStatus)}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(isHost ? ["planning", "delayed", "cancelled"] : ["planning", "delayed"]).map((status) => (
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
          {["planning", "delayed"].includes(lifecycleStatus) ? <ConvoyEditPanel onUpdate={onUpdateConvoyDetails} pin={pin} /> : null}
        </div>
      ) : null}

      {accessState.canViewDetails && canManage && lifecycleStatus === "planning" ? (
        <ConvoyInvitePanel
          attendees={attendees}
          invitedGuests={invitedGuests}
          pendingRequests={pendingRequests}
          onInviteDriver={onInviteDriver}
          onSearchChange={onDriverSearchChange}
          pin={pin}
          searchResults={driverSearchResults}
          user={user}
        />
      ) : null}

      {accessState.canViewDetails && selfAttendee && !isHost ? (
        <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">My Convoy Status</p>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-neutral-300">
              {getTripStatusLabel(selfAttendee.tripStatus)}
            </span>
          </div>
          {selfAttendee.tripStatus !== "cancelled" ? (
            <button
              type="button"
              onClick={() => onSetAttendeeTripStatus(user.plate, "cancelled")}
              className="mt-3 min-h-12 w-full rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
            >
              Konvoydan Ayril
            </button>
          ) : null}
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

          {canManage && pendingRequests.length ? (
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
                      disabled={isSelf || lifecycleStatus !== "completed"}
                      onClick={() => onRateAttendee(attendee.plate, "harmony")}
                      className="min-h-12 rounded-2xl border border-lime-400/30 bg-lime-400/10 px-4 text-sm font-semibold text-lime-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Uyumlu +1
                    </button>
                    <button
                      type="button"
                      disabled={isSelf || lifecycleStatus !== "completed"}
                      onClick={() => onRateAttendee(attendee.plate, "alert")}
                      className="min-h-12 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 text-sm font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Tasinlik +1
                    </button>
                  </div>
                  {attendee.managementRole === "manager" ? <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-amber-300">Yardimci Yonetici</p> : null}
                  {isHost && !isSelf ? (
                    <button
                      type="button"
                      onClick={() => onSetConvoyMemberRole?.(attendee, attendee.managementRole === "manager" ? "member" : "manager")}
                      className="mt-3 min-h-12 w-full rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 text-sm font-semibold text-amber-200"
                    >
                      {attendee.managementRole === "manager" ? "Yonetici / Yetkiyi Kaldir" : "Katilimci / Yonetici Yap"}
                    </button>
                  ) : null}
                  {canManage && !isSelf && !(isManager && attendee.managementRole === "manager") && !["completed", "cancelled"].includes(lifecycleStatus) ? (
                    <button
                      type="button"
                      onClick={() => onRemoveConvoyMember?.(attendee)}
                      className="mt-3 min-h-12 w-full rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 text-sm font-semibold text-rose-200"
                    >
                      Konvoydan Cikar
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
