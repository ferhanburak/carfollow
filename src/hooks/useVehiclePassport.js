import { useEffect, useState } from "react";
import {
  appendServiceLog,
  cancelFirebaseVehiclePassportTransfer,
  createFirebaseVehiclePassportExport,
  loadFirebaseVehiclePassportExports,
  loadFirebaseVehiclePassportTransferState,
  requestFirebaseVehiclePassportTransfer,
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
  const [passportExportFeedback, setPassportExportFeedback] = useState("");
  const [passportExportPending, setPassportExportPending] = useState(false);
  const [passportExports, setPassportExports] = useState([]);
  const [passportTransferAuditEvents, setPassportTransferAuditEvents] = useState([]);
  const [passportTransferFeedback, setPassportTransferFeedback] = useState("");
  const [passportTransferPending, setPassportTransferPending] = useState(false);
  const [passportTransferTargetPlate, setPassportTransferTargetPlate] = useState("");
  const [passportTransfers, setPassportTransfers] = useState([]);

  useEffect(() => {
    setServiceLogForm(createServiceLogForm(user));
    setServiceLogErrors({});
    setServiceLogFeedback("");
    setServiceLogPending(false);
    setPassportExportFeedback("");
    setPassportExportPending(false);
    setPassportExports([]);
    setPassportTransferAuditEvents([]);
    setPassportTransferFeedback("");
    setPassportTransferPending(false);
    setPassportTransferTargetPlate("");
    setPassportTransfers([]);
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

  useEffect(() => {
    if (!user?.firebaseUid) {
      return;
    }

    let cancelled = false;
    async function loadTransferState() {
      try {
        const transferState = await loadFirebaseVehiclePassportTransferState();
        if (!cancelled) {
          setPassportTransfers(transferState.transfers ?? []);
          setPassportTransferAuditEvents(transferState.auditEvents ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setPassportTransferFeedback(error instanceof Error ? error.message : "Vehicle Passport transfer history could not be loaded.");
        }
      }
    }

    void loadTransferState();
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

  const createPassportExport = async () => {
    if (!user || passportExportPending) {
      return null;
    }

    setPassportExportPending(true);
    setPassportExportFeedback("Backend Vehicle Passport export hazirlaniyor...");
    try {
      const result = await createFirebaseVehiclePassportExport();
      const nextExport = result?.export;
      if (nextExport) {
        setPassportExports((current) => [nextExport, ...current.filter((item) => item.id !== nextExport.id)]);
      }
      setPassportExportFeedback("Vehicle Passport export backend tarafinda olusturuldu.");
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vehicle Passport export olusturulamadi.";
      setPassportExportFeedback(message);
      return null;
    } finally {
      setPassportExportPending(false);
    }
  };

  const requestPassportTransfer = async () => {
    if (!user || passportTransferPending) {
      return null;
    }

    setPassportTransferPending(true);
    setPassportTransferFeedback("Vehicle Passport transfer istegi backend tarafinda hazirlaniyor...");
    try {
      const result = await requestFirebaseVehiclePassportTransfer({
        targetPlate: passportTransferTargetPlate,
      });
      if (result?.transfer) {
        setPassportTransfers((current) => [result.transfer, ...current.filter((item) => item.id !== result.transfer.id)]);
      }
      if (result?.auditEvent) {
        setPassportTransferAuditEvents((current) => [result.auditEvent, ...current.filter((item) => item.id !== result.auditEvent.id)]);
      }
      if (result?.transfer) {
        setUser((current) => current ? {
          ...current,
          vehiclePassport: {
            ...(current.vehiclePassport ?? {}),
            transferState: "transfer_requested",
            pendingTransferId: result.transfer.id,
            transferTargetUserId: result.transfer.targetUserId,
            transferTargetPlate: result.transfer.targetPlate,
            transferRequestedAt: result.transfer.requestedAt,
          },
        } : current);
      }
      setPassportTransferTargetPlate("");
      setPassportTransferFeedback("Transfer istegi olusturuldu. Passport pending moduna alindi.");
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vehicle Passport transfer istegi olusturulamadi.";
      setPassportTransferFeedback(message);
      return null;
    } finally {
      setPassportTransferPending(false);
    }
  };

  const cancelPassportTransfer = async (transferId) => {
    if (!transferId || passportTransferPending) {
      return null;
    }

    setPassportTransferPending(true);
    setPassportTransferFeedback("Transfer istegi iptal ediliyor...");
    try {
      const result = await cancelFirebaseVehiclePassportTransfer({ transferId });
      if (result?.transfer) {
        setPassportTransfers((current) => current.map((item) => (
          item.id === result.transfer.id ? result.transfer : item
        )));
      }
      if (result?.auditEvent) {
        setPassportTransferAuditEvents((current) => [result.auditEvent, ...current.filter((item) => item.id !== result.auditEvent.id)]);
      }
      if (result?.transfer) {
        setUser((current) => {
          if (!current) {
            return current;
          }
          const {
            pendingTransferId: _pendingTransferId,
            transferTargetUserId: _transferTargetUserId,
            transferTargetPlate: _transferTargetPlate,
            transferRequestedAt: _transferRequestedAt,
            ...passport
          } = current.vehiclePassport ?? {};
          return {
            ...current,
            vehiclePassport: {
              ...passport,
              transferState: "owned",
            },
          };
        });
      }
      setPassportTransferFeedback("Transfer istegi iptal edildi. Passport yeniden owned modunda.");
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vehicle Passport transfer istegi iptal edilemedi.";
      setPassportTransferFeedback(message);
      return null;
    } finally {
      setPassportTransferPending(false);
    }
  };

  return {
    cancelPassportTransfer,
    createPassportExport,
    passportSummary,
    passportExportFeedback,
    passportExportPending,
    passportExports,
    passportTransferAuditEvents,
    passportTransferFeedback,
    passportTransferPending,
    passportTransferTargetPlate,
    passportTransfers,
    primeServiceLogForm,
    requestPassportTransfer,
    serviceLogErrors,
    serviceLogFeedback,
    serviceLogForm,
    serviceLogPending,
    setServiceLogForm,
    setPassportTransferTargetPlate,
    submitServiceLog,
    upcomingMaintenance,
  };
}
