import { useEffect, useState } from "react";

function getInitials(label) {
  return String(label ?? "CR")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CR";
}

export function ProfileAvatar({ className = "h-14 w-14", label, src }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div aria-label={`${label || "CRUISER"} profil fotografi yok`} className={`flex shrink-0 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/10 font-mono text-sm font-black tracking-[0.12em] text-lime-300 ${className}`}>
        {getInitials(label)}
      </div>
    );
  }

  return <img src={src} alt={label || "Profil fotografi"} onError={() => setFailed(true)} className={`shrink-0 rounded-2xl object-cover ${className}`} />;
}
