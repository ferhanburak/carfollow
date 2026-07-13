import { useEffect, useState } from "react";
import {
  appendServiceLog,
} from "../repositories/cruiserRepository";
import { createServiceLogForm } from "../utils/garage";
import {
  buildVehiclePassportSummary,
  getUpcomingMaintenance,
} from "../utils/vehiclePassport";
import { validateServiceLogForm } from "../utils/validation";

export function useVehiclePassport({ user, setUser, syncServiceLog }) {
  const [serviceLogForm, setServiceLogForm] = useState(createServiceLogForm(user));
  const [serviceLogErrors, setServiceLogErrors] = useState({});
  const [serviceLogFeedback, setServiceLogFeedback] = useState("");
  const [serviceLogPending, setServiceLogPending] = useState(false);

  useEffect(() => {
    setServiceLogForm(createServiceLogForm(user));
    setServiceLogErrors({});
    setServiceLogFeedback("");
    setServiceLogPending(false);
  }, [user?.id]);

  const passportSummary = user ? buildVehiclePassportSummary(user) : null;
  const upcomingMaintenance = user ? getUpcomingMaintenance(user.parts ?? [], user.odometer) : [];

  const commitServiceLog = async (draftLog) => {
    if (!user || serviceLogPending) {
      return null;
    }

    const validationErrors = validateServiceLogForm(draftLog, user.odometer);
    setServiceLogErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const nextLog = {
      id: draftLog.id ?? `service-${Date.now()}`,
      partKey: draftLog.partKey,
      type: draftLog.type,
      serviceDate: draftLog.serviceDate,
      serviceKm: Number(draftLog.serviceKm),
      serviceShop: draftLog.serviceShop.trim(),
      cost: Number(draftLog.cost || 0),
      notes: draftLog.notes.trim(),
      receiptImageUrl: draftLog.receiptImageUrl?.trim?.() ?? "",
      vehicleId: user.primaryVehicleId,
    };

    const nextUserSnapshot = appendServiceLog(user, nextLog);
    const servicedPart = nextLog.type === "replacement"
      ? nextUserSnapshot?.parts?.find((part) => part.key === nextLog.partKey) ?? null
      : null;

    setServiceLogPending(true);
    setServiceLogFeedback("Vehicle Passport kaydi guvenli olarak isleniyor...");
    try {
      const syncResult = syncServiceLog
        ? await syncServiceLog(nextLog, servicedPart)
        : { ok: true, mode: "mock" };
      if (syncResult?.ok === false) {
        setServiceLogFeedback(`Kayit tamamlanamadi: ${syncResult.error}`);
        return null;
      }

      setUser((current) => {
        if (!current || current.serviceLogs?.some((log) => log.id === nextLog.id)) {
          return current;
        }
        return appendServiceLog(current, nextLog);
      });
      setServiceLogForm(createServiceLogForm(nextUserSnapshot));
      setServiceLogErrors({});
      setServiceLogFeedback(
        `${nextUserSnapshot.parts?.find((part) => part.key === nextLog.partKey)?.name ?? "Part"} kaydi Vehicle Passport'a eklendi.`,
      );
      return nextLog;
    } finally {
      setServiceLogPending(false);
    }
  };

  const submitServiceLog = async (event) => {
    event.preventDefault();
    await commitServiceLog(serviceLogForm);
  };

  const primeServiceLogForm = (partKey, type = "inspection") => {
    const selectedPart = (user?.parts ?? []).find((part) => part.key === partKey);
    setServiceLogForm((current) => ({
      ...current,
      partKey,
      type,
      serviceDate: new Date().toISOString().slice(0, 10),
      serviceKm: Math.round(user?.odometer ?? current.serviceKm ?? 0),
      serviceShop: user?.garage ?? current.serviceShop ?? "",
      notes:
        type === "replacement"
          ? `${selectedPart?.name ?? "Part"} replacement prepared from vehicle map.`
          : `${selectedPart?.name ?? "Part"} inspection prepared from vehicle map.`,
    }));
    setServiceLogErrors({});
    setServiceLogFeedback(`${selectedPart?.name ?? "Part"} loaded into service form.`);
  };

  return {
    passportSummary,
    primeServiceLogForm,
    serviceLogErrors,
    serviceLogFeedback,
    serviceLogForm,
    serviceLogPending,
    setServiceLogForm,
    submitServiceLog,
    upcomingMaintenance,
  };
}
