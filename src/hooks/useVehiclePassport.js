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

  useEffect(() => {
    setServiceLogForm(createServiceLogForm(user));
    setServiceLogErrors({});
    setServiceLogFeedback("");
  }, [user?.id]);

  const passportSummary = user ? buildVehiclePassportSummary(user) : null;
  const upcomingMaintenance = user ? getUpcomingMaintenance(user.parts ?? [], user.odometer) : [];

  const commitServiceLog = (draftLog) => {
    if (!user) {
      return;
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
    };

    let nextUserSnapshot = null;
    setUser((current) => {
      nextUserSnapshot = appendServiceLog(current, nextLog);
      return nextUserSnapshot;
    });

    const servicedPart = nextUserSnapshot?.parts?.find((part) => part.key === nextLog.partKey) ?? null;
    setServiceLogForm(createServiceLogForm(nextUserSnapshot ?? user));
    setServiceLogErrors({});
    setServiceLogFeedback(`${servicedPart?.name ?? "Part"} service saved to Vehicle Passport.`);
    syncServiceLog?.(nextLog, servicedPart);
    return nextLog;
  };

  const submitServiceLog = (event) => {
    event.preventDefault();
    commitServiceLog(serviceLogForm);
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
    setServiceLogForm,
    submitServiceLog,
    upcomingMaintenance,
  };
}
