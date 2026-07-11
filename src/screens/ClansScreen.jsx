import { individualDriverSeed } from "../data/mockData";
import { formatNumber } from "../utils/garage";
import { buildAchievementProgress, buildIndividualLeaderboard, buildPersonalStats } from "../utils/socialStats";

export function ClansScreen({ clans, drivers, user }) {
  const personalStats = buildPersonalStats(user);
  const achievementProgress = buildAchievementProgress(user);
  const individualLeaderboard = buildIndividualLeaderboard(user, individualDriverSeed);

  return (
    <section className="space-y-4">
      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Individual Leaderboard</p>
            <h3 className="mt-2 text-xl font-black">Monthly Driver Kilometers</h3>
          </div>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">Solo Rank</div>
        </div>
        <div className="mt-4 space-y-3">
          {individualLeaderboard.map((driver) => (
            <div
              key={`${driver.plate}-individual`}
              className={`rounded-2xl border p-4 ${
                driver.plate === user.plate ? "border-lime-400/30 bg-lime-400/10" : "border-white/8 bg-black/20"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black ${
                      driver.rank === 1
                        ? "bg-amber-300 text-black"
                        : driver.rank === 2
                          ? "bg-neutral-300 text-black"
                          : driver.rank === 3
                            ? "bg-orange-500 text-black"
                            : "bg-white/10 text-white"
                    }`}
                  >
                    #{driver.rank}
                  </div>
                  <div>
                    <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{driver.plate}</p>
                    <p className="text-sm font-semibold">{driver.fullName}</p>
                    <p className="text-xs text-neutral-500">{driver.model} • {driver.region}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-lime-300">{formatNumber(driver.monthlyKm)} KM</p>
                  <p className="text-xs text-neutral-500">Score {driver.driverScore} • {driver.clan}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Driver Stats</p>
            <h3 className="mt-2 text-xl font-black">Personal Progress Board</h3>
          </div>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">Live Profile</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {personalStats.map((stat) => (
            <div key={stat.key} className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">{stat.label}</p>
              <p className="mt-2 text-sm font-bold text-lime-300">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Achievements</p>
            <h3 className="mt-2 text-xl font-black">Titles and Unlock Progress</h3>
          </div>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">
            {(user.badges ?? []).length} active titles
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {achievementProgress.map((achievement) => (
            <div key={achievement.key} className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{achievement.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">{achievement.description}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.22em] ${
                    achievement.unlocked
                      ? "border border-lime-400/20 bg-lime-400/10 text-lime-300"
                      : "border border-white/10 bg-white/5 text-neutral-400"
                  }`}
                >
                  {achievement.unlocked ? "Unlocked" : `%${achievement.percent}`}
                </span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    achievement.unlocked ? "bg-lime-400" : achievement.percent >= 70 ? "bg-amber-400" : "bg-white/30"
                  }`}
                  style={{ width: `${achievement.percent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                {formatNumber(achievement.current)} / {formatNumber(achievement.target)} {achievement.unit}
              </p>
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
