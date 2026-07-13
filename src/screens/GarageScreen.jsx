import { useState } from "react";
import { ServiceHistoryList } from "../components/garage/ServiceHistoryList";
import { ServiceLogForm } from "../components/garage/ServiceLogForm";
import { UpcomingMaintenanceList } from "../components/garage/UpcomingMaintenanceList";
import { VehicleHealthDiagram } from "../components/garage/VehicleHealthDiagram";
import { VehiclePassportSummary } from "../components/garage/VehiclePassportSummary";
import { CompactField, InsightCard } from "../components/ui";
import { formatNumber } from "../utils/garage";
import { formatServiceDate, getPartHealthSnapshot } from "../utils/vehiclePassport";

function formatSyncTime(timestamp) {
  if (!timestamp) {
    return "waiting";
  }

  return new Date(timestamp).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getConnectionTone(connection) {
  if (connection === "online") {
    return "text-lime-300";
  }

  if (connection === "degraded" || connection === "partial" || connection === "configured") {
    return "text-amber-300";
  }

  if (connection === "disabled") {
    return "text-neutral-400";
  }

  return "text-rose-300";
}

export function GarageScreen({
  appId,
  firebaseStatus,
  fuelErrors,
  fuelFeedback,
  fuelForm,
  fuelInsights,
  fuelPending,
  onCreatePassportExport,
  onFuelFormChange,
  onPrimeServiceLogForm,
  onSubmitFuelLog,
  onServiceLogFormChange,
  onSubmitServiceLog,
  passportExportFeedback,
  passportExportPending,
  passportExports,
  passportSummary,
  serviceLogErrors,
  serviceLogFeedback,
  serviceLogForm,
  serviceLogPending,
  upcomingMaintenance,
  user,
}) {
  const safeBadges = user.badges ?? [];
  const safeParts = user.parts ?? [];
  const safeServiceLogs = user.serviceLogs ?? [];
  const safeFuelLogs = user.fuelLogs ?? [];
  const hasFirebaseSyncError = [firebaseStatus.profile, firebaseStatus.fuel, firebaseStatus.service].includes("error");
  const partsByKey = new Map(safeParts.map((part) => [part.key, part]));
  const [selectedPartKey, setSelectedPartKey] = useState(safeParts[0]?.key ?? null);
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");
  const activeServicePart = safeParts.find((part) => part.key === serviceLogForm?.partKey) ?? null;
  const selectedPart = safeParts.find((part) => part.key === selectedPartKey) ?? safeParts[0] ?? null;
  const filteredServiceLogs = safeServiceLogs.filter((log) => {
    const matchesPart = selectedPartKey ? log.partKey === selectedPartKey : true;
    const matchesType = historyTypeFilter === "all" ? true : log.type === historyTypeFilter;
    return matchesPart && matchesType;
  });
  const selectedPartLogCount = safeServiceLogs.filter((log) => log.partKey === selectedPartKey).length;
  const selectedPartSpend = safeServiceLogs
    .filter((log) => log.partKey === selectedPartKey)
    .reduce((sum, log) => sum + Number(log.cost ?? 0), 0);
  const lastSelectedPartLog =
    [...safeServiceLogs]
      .filter((log) => log.partKey === selectedPartKey)
      .sort((left, right) => new Date(right.serviceDate) - new Date(left.serviceDate))[0] ?? null;

  const handleSelectPart = (partKey) => {
    setSelectedPartKey(partKey);
    onPrimeServiceLogForm(partKey, serviceLogForm?.type ?? "inspection");
  };

  return (
    <section className="space-y-4">
      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Digital Garage</p>
            <h3 className="mt-2 text-xl font-black">{user.fullName}</h3>
            <p className="mt-1 text-sm text-neutral-400">
              {user.model} / {user.tuningStage} / {user.horsepower} HP
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-500">Vehicle ID</p>
            <p className="max-w-32 truncate font-mono text-xs text-lime-300" title={user.primaryVehicleId}>
              {user.primaryVehicleId}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {safeBadges.map((badge) => (
            <span key={badge} className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-2 text-xs text-lime-200">
              {badge}
            </span>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-neutral-400">
          <div className="flex items-center justify-between">
            <span className="uppercase tracking-[0.22em] text-neutral-500">Private Firebase Sync</span>
            <span className={hasFirebaseSyncError ? "text-rose-300" : "text-lime-300"}>
              {firebaseStatus.mode}
            </span>
          </div>
          <p className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${getConnectionTone(firebaseStatus.connection)}`}>
            Connection: {firebaseStatus.connection}
          </p>
          <p className="mt-2 font-mono text-[11px] text-lime-300">
            UID: {firebaseStatus.authUid ?? "authenticated session pending"}
          </p>
          <p className="mt-1">Profile sync: {firebaseStatus.profile} @ {formatSyncTime(firebaseStatus.lastProfileSyncAt)}</p>
          <p className="mt-1">Fuel log sync: {firebaseStatus.fuel} @ {formatSyncTime(firebaseStatus.lastFuelSyncAt)}</p>
          <p className="mt-1">Service sync: {firebaseStatus.service} @ {formatSyncTime(firebaseStatus.lastServiceSyncAt)}</p>
          {firebaseStatus.error ? <p className="mt-2 text-rose-300">{firebaseStatus.error}</p> : null}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Vehicle Passport</p>
            <p className="text-xs text-neutral-500">Servis gecmisi, saglik skoru ve satis oncesi dogrulanabilir kayitlar.</p>
          </div>
          <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-lime-300">
            Passport Live
          </span>
        </div>
        {passportSummary ? <VehiclePassportSummary summary={passportSummary} /> : null}

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Backend Export</p>
              <p className="mt-2 text-sm text-neutral-300">
                Resale Passport snapshot'i Cloud Function ile private kayda donusturulur.
              </p>
            </div>
            <button
              type="button"
              disabled={passportExportPending}
              onClick={onCreatePassportExport}
              className="min-h-12 shrink-0 rounded-2xl bg-lime-400 px-4 text-xs font-bold text-black shadow-[0_0_18px_rgba(163,230,53,0.28)] disabled:cursor-wait disabled:opacity-60"
            >
              {passportExportPending ? "Export..." : "Export"}
            </button>
          </div>

          {passportExportFeedback ? (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              passportExportFeedback.toLowerCase().includes("olusturuldu")
                ? "border-lime-400/20 bg-lime-400/10 text-lime-100"
                : "border-amber-400/20 bg-amber-400/10 text-amber-100"
            }`}>
              {passportExportFeedback}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {(passportExports ?? []).slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] text-lime-300">{item.id}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {formatServiceDate(item.generatedAt)} / {formatNumber(item.odometer)} KM
                    </p>
                  </div>
                  <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-1 text-xs font-semibold text-lime-200">
                    %{item.readinessScore}
                  </span>
                </div>
              </div>
            ))}
            {(passportExports ?? []).length === 0 ? (
              <p className="text-xs text-neutral-500">Henuz backend export snapshot'i yok.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Upcoming Maintenance</p>
            <p className="text-xs text-neutral-500">KM ve tarih bazli kalan omur birlikte izlenir.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.24em] text-neutral-500">Priority Queue</span>
        </div>
        <UpcomingMaintenanceList items={upcomingMaintenance} />
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Digital Maintenance Log</p>
          <span className="text-xs uppercase tracking-[0.24em] text-neutral-500">Live Wear</span>
        </div>
        <VehicleHealthDiagram
          odometer={user.odometer}
          onSelectPart={handleSelectPart}
          parts={safeParts}
          selectedPartKey={selectedPartKey}
          vehicleType={user.vehicleType ?? "car"}
        />
        <div className="mt-4 space-y-4">
          {safeParts.map((part) => {
            const snapshot = getPartHealthSnapshot(part, user.odometer);
            const tone =
              snapshot.health > 50 ? "bg-lime-400" : snapshot.health > 20 ? "bg-amber-400" : "bg-rose-500 animate-pulse";

            return (
              <div key={part.key} className="rounded-2xl bg-black/20 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>{part.name}</span>
                  <span className={snapshot.health <= 20 ? "text-rose-300" : "text-neutral-300"}>{snapshot.health}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-neutral-800">
                  <div className={`h-full rounded-full ${tone} transition-all duration-700`} style={{ width: `${snapshot.health}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                  <span>{formatNumber(snapshot.kmRemaining)} KM kaldi</span>
                  <span>{snapshot.daysRemaining === null ? "--" : `${snapshot.daysRemaining} gun`}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Service Entry</p>
            <p className="text-xs text-neutral-500">Parca degisimi, kontrol ve onarimlar burada kayda girilir.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.24em] text-neutral-500">Private Log</span>
        </div>
        {serviceLogFeedback ? (
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            firebaseStatus.service === "error"
              ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
              : "border-lime-400/20 bg-lime-400/10 text-lime-200"
          }`}>
            {serviceLogFeedback}
          </div>
        ) : null}
        <ServiceLogForm
          activePart={activeServicePart}
          disabled={serviceLogPending}
          errors={serviceLogErrors}
          form={serviceLogForm}
          onChange={onServiceLogFormChange}
          onSubmit={onSubmitServiceLog}
          parts={safeParts}
        />
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Service History</p>
            <p className="text-xs text-neutral-500">Tarih, KM ve servis atolyeleriyle arac gecmisi saklanir.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.24em] text-neutral-500">{filteredServiceLogs.length} gorunuyor</span>
        </div>

        {selectedPart ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-lime-400">Part History Explorer</p>
                <p className="mt-2 text-lg font-semibold text-neutral-100">{selectedPart.name}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Diyagramdan secilen parcaya ait bakim akisini burada filtreleyebilirsin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onPrimeServiceLogForm(selectedPart.key, "replacement")}
                className="min-h-12 rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 text-xs font-semibold text-lime-200"
              >
                Bugun Degisti
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <InsightCard label="Kayit" value={`${selectedPartLogCount}`} />
              <InsightCard label="Toplam Masraf" value={`${formatNumber(selectedPartSpend)} TL`} />
              <InsightCard label="Son Islem" value={lastSelectedPartLog ? formatServiceDate(lastSelectedPartLog.serviceDate) : "--"} />
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {["all", "replacement", "inspection", "repair"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setHistoryTypeFilter(type)}
              className={`min-h-12 rounded-2xl px-4 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                historyTypeFilter === type
                  ? "bg-lime-400 text-black shadow-[0_0_18px_rgba(163,230,53,0.28)]"
                  : "border border-white/10 bg-black/20 text-neutral-300"
              }`}
            >
              {type === "all" ? "All" : type}
            </button>
          ))}
        </div>

        <ServiceHistoryList logs={filteredServiceLogs} partsByKey={partsByKey} />
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Fuel Efficiency Tracker</p>
            <p className="text-xs text-neutral-500">L/100km hesaplari son girislerle otomatik guncellenir.</p>
          </div>
          <div className="rounded-2xl border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-500">Avg</p>
            <p className="text-sm font-bold text-lime-300">{fuelInsights.average.toFixed(1)} L/100</p>
          </div>
        </div>

        <form className="mt-4 grid grid-cols-2 gap-3" onSubmit={onSubmitFuelLog}>
          <fieldset className="col-span-2 grid grid-cols-2 gap-3 border-0 p-0" disabled={fuelPending}>
          <CompactField label="Liters">
            <input
              type="number"
              value={fuelForm.liters}
              onChange={(event) => onFuelFormChange((current) => ({ ...current, liters: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
            />
            {fuelErrors.liters ? <p className="text-xs text-rose-300">{fuelErrors.liters}</p> : null}
          </CompactField>
          <CompactField label="Price (TL)">
            <input
              type="number"
              value={fuelForm.price}
              onChange={(event) => onFuelFormChange((current) => ({ ...current, price: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
            />
            {fuelErrors.price ? <p className="text-xs text-rose-300">{fuelErrors.price}</p> : null}
          </CompactField>
          <CompactField label="Current KM">
            <input
              type="number"
              value={fuelForm.currentKm}
              onChange={(event) => onFuelFormChange((current) => ({ ...current, currentKm: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
            />
            {fuelErrors.currentKm ? <p className="text-xs text-rose-300">{fuelErrors.currentKm}</p> : null}
          </CompactField>
          <CompactField label="Station">
            <input
              value={fuelForm.station}
              onChange={(event) => onFuelFormChange((current) => ({ ...current, station: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
            />
            {fuelErrors.station ? <p className="text-xs text-rose-300">{fuelErrors.station}</p> : null}
          </CompactField>
          <button
            type="submit"
            className="col-span-2 min-h-12 rounded-2xl bg-lime-400 font-bold text-black shadow-[0_0_20px_rgba(163,230,53,0.35)] disabled:cursor-wait disabled:opacity-60"
          >
            {fuelPending ? "Kaydediliyor..." : "Receipt Ekle"}
          </button>
          </fieldset>
        </form>

        {fuelFeedback ? (
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            firebaseStatus.fuel === "error"
              ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
              : "border-lime-400/20 bg-lime-400/10 text-lime-200"
          }`}>
            {fuelFeedback}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-3">
          <InsightCard label="Total Spend" value={`${formatNumber(fuelInsights.totalSpend)} TL`} />
          <InsightCard label="Per Fill" value={`${formatNumber(fuelInsights.costPerFill)} TL`} />
          <InsightCard label="Logs" value={`${safeFuelLogs.length}`} />
        </div>

        <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
          {safeFuelLogs.map((log) => (
            <div key={log.id} className="rounded-2xl bg-black/20 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{log.station}</p>
                <p className="text-sm text-lime-300">{log.liters} L</p>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                <span>{formatNumber(log.currentKm)} KM</span>
                <span>{formatNumber(log.price)} TL</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4 text-xs text-neutral-500">
        <p className="font-semibold text-neutral-300">Vehicle Passport Data Ownership</p>
        <p className="mt-2">Servis, parca ve yakit kayitlari sadece bu Firebase hesabinin UID'si ile okunabilir.</p>
        <p className="mt-2 break-all font-mono text-[11px] text-lime-300">
          {appId} / {user.primaryVehicleId}
        </p>
        <p className="mt-2">Kayitlar sabit arac kimligine baglidir; sahiplik devri daha sonra guvenli backend akisi ile yapilabilir.</p>
      </div>
    </section>
  );
}
