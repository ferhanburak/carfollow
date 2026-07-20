import { InsightCard } from "../ui";
import { formatNumber } from "../../utils/garage";
import { formatServiceDate } from "../../utils/vehiclePassport";

export function VehiclePassportSummary({ summary }) {
  const report = summary.historyReport;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <InsightCard label="Score" value={`%${summary.maintenanceScore}`} />
        <InsightCard label="Service Logs" value={`${summary.totalServiceLogs}`} />
        <InsightCard label="Fuel Logs" value={`${summary.fuelLogCount}`} />
        <InsightCard label="Critical Parts" value={`${summary.criticalParts}`} />
      </div>

      <div className="rounded-2xl border border-lime-400/20 bg-lime-400/[0.06] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-lime-400">Kayit Durumu</p>
          <span className={`shrink-0 rounded-full border px-3 py-2 text-[10px] uppercase tracking-[0.18em] ${
            summary.recordIntegrity
              ? "border-lime-400/20 bg-lime-400/10 text-lime-200"
              : "border-amber-400/20 bg-amber-400/10 text-amber-200"
          }`}>
            {summary.recordIntegrity ? "Records Match" : "Sync Check"}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
          <span>Status: {summary.passportStatus}</span>
          <span>Issued: {summary.issuedAt ? formatServiceDate(summary.issuedAt) : "local"}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Vehicle Passport Spend</p>
            <p className="mt-2 text-lg font-black text-lime-300">{formatNumber(summary.totalServiceSpend)} TL</p>
          </div>
          <div className="text-right text-xs text-neutral-400">
            <p>Last Service</p>
            <p className="mt-1 font-semibold text-neutral-200">
              {summary.lastServiceLog ? formatServiceDate(summary.lastServiceLog.serviceDate) : "--"}
            </p>
          </div>
        </div>
      </div>

      {report ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Vehicle History Report</p>
              <p className="mt-2 text-lg font-black text-lime-300">%{report.historyScore}</p>
            </div>
            <span className={`rounded-full border px-3 py-2 text-[10px] uppercase tracking-[0.18em] ${
              report.riskFlags.length
                ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                : "border-lime-400/20 bg-lime-400/10 text-lime-200"
            }`}>
              {report.riskFlags.length ? "Review Needed" : "History Clean"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <InsightCard label="Documented KM" value={`%${report.documentedKmCoverage}`} />
            <InsightCard label="Part Proof" value={`${report.documentedParts}`} />
          </div>

          {report.recentServiceLogs.length ? (
            <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Recent Proof</p>
              <div className="mt-3 space-y-2">
                {report.recentServiceLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-neutral-300">{log.serviceShop ?? log.partKey ?? "Service"}</span>
                    <span className="shrink-0 text-neutral-500">{formatServiceDate(log.serviceDate)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {report.riskFlags.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {report.riskFlags.map((flag) => (
                <span key={flag} className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] text-amber-100">
                  {flag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
