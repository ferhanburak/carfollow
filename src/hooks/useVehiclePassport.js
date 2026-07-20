import { useEffect, useState } from "react";
import {
  appendServiceLog,
  createFirebaseVehiclePassportExport,
  deleteFirebaseServiceLog,
  loadFirebaseVehiclePassportExports,
} from "../repositories/cruiserRepository";
import { createServiceLogForm } from "../utils/garage";
import {
  buildVehiclePassportSummary,
  getUpcomingMaintenance,
  removeServiceLogFromUser,
} from "../utils/vehiclePassport";
import { validateServiceLogForm } from "../utils/validation";

export function useVehiclePassport({ user, setUser, syncServiceLog }) {
  const [serviceLogForm, setServiceLogForm] = useState(createServiceLogForm(user));
  const [serviceLogErrors, setServiceLogErrors] = useState({});
  const [serviceLogFeedback, setServiceLogFeedback] = useState("");
  const [serviceLogPending, setServiceLogPending] = useState(false);
  const [serviceLogDeletePendingId, setServiceLogDeletePendingId] = useState("");
  const [passportExportFeedback, setPassportExportFeedback] = useState("");
  const [passportExportPending, setPassportExportPending] = useState(false);
  const [passportExports, setPassportExports] = useState([]);

  useEffect(() => {
    setServiceLogForm(createServiceLogForm(user));
    setServiceLogErrors({});
    setServiceLogFeedback("");
    setServiceLogPending(false);
    setServiceLogDeletePendingId("");
    setPassportExportFeedback("");
    setPassportExportPending(false);
    setPassportExports([]);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.firebaseUid) {
      return;
    }

    let cancelled = false;
    async function loadExports() {
      try {
        const exports = await loadFirebaseVehiclePassportExports();
        if (!cancelled) {
          setPassportExports(exports);
        }
      } catch (error) {
        if (!cancelled) {
          setPassportExportFeedback(error instanceof Error ? error.message : "Vehicle Passport export history could not be loaded.");
        }
      }
    }

    void loadExports();
    return () => {
      cancelled = true;
    };
  }, [user?.firebaseUid, user?.primaryVehicleId]);

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
        setServiceLogFeedback("Servis kaydi su anda tamamlanamadi. Lutfen tekrar dene.");
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

  const deleteServiceLog = async (serviceLogId) => {
    const targetLog = user?.serviceLogs?.find((log) => log.id === serviceLogId);
    if (!targetLog || serviceLogPending || serviceLogDeletePendingId) return false;

    setServiceLogDeletePendingId(serviceLogId);
    setServiceLogFeedback("Servis kaydi ve bagli hesaplamalar siliniyor...");
    try {
      if (user.firebaseUid) {
        await deleteFirebaseServiceLog(serviceLogId);
      }
      setUser((current) => current ? removeServiceLogFromUser(current, serviceLogId) : current);
      setServiceLogFeedback("Secilen servis kaydi gecmisten silindi ve Vehicle Passport yeniden hesaplandi.");
      return true;
    } catch (error) {
      setServiceLogFeedback(error instanceof Error ? error.message : "Servis kaydi silinemedi. Lutfen tekrar dene.");
      return false;
    } finally {
      setServiceLogDeletePendingId("");
    }
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

  const createPassportExport = async () => {
    if (!user || passportExportPending) {
      return null;
    }

    setPassportExportPending(true);
    setPassportExportFeedback("Arac gecmisi raporu hazirlaniyor...");
    try {
      const result = await createFirebaseVehiclePassportExport();
      const nextExport = result?.export;
      if (nextExport) {
        setPassportExports((current) => [nextExport, ...current.filter((item) => item.id !== nextExport.id)]);
      }
      setPassportExportFeedback("Arac gecmisi raporu olusturuldu.");
      return result;
    } catch (error) {
      console.error("Vehicle history report could not be created", error);
      setPassportExportFeedback("Arac gecmisi raporu su anda olusturulamadi. Lutfen tekrar dene.");
      return null;
    } finally {
      setPassportExportPending(false);
    }
  };

  return {
    createPassportExport,
    deleteServiceLog,
    passportSummary,
    passportExportFeedback,
    passportExportPending,
    passportExports,
    primeServiceLogForm,
    serviceLogErrors,
    serviceLogDeletePendingId,
    serviceLogFeedback,
    serviceLogForm,
    serviceLogPending,
    setServiceLogForm,
    submitServiceLog,
    upcomingMaintenance,
  };
}
