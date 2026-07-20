import { formatNumber } from "../utils/garage";
import { ClanEventList } from "./ClanEventList";

function StatTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/25 px-3 py-3 text-center">
      <p className="text-[9px] uppercase tracking-[0.2em] text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-black text-lime-300">{value}</p>
    </div>
  );
}

export function ClanSummaryCard({ clan, eventCount, memberCount, onOpen, userRole }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${clan.name} klan detaylarini ac`}
      className="group w-full rounded-[1.5rem] border border-lime-400/20 bg-[radial-gradient(circle_at_top_right,_rgba(163,230,53,0.16),transparent_46%),#0d1209] p-4 text-left transition hover:border-lime-400/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.28em] text-lime-400">YOUR CLAN</p>
          <h4 className="mt-2 truncate text-lg font-black text-neutral-100">{clan.name}</h4>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-lime-300">{clan.tag || "CRUISER"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-neutral-300">{userRole ?? "member"}</span>
          <span className="text-xl text-lime-300 transition group-hover:translate-x-1">&rsaquo;</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatTile label="Aylik KM" value={formatNumber(clan.km ?? 0)} />
        <StatTile label="Uye" value={memberCount} />
        <StatTile label="Event" value={eventCount} />
      </div>
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-neutral-400">{clan.description || "Klan detaylarini ve yonetim araclarini ac."}</p>
    </button>
  );
}

export function ClanMembershipLoadingCard({ clanName }) {
  return (
    <div className="rounded-[1.5rem] border border-lime-400/15 bg-lime-400/[0.05] p-4">
      <p className="text-[10px] uppercase tracking-[0.28em] text-lime-400">KLAN GUNCELLENIYOR</p>
      <p className="mt-2 text-sm font-bold">{clanName || "Klan uyeligi"}</p>
      <p className="mt-2 text-xs text-neutral-500">Klan profili ve kadro bilgileri yukleniyor.</p>
      <div className="mt-4 h-2 animate-pulse rounded-full bg-lime-400/20" />
    </div>
  );
}

function IncomingInvites({ invites, onAccept, onDecline }) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Gelen Klan Davetleri</p>
        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-200">{invites.length} bekliyor</span>
      </div>
      <div className="mt-3 space-y-3">
        {invites.length ? invites.map((invite) => (
          <div key={invite.id} className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] p-4">
            <p className="font-semibold">{invite.clanName}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-lime-300">{invite.clanTag}</p>
            <p className="mt-2 text-xs text-neutral-500">Davet eden: {invite.fromName} / {invite.fromPlate}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onAccept(invite.id)} className="min-h-12 rounded-xl bg-lime-400 px-3 text-xs font-bold text-black">Kabul Et</button>
              <button type="button" onClick={() => onDecline(invite.id)} className="min-h-12 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold">Reddet</button>
            </div>
          </div>
        )) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-neutral-500">Bekleyen klan daveti yok.</div>
        )}
      </div>
    </div>
  );
}

export function ClanCreatePanel({ clanFeedback, clanForm, invites, isPending, onAcceptInvite, onCreateClan, onDeclineInvite, onFormChange }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
      <p className="text-[10px] uppercase tracking-[0.28em] text-lime-400">START A CREW</p>
      <h4 className="mt-2 text-lg font-black">Klan Kur</h4>
      <p className="mt-1 text-xs leading-5 text-neutral-500">Kendi ekibini kur veya bekleyen bir klan davetini kabul et.</p>
      {clanFeedback ? <p className="mt-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-xs text-lime-100">{clanFeedback}</p> : null}
      <div className="mt-4 space-y-3">
        <label className="block text-[10px] uppercase tracking-[0.2em] text-neutral-500">
          Klan Adi
          <input aria-label="Klan Adi" value={clanForm.name} onChange={(event) => onFormChange((current) => ({ ...current, name: event.target.value }))} className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 text-sm normal-case tracking-normal text-neutral-100 outline-none focus:border-lime-400" />
        </label>
        <label className="block text-[10px] uppercase tracking-[0.2em] text-neutral-500">
          Klan Tag
          <input aria-label="Klan Tag" value={clanForm.tag} maxLength={6} onChange={(event) => onFormChange((current) => ({ ...current, tag: event.target.value.toUpperCase() }))} className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 font-mono text-sm uppercase tracking-[0.16em] text-neutral-100 outline-none focus:border-lime-400" />
        </label>
        <label className="block text-[10px] uppercase tracking-[0.2em] text-neutral-500">
          Klan Aciklamasi
          <textarea aria-label="Klan Aciklamasi" value={clanForm.description} rows={3} onChange={(event) => onFormChange((current) => ({ ...current, description: event.target.value }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 py-3 text-sm normal-case tracking-normal text-neutral-100 outline-none focus:border-lime-400" />
        </label>
        <button type="button" onClick={onCreateClan} disabled={isPending} className="min-h-12 w-full rounded-2xl bg-lime-400 px-4 font-bold text-black disabled:opacity-50">Klani Kur</button>
      </div>
      <IncomingInvites invites={invites} onAccept={onAcceptInvite} onDecline={onDeclineInvite} />
    </div>
  );
}

function ClanMemberCard({ isPending, member, onOpenProfile, onRemove, onTransfer, onUpdateRole, user }) {
  const currentUserId = user.userId ?? user.firebaseUid ?? user.id;
  const isSelf = member.userId === currentUserId;
  const canManage = !isSelf && (user.clanRole === "owner" ? member.role !== "owner" : user.clanRole === "captain" && member.role === "member");

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => onOpenProfile?.(member)} className="min-h-12 min-w-0 flex-1 text-left">
          <p className="font-mono text-xs tracking-[0.14em] text-lime-300">{member.plate}</p>
          <p className="mt-1 truncate text-sm font-semibold">{member.fullName}{isSelf ? " (Sen)" : ""}</p>
          <p className="truncate text-xs text-neutral-500">{member.model || "CRUISER driver"} / {member.region || "Unknown"}</p>
        </button>
        <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-neutral-300">{member.role}</span>
      </div>
      {canManage ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {user.clanRole === "owner" ? <button type="button" disabled={isPending} onClick={() => onUpdateRole(member, member.role === "captain" ? "member" : "captain")} className="min-h-12 rounded-xl border border-lime-400/25 bg-lime-400/10 px-2 text-xs font-semibold text-lime-200 disabled:opacity-50">{member.role === "captain" ? "Uye Yap" : "Kaptan Yap"}</button> : null}
          {user.clanRole === "owner" ? <button type="button" disabled={isPending} onClick={() => onTransfer(member)} className="min-h-12 rounded-xl border border-amber-400/25 bg-amber-400/10 px-2 text-xs font-semibold text-amber-100 disabled:opacity-50">Sahipligi Devret</button> : null}
          <button type="button" disabled={isPending} onClick={() => onRemove(member)} className="col-span-2 min-h-12 rounded-xl border border-rose-400/25 bg-rose-400/10 px-2 text-xs font-semibold text-rose-100 disabled:opacity-50">Klandan Cikar</button>
        </div>
      ) : null}
    </div>
  );
}

export function ClanCenter({
  clan,
  clanEventFeedback,
  clanFeedback,
  eventPendingId,
  events,
  isOpen,
  isPending,
  members,
  onClose,
  onDeleteEvent,
  onLeave,
  onOpenProfile,
  onRemoveMember,
  onRevokeInvite,
  onTransferOwnership,
  onUpdateMemberRole,
  outgoingInvites,
  user,
}) {
  if (!isOpen || !clan) return null;
  const memberCount = members.length || Number(clan.members ?? 0);
  const averageScore = members.length ? Math.round(members.reduce((sum, member) => sum + Number(member.driverScore ?? 0), 0) / members.length) : Number(user.driverScore ?? 0);
  const canInvite = ["owner", "captain"].includes(user.clanRole ?? "member");

  return (
    <div className="fixed inset-0 z-[45] bg-black/85 backdrop-blur-md md:p-4" role="dialog" aria-modal="true" aria-label="Klan merkezi paneli">
      <section className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden border-white/10 bg-[#090909] shadow-[0_24px_90px_rgba(0,0,0,0.9)] md:h-[calc(100dvh-2rem)] md:rounded-[2rem] md:border">
        <header className="app-safe-top shrink-0 border-b border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(163,230,53,0.16),transparent_44%),#111111] px-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.28em] text-lime-400">CLAN COMMAND</p>
              <h2 className="mt-1 truncate text-lg font-black">{clan.name}</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-neutral-500">{clan.tag} / {user.clanRole ?? "member"}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Klan merkezini kapat" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-xl text-neutral-300">&times;</button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {clanFeedback || clanEventFeedback ? <p className="rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-xs text-lime-100">{clanEventFeedback || clanFeedback}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Aylik KM" value={`${formatNumber(clan.km ?? 0)} KM`} />
            <StatTile label="Uye Sayisi" value={memberCount} />
            <StatTile label="Event Sayisi" value={events.length} />
            <StatTile label="Ort. Skor" value={averageScore} />
          </div>

          <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Klan Profili</p>
            <p className="mt-2 text-sm leading-6 text-neutral-300">{clan.description || "Klan aciklamasi bulunmuyor."}</p>
            <p className="mt-3 text-xs text-neutral-500">Kurucu: {clan.ownerName || clan.ownerPlate || "--"} / Gorunurluk: {clan.visibility || "public"}</p>
          </div>

          <div className="rounded-[1.5rem] border border-white/8 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Klan Kadrosu</p>
                <p className="mt-1 text-xs text-neutral-500">Yetkiler rolune gore sunucu tarafinda dogrulanir.</p>
              </div>
              <span className="text-xs text-neutral-500">{memberCount} uye</span>
            </div>
            <div className="mt-4 space-y-3">
              {members.length ? members.map((member) => <ClanMemberCard key={member.id ?? member.userId} isPending={isPending} member={member} onOpenProfile={onOpenProfile} onRemove={onRemoveMember} onTransfer={onTransferOwnership} onUpdateRole={onUpdateMemberRole} user={user} />) : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-neutral-500">Uye listesi yukleniyor.</div>}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/8 bg-black/20 p-4">
            <p className="text-sm font-semibold">Klan Eventleri</p>
            <div className="mt-3"><ClanEventList canManage={canInvite} eventPendingId={eventPendingId} events={events} onDelete={onDeleteEvent} onOpenProfile={onOpenProfile} userPlate={user.plate} /></div>
          </div>

          {canInvite ? (
            <div className="rounded-[1.5rem] border border-white/8 bg-black/20 p-4">
              <p className="text-sm font-semibold">Giden Davetler</p>
              <p className="mt-1 text-xs text-neutral-500">Yeni davetleri arkadas kartlarindaki “Klana Davet Et” islemiyle gonderebilirsin.</p>
              <div className="mt-3 space-y-2">
                {outgoingInvites.length ? outgoingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs tracking-[0.14em] text-lime-300">{invite.targetPlate}</p>
                      <p className="mt-1 truncate text-sm font-semibold">{invite.targetName}</p>
                    </div>
                    <button type="button" disabled={isPending} onClick={() => onRevokeInvite(invite.id)} className="min-h-12 shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold disabled:opacity-50">Iptal Et</button>
                  </div>
                )) : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-neutral-500">Bekleyen giden davet yok.</div>}
              </div>
            </div>
          ) : null}

          <div className="rounded-[1.5rem] border border-rose-400/20 bg-rose-500/[0.05] p-4">
            <p className="text-sm font-semibold text-rose-100">Klan Uyeligini Sonlandir</p>
            <p className="mt-2 text-xs leading-5 text-neutral-500">Klan sahibiysen ve baska uyeler varsa ayrilmadan once sahipligi devretmelisin.</p>
            <button type="button" disabled={isPending} onClick={onLeave} className="mt-3 min-h-12 w-full rounded-2xl border border-rose-400/30 bg-rose-500/10 font-bold text-rose-200 disabled:opacity-50">Klandan Ayril</button>
          </div>
        </div>
      </section>
    </div>
  );
}
