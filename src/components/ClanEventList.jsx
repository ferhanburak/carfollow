import { useState } from "react";

const CLOSED_EVENT_STATUSES = new Set(["completed", "cancelled"]);

function getStatusView(status) {
  const views = {
    cancelled: { label: "Iptal", tone: "border-rose-400/20 bg-rose-400/10 text-rose-200" },
    completed: { label: "Tamamlandi", tone: "border-lime-400/20 bg-lime-400/10 text-lime-200" },
    delayed: { label: "Gecikmeli", tone: "border-amber-400/20 bg-amber-400/10 text-amber-200" },
    planning: { label: "Planlandi", tone: "border-white/10 bg-white/5 text-neutral-300" },
    rolling: { label: "Suruyor", tone: "border-lime-400/20 bg-lime-400/10 text-lime-200" },
  };
  return views[status] ?? views.planning;
}

function AttendeeCard({ attendee, eventId, onOpenProfile }) {
  return (
    <button
      type="button"
      onClick={() => onOpenProfile?.({ ...attendee, convoyId: eventId, source: "clan-event" })}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-3 text-left"
    >
      <div className="min-w-0">
        <p className="truncate font-mono text-xs tracking-[0.14em] text-lime-300">{attendee.plate || "PLAKA YOK"}</p>
        <p className="mt-1 truncate text-xs text-neutral-400">{attendee.fullName || "CRUISER Driver"} / {attendee.model || "Arac bilgisi yok"}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-bold text-neutral-200">{attendee.driverScore ?? attendee.score ?? "--"}</p>
        <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-neutral-500">{attendee.tripStatus || "ready"}</p>
      </div>
    </button>
  );
}

function ClanEventCard({ canManage, event, isHost, isPending, onDelete, onOpenProfile }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const status = event.lifecycleStatus ?? "planning";
  const statusView = getStatusView(status);
  const attendees = event.attendees ?? [];
  const isClosed = CLOSED_EVENT_STATUSES.has(status);
  const canDelete = status === "planning" ? canManage : isClosed && (canManage || isHost);
  const deleteLabel = status === "planning" ? "Planlanan Eventi Sil" : "Gecmisten Sil";

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-label={`${event.name} katilimcilarini ${isExpanded ? "gizle" : "goster"}`}
        onClick={() => setIsExpanded((current) => !current)}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{event.name}</p>
            <p className="mt-1 truncate text-xs text-neutral-500">{event.route || "Rota bilgisi bekleniyor"}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] uppercase ${statusView.tone}`}>{statusView.label}</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-neutral-500">
          <span>{event.time || "Saat bekleniyor"}</span>
          <span className="text-neutral-300">{attendees.length} katilimci &rsaquo;</span>
        </div>
      </button>

      {isExpanded ? (
        <div className="mt-3 border-t border-white/8 pt-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Katilan Suruculer</p>
            <span className="text-xs text-neutral-500">{attendees.length}</span>
          </div>
          <div className="space-y-2">
            {attendees.length
              ? attendees.map((attendee) => <AttendeeCard key={attendee.userId ?? attendee.plate} attendee={attendee} eventId={event.id} onOpenProfile={onOpenProfile} />)
              : <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-neutral-500">Bu etkinlik icin gorunur katilimci kaydi yok.</p>}
          </div>

          {canDelete ? (
            <div className="mt-3">
              {confirmingDelete ? (
                <div className="rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-3">
                  <p className="text-xs leading-5 text-rose-100">Bu etkinlik ve katilimci baglantilari kalici olarak silinecek.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" disabled={isPending} onClick={() => setConfirmingDelete(false)} className="min-h-12 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold disabled:opacity-50">Vazgec</button>
                    <button type="button" disabled={isPending} onClick={() => onDelete(event.id)} className="min-h-12 rounded-xl bg-rose-500 text-xs font-bold text-white disabled:opacity-50">{isPending ? "Siliniyor..." : "Silmeyi Onayla"}</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmingDelete(true)} className="min-h-12 w-full rounded-xl border border-rose-400/20 bg-rose-500/10 text-xs font-semibold text-rose-200">{deleteLabel}</button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EventGroup({ canManage, emptyText, events, eventPendingId, onDelete, onOpenProfile, title, userPlate }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">{title}</p>
        <span className="text-xs text-neutral-500">{events.length}</span>
      </div>
      <div className="mt-2 space-y-2">
        {events.length
          ? events.map((event) => <ClanEventCard key={event.id} canManage={canManage} event={event} isHost={event.createdByPlate === userPlate} isPending={eventPendingId === event.id} onDelete={onDelete} onOpenProfile={onOpenProfile} />)
          : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-neutral-500">{emptyText}</div>}
      </div>
    </div>
  );
}

export function ClanEventList({ canManage, eventPendingId, events, onDelete, onOpenProfile, userPlate }) {
  const activeEvents = events.filter((event) => !CLOSED_EVENT_STATUSES.has(event.lifecycleStatus));
  const pastEvents = events.filter((event) => CLOSED_EVENT_STATUSES.has(event.lifecycleStatus));

  return (
    <div className="space-y-4">
      <EventGroup canManage={canManage} emptyText="Aktif veya yaklasan etkinlik yok." events={activeEvents} eventPendingId={eventPendingId} onDelete={onDelete} onOpenProfile={onOpenProfile} title="Aktif ve Yaklasan" userPlate={userPlate} />
      <EventGroup canManage={canManage} emptyText="Klan gecmisinde tamamlanmis etkinlik yok." events={pastEvents} eventPendingId={eventPendingId} onDelete={onDelete} onOpenProfile={onOpenProfile} title="Gecmis" userPlate={userPlate} />
    </div>
  );
}
