import { useState } from "react";
import {
  isFirebaseModerationRepositoryEnabled,
  submitFirebaseModerationReport,
} from "../repositories/cruiserRepository";

export function useModeration(user) {
  const firebaseEnabled = isFirebaseModerationRepositoryEnabled();
  const [moderationFeedback, setModerationFeedback] = useState("");
  const [moderationPending, setModerationPending] = useState(false);

  const reportDriver = async (profile, { reason, details }) => {
    const targetId = profile?.userId ?? profile?.firebaseUid ?? profile?.id;
    if (!targetId || targetId === (user?.firebaseUid ?? user?.id)) {
      setModerationFeedback("Bu profil raporlanamaz.");
      return false;
    }
    if (!firebaseEnabled) {
      setModerationFeedback("Raporlama yalnizca Firebase modunda kullanilabilir.");
      return false;
    }

    setModerationPending(true);
    setModerationFeedback("Rapor guvenlik ekibine iletiliyor...");
    try {
      await submitFirebaseModerationReport({ targetType: "driver", targetId, reason, details });
      setModerationFeedback("Rapor alindi. Inceleme kaydi olusturuldu.");
      return true;
    } catch (error) {
      setModerationFeedback(error instanceof Error ? error.message : "Rapor gonderilemedi.");
      return false;
    } finally {
      setModerationPending(false);
    }
  };

  return { moderationFeedback, moderationPending, reportDriver };
}
