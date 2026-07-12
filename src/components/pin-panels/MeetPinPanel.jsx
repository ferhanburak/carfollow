import { InsightCard } from "../ui";
import { getMeetVisibilityLabel } from "../../utils/meetVisibility";

function ReputationBadge({ attendee }) {
  const styles =
    attendee.status === "Watchlist"
      ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
      : attendee.status === "Uyumlu"
        ? "border-lime-400/30 bg-lime-400/10 text-lime-200"
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

export function MeetPinPanel({ pin, user, onJoinCruise, onRateAttendee }) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Group Meets & Cruises</p>
          <h3 className="mt-2 text-xl font-black">{pin.name}</h3>
        </div>
        <InsightCard label="Convoy Size" value={`${pin.attendees.length}`} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <InsightCard label="Launch Time" value={pin.time} />
        <InsightCard label="Route" value={pin.route} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-lime-300">
          {getMeetVisibilityLabel(pin.visibility)}
        </span>
        {pin.createdByPlate ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-neutral-300">
            Host {pin.createdByPlate}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onJoinCruise}
        className="mt-4 min-h-12 w-full rounded-2xl bg-lime-400 font-bold text-black shadow-[0_0_20px_rgba(163,230,53,0.35)]"
      >
        Join Cruise
      </button>
      <div className="mt-4 space-y-3">
        {pin.attendees.map((rawAttendee) => {
          const attendee = normalizeAttendee(rawAttendee);
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
    </div>
  );
}
