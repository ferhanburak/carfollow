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
      setModerationFeedback("Raporlama yalnızca Firebase modunda kullanılabilir.");
      return false;
    }

    setModerationPending(true);
    setModerationFeedback("Rapor güvenlik ekibine iletiliyor...");
    try {
      await submitFirebaseModerationReport({ targetType: "driver", targetId, reason, details });
      setModerationFeedback("Rapor alındı. Inceleme kaydı oluşturuldu.");
      return true;
    } catch (error) {
      setModerationFeedback(error instanceof Error ? error.message : "Rapor gönderilemedi.");
      return false;
    } finally {
      setModerationPending(false);
    }
  };

  return { moderationFeedback, moderationPending, reportDriver };
}
