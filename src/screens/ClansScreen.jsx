import { formatNumber } from "../utils/garage";

export function ClansScreen({ clans, drivers, user }) {
  return (
    <section className="space-y-4">
      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Monthly Clan Leaderboard</p>
            <h3 className="mt-2 text-xl font-black">Collective Kilometers</h3>
          </div>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">Live Sync</div>
        </div>
        <div className="mt-4 space-y-3">
          {[...clans]
            .sort((a, b) => b.km - a.km)
            .map((clan, index) => (
              <div key={clan.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black ${
                        index === 0
                          ? "bg-amber-300 text-black"
                          : index === 1
                            ? "bg-neutral-300 text-black"
                            : index === 2
                              ? "bg-orange-500 text-black"
                              : "bg-white/10 text-white"
                      }`}
                    >
                      #{index + 1}
                    </div>
                    <div>
                      <p className="font-semibold">{clan.name}</p>
                      <p className="text-xs text-neutral-500">{clan.members} members</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-lime-300">{formatNumber(clan.km)} KM</p>
                    <p className="text-xs text-neutral-500">
                      {clan.name === user.clan ? "Your clan is syncing live" : "Monthly total"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <p className="text-sm font-semibold">Active Drivers on the Highway</p>
        <div className="mt-4 space-y-3">
          {drivers.map((driver) => (
            <div key={`${driver.plate}-leader`} className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
              <div>
                <p className="font-mono text-sm tracking-[0.16em] text-lime-300">{driver.plate}</p>
                <p className="text-xs text-neutral-500">{driver.vehicle}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{driver.node}</p>
                <p className="text-xs text-rose-300">{driver.speed} KM/H</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
