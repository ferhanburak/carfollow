import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFirebaseServices: vi.fn(),
  invokeCallable: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock("../services/firebaseClient", () => ({
  getFirebaseServices: mocks.getFirebaseServices,
  isFirebaseModeEnabled: () => true,
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn((_functions, name) => (payload) => mocks.invokeCallable(name, payload)),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_firestore, path) => ({ path })),
  onSnapshot: mocks.onSnapshot,
}));

import {
  markAllFirebaseNotificationsRead,
  markFirebaseNotificationRead,
  subscribeFirebaseNotifications,
} from "./firebaseNotificationRepository";

beforeEach(() => {
  mocks.getFirebaseServices.mockReset();
  mocks.invokeCallable.mockReset();
  mocks.onSnapshot.mockReset();
  mocks.getFirebaseServices.mockResolvedValue({
    authUser: { uid: "user-1" },
    firestore: { id: "firestore" },
    functions: { id: "functions" },
  });
});

describe("Firebase notification repository", () => {
  it("normalizes timestamps and sorts notifications in client memory", async () => {
    const unsubscribe = vi.fn();
    mocks.onSnapshot.mockImplementation((_reference, onChange) => {
      onChange({
        docs: [
          {
            id: "older",
            data: () => ({ title: "Older", createdAt: { toMillis: () => 100 } }),
          },
          {
            id: "newer",
            data: () => ({ title: "Newer", createdAt: { toMillis: () => 300 }, readAt: { toMillis: () => 400 } }),
          },
        ],
      });
      return unsubscribe;
    });
    const onChange = vi.fn();

    const stop = await subscribeFirebaseNotifications(onChange);

    expect(stop).toBe(unsubscribe);
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "newer", createdAt: 300, readAt: 400 }),
      expect.objectContaining({ id: "older", createdAt: 100, readAt: null }),
    ]);
  });

  it("marks one or all notifications through callable functions", async () => {
    mocks.invokeCallable
      .mockResolvedValueOnce({ data: { notificationId: "notification-1", read: true } })
      .mockResolvedValueOnce({ data: { updatedCount: 3 } });

    await markFirebaseNotificationRead("notification-1");
    await markAllFirebaseNotificationsRead();

    expect(mocks.invokeCallable).toHaveBeenNthCalledWith(1, "markNotificationRead", {
      notificationId: "notification-1",
    });
    expect(mocks.invokeCallable).toHaveBeenNthCalledWith(2, "markAllNotificationsRead", {});
  });
});
