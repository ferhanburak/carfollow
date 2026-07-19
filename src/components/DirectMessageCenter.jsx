import { useEffect, useRef } from "react";

function formatMessageTime(timestamp) {
  const time = Number(timestamp ?? 0);
  if (!time) return "--";

  const diffMinutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (diffMinutes < 1) return "simdi";
  if (diffMinutes < 60) return `${diffMinutes} dk`;
  if (diffMinutes < 1440) return `${Math.round(diffMinutes / 60)} sa`;

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

function getPresenceTone(status) {
  if (status === "online") return "bg-lime-400";
  if (status === "away") return "bg-amber-400";
  return "bg-neutral-500";
}

function formatPresenceLabel(presence) {
  if (presence?.status === "online") return "online";
  if (presence?.status === "away") return "away";

  const lastSeen = Number(presence?.lastSeen ?? 0);
  if (!lastSeen) return "offline";

  const diffMinutes = Math.max(1, Math.round((Date.now() - lastSeen) / 60000));
  return diffMinutes < 60 ? `${diffMinutes} dk once` : `${Math.round(diffMinutes / 60)} sa once`;
}

function getConversationProfile(conversation) {
  return {
    userId: conversation.participantUserId,
    plate: conversation.participantPlate,
    fullName: conversation.participantName,
    model: conversation.participantModel,
    avatar: conversation.participantAvatar,
  };
}

export function DirectMessageButton({ onClick, unreadCount = 0, tone = "default" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="DM merkezi"
      title="Mesajlar"
      className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-neutral-200 transition hover:border-lime-400/40 hover:text-lime-300 ${
        tone === "map" ? "border-white/10 bg-black/75 backdrop-blur" : "border-white/10 bg-black/30"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.7 9.7 0 0 1-4-.9L3 21l1.5-4.3A8.5 8.5 0 1 1 21 11.5Z" />
        <path d="M8 12h.01M12 12h.01M16 12h.01" strokeLinecap="round" strokeWidth="2.6" />
      </svg>
      {unreadCount ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}

export function DirectMessageCenter({
  activeConversation,
  activeConversationId,
  activeTypingUsers,
  chatFeedback,
  conversationList,
  isOpen,
  messageDraft,
  onClose,
  onMarkConversationRead,
  onMessageDraftChange,
  onSelectConversation,
  onSendMessage,
  onShowInbox,
  presenceMap,
  unreadConversationCount,
  user,
  view,
}) {
  const messagesEndRef = useRef(null);
  const selectedConversation = conversationList.find((conversation) => conversation.id === activeConversationId)
    ?? activeConversation;

  useEffect(() => {
    if (!isOpen || view !== "chat") return;
    messagesEndRef.current?.scrollIntoView?.({ block: "end" });
  }, [isOpen, selectedConversation?.messages?.length, view]);

  useEffect(() => {
    if (!isOpen || view !== "chat" || !selectedConversation?.id || !selectedConversation.unreadCount) return;
    void onMarkConversationRead(selectedConversation.id);
  }, [isOpen, onMarkConversationRead, selectedConversation?.id, selectedConversation?.unreadCount, view]);

  if (!isOpen) return null;

  const submitMessage = (event) => {
    event.preventDefault();
    if (!selectedConversation) return;
    void onSendMessage(getConversationProfile(selectedConversation));
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md md:p-4" role="dialog" aria-modal="true" aria-label="DM merkezi paneli">
      <section className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden border-white/10 bg-[#090909] shadow-[0_24px_90px_rgba(0,0,0,0.85)] md:h-[calc(100dvh-2rem)] md:rounded-[2rem] md:border">
        <header className="app-safe-top shrink-0 border-b border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(163,230,53,0.16),transparent_42%),#111111] px-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {view === "chat" ? (
                <button type="button" onClick={onShowInbox} aria-label="Sohbet listesine don" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-lg">
                  &larr;
                </button>
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/10 text-lime-300">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.7 9.7 0 0 1-4-.9L3 21l1.5-4.3A8.5 8.5 0 1 1 21 11.5Z" />
                  </svg>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.28em] text-lime-400">CRUISER DIRECT</p>
                <h2 className="mt-1 truncate text-lg font-black">
                  {view === "chat" && selectedConversation ? selectedConversation.participantName : "Son Sohbetler"}
                </h2>
                <p className="truncate text-xs text-neutral-500">
                  {view === "chat" && selectedConversation
                    ? `${selectedConversation.participantPlate} / ${formatPresenceLabel(presenceMap?.[selectedConversation.participantPlate])}`
                    : `${conversationList.length} sohbet / ${unreadConversationCount} yeni kisi`}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="DM merkezini kapat" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-xl text-neutral-300">
              &times;
            </button>
          </div>
        </header>

        {view === "list" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            {chatFeedback ? <p className="mb-3 rounded-2xl border border-lime-400/15 bg-lime-400/10 px-4 py-3 text-xs text-lime-100">{chatFeedback}</p> : null}
            <div className="space-y-2">
              {conversationList.length ? conversationList.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => void onSelectConversation(getConversationProfile(conversation))}
                  className="flex min-h-[5.5rem] w-full items-center gap-3 rounded-[1.35rem] border border-white/8 bg-white/[0.035] px-3 py-3 text-left transition hover:border-lime-400/25 hover:bg-lime-400/[0.06]"
                >
                  {conversation.participantAvatar ? (
                    <img src={conversation.participantAvatar} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-lime-400/10 font-mono text-sm text-lime-300">
                      {conversation.participantPlate?.slice(0, 2)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${getPresenceTone(presenceMap?.[conversation.participantPlate]?.status)}`} />
                      <span className="truncate text-sm font-bold text-neutral-100">{conversation.participantName}</span>
                    </span>
                    <span className="mt-1 block truncate font-mono text-[10px] tracking-[0.14em] text-lime-300">{conversation.participantPlate}</span>
                    <span className="mt-1 block truncate text-xs text-neutral-500">{conversation.lastMessage?.body ?? "Henuz mesaj yok"}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-[10px] text-neutral-600">{formatMessageTime(conversation.lastMessage?.createdAt)}</span>
                    {conversation.unreadCount ? (
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white">{conversation.unreadCount}</span>
                    ) : null}
                  </span>
                </button>
              )) : (
                <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.02] px-5 py-12 text-center">
                  <p className="text-sm font-bold text-neutral-300">Henuz sohbet yok</p>
                  <p className="mt-2 text-xs leading-5 text-neutral-500">Social ekranindan bir arkadasinin profilini acip mesaj gonderebilirsin.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {selectedConversation ? (
                <div className="space-y-3">
                  {(selectedConversation.messages ?? []).length ? (selectedConversation.messages ?? []).map((message) => {
                    const isOwnMessage = message.authorPlate === user.plate;
                    return (
                      <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[82%] rounded-[1.25rem] px-4 py-3 text-sm leading-5 ${isOwnMessage ? "rounded-br-md bg-lime-400 text-black" : "rounded-bl-md border border-white/8 bg-[#171717] text-neutral-200"}`}>
                          <p>{message.body}</p>
                          <p className={`mt-2 text-[9px] uppercase tracking-[0.14em] ${isOwnMessage ? "text-black/55" : "text-neutral-600"}`}>{formatMessageTime(message.createdAt)}</p>
                        </div>
                      </div>
                    );
                  }) : <p className="py-10 text-center text-xs text-neutral-500">Ilk mesaji sen gonder.</p>}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-neutral-500">Sohbet bulunamadi.</div>
              )}
            </div>
            {activeTypingUsers.length ? <p className="shrink-0 px-4 pb-2 text-xs text-lime-300">{activeTypingUsers.map((entry) => entry.plate).join(", ")} yaziyor...</p> : null}
            {chatFeedback ? <p className="mx-4 mb-2 shrink-0 rounded-xl bg-lime-400/10 px-3 py-2 text-xs text-lime-100">{chatFeedback}</p> : null}
            <form onSubmit={submitMessage} className="shrink-0 border-t border-white/10 bg-[#111111] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="flex items-end gap-2">
                <textarea
                  value={messageDraft}
                  onChange={(event) => onMessageDraftChange(event.target.value)}
                  aria-label="Mesaj yaz"
                  placeholder="Mesaj yaz..."
                  rows="1"
                  className="min-h-12 max-h-28 flex-1 resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-lime-400"
                />
                <button type="submit" disabled={!selectedConversation || !messageDraft.trim()} className="flex h-12 min-w-16 items-center justify-center rounded-2xl bg-lime-400 px-4 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-40">
                  Gonder
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
