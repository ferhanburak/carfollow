const ACHIEVEMENT_CATALOG = [
  {
    key: "night-warrior",
    title: "Gece Savascisi",
    description: "Aylik 500 KM gece surus ritmini yakala.",
    progress: (user) => ({ current: Number(user.monthlyNightKm ?? 0), target: 500, unit: "KM" }),
  },
  {
    key: "asphalt-weeper",
    title: "Asfalt Aglatan",
    description: "Toplam odometrede 70.000 KM seviyesine ulas.",
    progress: (user) => ({ current: Number(user.odometer ?? 0), target: 70000, unit: "KM" }),
  },
  {
    key: "crew-favorite",
    title: "Uyum Ustasi",
    description: "Konvoy uyum oylamasinda 20 pozitif oy topla.",
    progress: (user) => ({ current: Number(user.harmonyVotes ?? 0), target: 20, unit: "vote" }),
  },
  {
    key: "garage-keeper",
    title: "Garaj Arsivi",
    description: "En az 5 servis kaydiyla duzenli bakim pasaportu olustur.",
    progress: (user) => ({ current: Number(user.serviceLogs?.length ?? 0), target: 5, unit: "log" }),
  },
  {
    key: "apex-score",
    title: "Crew Apex",
    description: "Surucu skorunu 95 seviyesine cikar.",
    progress: (user) => ({ current: Number(user.driverScore ?? 0), target: 95, unit: "score" }),
  },
];

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildAchievementProgress(user) {
  const serverProgress = user?.achievementProgress ?? user?.driverStats?.achievements;
  if (Array.isArray(serverProgress) && serverProgress.length > 0) {
    return serverProgress.map((achievement) => ({
      ...achievement,
      current: Number(achievement.current ?? 0),
      target: Number(achievement.target ?? 0),
      percent: clampPercent(achievement.percent ?? 0),
      unlocked: Boolean(achievement.unlocked),
    }));
  }

  return ACHIEVEMENT_CATALOG.map((achievement) => {
    const progress = achievement.progress(user);
    const percent = progress.target ? clampPercent((progress.current / progress.target) * 100) : 0;
    const unlocked = percent >= 100 || (user.badges ?? []).includes(achievement.title);

    return {
      ...achievement,
      current: progress.current,
      target: progress.target,
      unit: progress.unit,
      percent: unlocked ? 100 : percent,
      unlocked,
    };
  });
}

export function buildPersonalStats(user) {
  const fuelLogs = user.fuelLogs ?? [];
  const serviceLogs = user.serviceLogs ?? [];
  const positiveRatio = Number(user.harmonyVotes ?? 0) + Number(user.alertVotes ?? 0)
    ? Math.round((Number(user.harmonyVotes ?? 0) / (Number(user.harmonyVotes ?? 0) + Number(user.alertVotes ?? 0))) * 100)
    : 100;

  return [
    { key: "monthly-km", label: "Bireysel Aylik KM", value: `${Math.round(Number(user.monthlyKm ?? 0)).toLocaleString("tr-TR")} KM` },
    { key: "night-km", label: "Aylik Gece KM", value: `${Math.round(Number(user.monthlyNightKm ?? 0)).toLocaleString("tr-TR")} KM` },
    { key: "verified-km", label: "Onayli Toplam", value: `${Math.round(Number(user.lifetimeVerifiedKm ?? 0)).toLocaleString("tr-TR")} KM` },
    { key: "drive-sessions", label: "Onayli Surus", value: `${Number(user.completedDriveSessions ?? 0)}` },
    { key: "driver-score", label: "Surucu Skoru", value: `${Number(user.driverScore ?? 0)}/100` },
    { key: "service-logs", label: "Servis Kaydi", value: `${serviceLogs.length}` },
    { key: "fuel-logs", label: "Yakit Fisi", value: `${fuelLogs.length}` },
    { key: "harmony", label: "Uyum Orani", value: `%${positiveRatio}` },
    { key: "garage", label: "Aktif Garaj", value: user.garage ?? "--" },
  ];
}

export function buildIndividualLeaderboard(user, seededDrivers = []) {
  const mergedDrivers = [
    ...seededDrivers.filter((entry) => entry.plate !== user.plate),
    {
      plate: user.plate,
      fullName: user.fullName,
      model: user.model,
      region: user.region,
      clan: user.clan,
      monthlyKm: Number(user.monthlyKm ?? 0),
      driverScore: Number(user.driverScore ?? 0),
      harmonyVotes: Number(user.harmonyVotes ?? 0),
      alertVotes: Number(user.alertVotes ?? 0),
    },
  ];

  return mergedDrivers
    .sort((left, right) => {
      if (right.monthlyKm !== left.monthlyKm) {
        return right.monthlyKm - left.monthlyKm;
      }

      return right.driverScore - left.driverScore;
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}
