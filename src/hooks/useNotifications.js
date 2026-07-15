import { useEffect, useState } from "react";
import {
  isFirebaseNotificationRepositoryEnabled,
  markAllFirebaseNotificationsRead,
  markFirebaseNotificationRead,
  subscribeFirebaseNotifications,
} from "../repositories/cruiserRepository";

export function useNotifications(user) {
  const firebaseEnabled = isFirebaseNotificationRepositoryEnabled();
  const [notifications, setNotifications] = useState([]);
  const [notificationFeedback, setNotificationFeedback] = useState("");
  const userId = user?.firebaseUid ?? user?.id ?? "";

  useEffect(() => {
    if (!firebaseEnabled || !userId) {
      setNotifications([]);
      return undefined;
    }

    let cancelled = false;
    let unsubscribe = () => {};
    void subscribeFirebaseNotifications(
      (nextNotifications) => !cancelled && setNotifications(nextNotifications),
      (error) => !cancelled && setNotificationFeedback(error instanceof Error ? error.message : "Bildirimler yuklenemedi."),
    ).then((nextUnsubscribe) => {
      if (cancelled) {
        nextUnsubscribe();
      } else {
        unsubscribe = nextUnsubscribe;
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [firebaseEnabled, userId]);

  const markNotificationRead = async (notificationId) => {
    if (!firebaseEnabled) {
      setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, readAt: Date.now() } : item));
      return true;
    }
    try {
      await markFirebaseNotificationRead(notificationId);
      setNotificationFeedback("");
      return true;
    } catch (error) {
      setNotificationFeedback(error instanceof Error ? error.message : "Bildirim guncellenemedi.");
      return false;
    }
  };

  const markAllNotificationsRead = async () => {
    if (!firebaseEnabled) {
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? Date.now() })));
      return true;
    }
    try {
      await markAllFirebaseNotificationsRead();
      setNotificationFeedback("");
      return true;
    } catch (error) {
      setNotificationFeedback(error instanceof Error ? error.message : "Bildirimler guncellenemedi.");
      return false;
    }
  };

  return {
    markAllNotificationsRead,
    markNotificationRead,
    notificationFeedback,
    notifications,
    unreadNotificationCount: notifications.filter((item) => !item.readAt).length,
  };
}
