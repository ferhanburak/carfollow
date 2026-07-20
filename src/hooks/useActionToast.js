import { useEffect, useRef, useState } from "react";
import { inferActionToastTone } from "../components/ActionToast";

export function useActionToast(feedbacks) {
  const [toast, setToast] = useState(null);
  const previousFeedbacks = useRef(new Map());
  const feedbackSignature = Object.entries(feedbacks)
    .map(([source, message]) => `${source}:${String(message ?? "")}`)
    .join("\u001f");

  useEffect(() => {
    let nextToast = null;
    Object.entries(feedbacks).forEach(([source, rawMessage]) => {
      const message = String(rawMessage ?? "").trim();
      const previousMessage = previousFeedbacks.current.get(source) ?? "";
      if (message && message !== previousMessage) {
        nextToast = {
          id: `${source}-${Date.now()}`,
          message,
          tone: inferActionToastTone(message),
        };
      }
      previousFeedbacks.current.set(source, message);
    });

    if (nextToast) setToast(nextToast);
  }, [feedbackSignature]);

  useEffect(() => {
    if (!toast) return undefined;
    const duration = toast.tone === "error" ? 5200 : toast.tone === "pending" ? 4200 : 3600;
    const timer = window.setTimeout(() => setToast(null), duration);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return {
    dismissToast: () => setToast(null),
    toast,
  };
}
