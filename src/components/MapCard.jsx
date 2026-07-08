export function MapCard({ pins, selectedPinId, onSelect }) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,#171717,#0d0d0d)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Interactive Map Layer</p>
          <h3 className="mt-1 text-lg font-black">Driving Grid & Route Curves</h3>
        </div>
        <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">Ankara Grid</div>
      </div>

      <div className="relative h-72 overflow-hidden rounded-[1.5rem] border border-white/8 bg-[radial-gradient(circle_at_center,_rgba(163,230,53,0.12),_transparent_32%),linear-gradient(180deg,#0f0f0f,#090909)]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <svg viewBox="0 0 400 280" className="absolute inset-0 h-full w-full">
          <path d="M20 215 C120 150, 145 90, 238 98 S330 130, 390 45" fill="none" stroke="#a3e635" strokeWidth="3" strokeDasharray="10 9" opacity="0.85" />
          <path d="M24 58 C90 70, 130 165, 235 172 S312 180, 382 240" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="8 8" opacity="0.7" />
          <path d="M50 255 C180 260, 170 50, 340 85" fill="none" stroke="#fafafa" strokeWidth="1.5" opacity="0.2" />
        </svg>
        {pins.map((pin) => (
          <button
            key={pin.id}
            type="button"
            onClick={() => onSelect(pin.id)}
            aria-label={`${pin.name} (${pin.type})`}
            className={`absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border text-lg transition ${
              selectedPinId === pin.id
                ? "border-lime-400 bg-lime-400/20 shadow-[0_0_22px_rgba(163,230,53,0.4)]"
                : "border-white/10 bg-black/50"
            }`}
            style={{ left: pin.x, top: pin.y }}
          >
            {pin.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
