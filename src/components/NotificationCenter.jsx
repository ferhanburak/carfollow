import { useState } from "react";

function formatNotificationTime(timestamp) {
  if (!timestamp) return "simdi";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "simdi";
  if (minutes < 60) return `${minutes} dk`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} sa`;
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit" }).format(new Date(timestamp));
}

function getNotificationTone(type) {
  const normalizedType = String(type ?? "");
  if (normalizedType === "maintenance-critical" || normalizedType === "moderation") return "bg-rose-400";
  if (normalizedType.includes("invite") || normalizedType.includes("join")) return "bg-amber-300";
  return "bg-lime-400";
}

export function NotificationCenter({
  feedback,
  notifications,
  onMarkAllRead,
  onMarkRead,
  onNavigate,
  unreadCount,
}) {
  const [open, setOpen] = useState(false);

  const openNotification = async (notification) => {
    if (!notification.readAt) await onMarkRead(notification.id);
    onNavigate?.(notification.action);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Bildirim merkezi"
        className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-neutral-200 transition hover:border-lime-400/30 hover:text-lime-300"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-x-3 top-20 z-40 mx-auto max-h-[70vh] max-w-md overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101010]/98 shadow-[0_24px_80px_rgba(0,0,0,0.72)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-lime-400">CRUISER SIGNALS</p>
              <p className="mt-1 text-sm font-black">Bildirim Merkezi</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onMarkAllRead} className="min-h-12 rounded-xl px-3 text-[10px] font-semibold text-neutral-400">
                Tumunu oku
              </button>
              <button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-xl border border-white/10 px-3 text-xs">
                Kapat
              </button>
            </div>
          </div>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto p-3">
            {feedback ? <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{feedback}</p> : null}
            {notifications.length ? notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className={`flex min-h-16 w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left ${
                  notification.readAt ? "border-white/5 bg-black/20 opacity-65" : "border-white/10 bg-white/[0.04]"
                }`}
              >
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${getNotificationTone(notification.type)}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-neutral-100">{notification.title}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-neutral-400">{notification.body}</span>
                </span>
                <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-neutral-600">
                  {formatNotificationTime(notification.createdAt)}
                </span>
              </button>
            )) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-neutral-500">
                Yeni bildirim yok.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
