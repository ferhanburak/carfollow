import { InsightCard } from "../ui";
import { formatNumber } from "../../utils/garage";
import { formatServiceDate } from "../../utils/vehiclePassport";

export function VehiclePassportSummary({ summary }) {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <InsightCard label="Score" value={`%${summary.maintenanceScore}`} />
        <InsightCard label="Service Logs" value={`${summary.totalServiceLogs}`} />
        <InsightCard label="Fuel Logs" value={`${summary.fuelLogCount}`} />
        <InsightCard label="Critical Parts" value={`${summary.criticalParts}`} />
      </div>

      <div className="rounded-2xl border border-lime-400/20 bg-lime-400/[0.06] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.24em] text-lime-400">Persistent Vehicle Identity</p>
            <p className="mt-2 truncate font-mono text-xs text-neutral-200" title={summary.vehicleId}>
              {summary.vehicleId}
            </p>
          </div>
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
    </div>
  );
}
