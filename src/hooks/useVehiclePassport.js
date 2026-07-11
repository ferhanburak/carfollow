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

  const submitServiceLog = (event) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    const validationErrors = validateServiceLogForm(serviceLogForm, user.odometer);
    setServiceLogErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const nextLog = {
      id: `service-${Date.now()}`,
      partKey: serviceLogForm.partKey,
      type: serviceLogForm.type,
      serviceDate: serviceLogForm.serviceDate,
      serviceKm: Number(serviceLogForm.serviceKm),
      serviceShop: serviceLogForm.serviceShop.trim(),
      cost: Number(serviceLogForm.cost || 0),
      notes: serviceLogForm.notes.trim(),
      receiptImageUrl: serviceLogForm.receiptImageUrl.trim(),
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
  };

  return {
    passportSummary,
    serviceLogErrors,
    serviceLogFeedback,
    serviceLogForm,
    setServiceLogForm,
    submitServiceLog,
    upcomingMaintenance,
  };
}
