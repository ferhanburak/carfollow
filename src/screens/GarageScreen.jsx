import { useState } from "react";
import { ServiceHistoryList } from "../components/garage/ServiceHistoryList";
import { ServiceLogForm } from "../components/garage/ServiceLogForm";
import { UpcomingMaintenanceList } from "../components/garage/UpcomingMaintenanceList";
import { VehicleHealthCenter } from "../components/garage/VehicleHealthCenter";
import { VehiclePassportSummary } from "../components/garage/VehiclePassportSummary";
import { CompactField, InsightCard } from "../components/ui";
import { formatNumber } from "../utils/garage";
import { formatServiceDate, getPartHealthSnapshot } from "../utils/vehiclePassport";

function getFeedbackTone(message) {
  return /(tamamlanamadi|olusturulamadi|basarisiz|tekrar dene)/i.test(message ?? "")
    ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
    : "border-lime-400/20 bg-lime-400/10 text-lime-100";
}

export function GarageScreen({
  fuelErrors,
  fuelFeedback,
  fuelForm,
  fuelInsights,
  fuelPending,
  onCreatePassportExport,
  onDeleteServiceLog,
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
  serviceLogDeletePendingId,
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
  const partsByKey = new Map(safeParts.map((part) => [part.key, part]));
  const [selectedPartKey, setSelectedPartKey] = useState(safeParts[0]?.key ?? null);
  const [historyPartFilter, setHistoryPartFilter] = useState("all");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");
  const activeServicePart = safeParts.find((part) => part.key === serviceLogForm?.partKey) ?? null;
  const historySelectedPart = safeParts.find((part) => part.key === historyPartFilter) ?? null;
  const partScopedServiceLogs = safeServiceLogs.filter((log) =>
    historyPartFilter === "all" ? true : log.partKey === historyPartFilter,
  );
  const filteredServiceLogs = partScopedServiceLogs.filter((log) =>
    historyTypeFilter === "all" ? true : log.type === historyTypeFilter,
  );
  const historySpend = partScopedServiceLogs
    .reduce((sum, log) => sum + Number(log.cost ?? 0), 0);
  const lastHistoryLog =
    [...partScopedServiceLogs]
      .sort((left, right) => new Date(right.serviceDate) - new Date(left.serviceDate))[0] ?? null;

  const handleSelectPart = (partKey) => {
    setSelectedPartKey(partKey);
    onPrimeServiceLogForm(partKey, serviceLogForm?.type ?? "inspection");
  };

  return (
    <section className="space-y-4">
      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Digital Garage</p>
          <h3 className="mt-2 text-xl font-black">{user.fullName}</h3>
          <p className="mt-1 text-sm text-neutral-400">
            {user.model} / {user.tuningStage} / {user.horsepower} HP
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {safeBadges.map((badge) => (
            <span key={badge} className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-2 text-xs text-lime-200">
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Vehicle Passport</p>
            <p className="text-xs text-neutral-500">Servis gecmisi, saglik skoru ve arac gecmisi icin dogrulanabilir kayitlar.</p>
          </div>
          <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-lime-300">
            Passport Live
          </span>
        </div>
        {passportSummary ? <VehiclePassportSummary summary={passportSummary} /> : null}

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Arac Gecmisi Raporu</p>
              <p className="mt-2 text-sm text-neutral-300">
                Servis, parca ve kilometre gecmisinin ozet raporunu olustur.
              </p>
            </div>
            <button
              type="button"
              disabled={passportExportPending}
              onClick={onCreatePassportExport}
              className="min-h-12 shrink-0 rounded-2xl bg-lime-400 px-4 text-xs font-bold text-black shadow-[0_0_18px_rgba(163,230,53,0.28)] disabled:cursor-wait disabled:opacity-60"
            >
              {passportExportPending ? "Hazirlaniyor..." : "Rapor Olustur"}
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
                    <p className="text-xs font-semibold text-neutral-200">Arac gecmisi raporu</p>
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
              <p className="text-xs text-neutral-500">Henuz olusturulmus rapor yok.</p>
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
        <VehicleHealthCenter
          odometer={user.odometer}
          onSelectPart={handleSelectPart}
          parts={safeParts}
          selectedPartKey={selectedPartKey}
          vehicleType={user.vehicleType ?? "car"}
        />
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
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${getFeedbackTone(serviceLogFeedback)}`}>
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

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-lime-400">Part History Explorer</p>
              <p className="mt-2 text-lg font-semibold text-neutral-100">
                {historySelectedPart?.name ?? "Tum Parcalar"}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Tum servis gecmisini gor veya asagidan belirli bir parcayi filtrele.
              </p>
            </div>
            {historySelectedPart ? (
              <button
                type="button"
                onClick={() => onPrimeServiceLogForm(historySelectedPart.key, "replacement")}
                className="min-h-12 shrink-0 rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 text-xs font-semibold text-lime-200"
              >
                Bugun Degisti
              </button>
            ) : null}
          </div>

          <label className="mt-4 block text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500" htmlFor="service-history-part">
            Gecmis Parcasi
          </label>
          <select
            id="service-history-part"
            value={historyPartFilter}
            onChange={(event) => setHistoryPartFilter(event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 text-sm text-neutral-100 outline-none focus:border-lime-400"
          >
            <option value="all">Tum Parcalar</option>
            {safeParts.map((part) => (
              <option key={part.key} value={part.key}>{part.name}</option>
            ))}
          </select>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <InsightCard label="Kayit" value={`${partScopedServiceLogs.length}`} />
            <InsightCard label="Toplam Masraf" value={`${formatNumber(historySpend)} TL`} />
            <InsightCard label="Son Islem" value={lastHistoryLog ? formatServiceDate(lastHistoryLog.serviceDate) : "--"} />
          </div>
        </div>

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

        <ServiceHistoryList
          logs={filteredServiceLogs}
          onDelete={onDeleteServiceLog}
          partsByKey={partsByKey}
          pendingId={serviceLogDeletePendingId}
        />
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
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${getFeedbackTone(fuelFeedback)}`}>
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
    </section>
  );
}
