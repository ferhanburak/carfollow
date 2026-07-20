const TONE_STYLES = {
  error: {
    accent: "bg-rose-400",
    border: "border-rose-400/35",
    icon: "!",
    iconStyle: "bg-rose-400 text-black shadow-[0_0_18px_rgba(244,63,94,0.4)]",
    label: "ISLEM TAMAMLANAMADI",
  },
  info: {
    accent: "bg-sky-400",
    border: "border-sky-400/25",
    icon: "i",
    iconStyle: "bg-sky-400 text-black shadow-[0_0_18px_rgba(56,189,248,0.35)]",
    label: "BILGI",
  },
  pending: {
    accent: "bg-lime-400",
    border: "border-lime-400/30",
    icon: "",
    iconStyle: "border-2 border-lime-300/30 border-t-lime-300",
    label: "ISLEM GONDERILDI",
  },
  success: {
    accent: "bg-lime-400",
    border: "border-lime-400/35",
    icon: "✓",
    iconStyle: "bg-lime-400 text-black shadow-[0_0_18px_rgba(163,230,53,0.4)]",
    label: "ISLEM TAMAMLANDI",
  },
};

export function inferActionToastTone(message) {
  const value = String(message ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
  if (/isleniyor|dogrulaniyor|gonderiliyor|hazirlaniyor|kaydediliyor|yukleniyor|siliniyor|alin(?:iyor|makta)|checking|loading/.test(value)) {
    return "pending";
  }
  if (/hata|olamadi|bulunamadi|gecersiz|gonderilemedi|kaydedilemedi|guncellenemedi|yuklenemedi|silinemedi|tamamlanamadi|denied|failed|could not|izin verilm|eksik|missing/.test(value)) {
    return "error";
  }
  if (/gonderildi|eklendi|kaydedildi|guncellendi|olusturuldu|tamamlandi|onaylandi|silindi|kaldirildi|hazir\.?$/.test(value)) {
    return "success";
  }
  return "info";
}

export function ActionToast({ onDismiss, toast }) {
  if (!toast?.message) return null;

  const tone = TONE_STYLES[toast.tone] ?? TONE_STYLES.info;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[100] flex justify-center px-3">
      <div
        key={toast.id}
        role="status"
        aria-live={toast.tone === "error" ? "assertive" : "polite"}
        className={`action-toast-enter pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-[1.35rem] border ${tone.border} bg-[#111111]/95 p-3.5 shadow-[0_20px_70px_rgba(0,0,0,0.65)] backdrop-blur-xl`}
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-black ${
              toast.tone === "pending" ? `animate-spin ${tone.iconStyle}` : tone.iconStyle
            }`}
          >
            {tone.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-neutral-500">{tone.label}</p>
            <p className="mt-1 text-sm font-semibold leading-5 text-neutral-100">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Bildirimi kapat"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg text-neutral-400"
          >
            &times;
          </button>
        </div>
        {toast.tone !== "pending" ? <div className={`action-toast-timer absolute inset-x-0 bottom-0 h-0.5 ${tone.accent}`} /> : null}
      </div>
    </div>
  );
}
