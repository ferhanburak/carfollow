import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  set,
} from 'firebase/database';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { callFirebase, toMillis } from '@/lib/firebase-callable';
import {
  PRIVATE_COLLECTIONS,
  privateCollectionPath,
  realtimeDmThreadPath,
  realtimeDmUserThreadsPath,
  realtimePresencePath,
} from '@/lib/firebase-paths';
import { firestoreDb, realtimeDb } from '@/lib/firebase';
import { registerDevicePushToken } from '@/lib/push-notifications';
import { useAuth } from '@/providers/auth-provider';
import type {
  CruiserNotification,
  DirectMessage,
  DirectMessageThread,
} from '@/types/cruiser';

type AppDataValue = {
  notifications: CruiserNotification[];
  unreadNotificationCount: number;
  threads: DirectMessageThread[];
  unreadConversationCount: number;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  openThread: (targetUserId: string) => Promise<string>;
  sendMessage: (
    targetUserId: string,
    body: string,
    share?: DirectMessage['share'],
  ) => Promise<void>;
  markThreadRead: (threadId: string) => Promise<void>;
};

const AppDataContext = createContext<AppDataValue | null>(null);

const notificationTypes = new Set([
  'friend-request',
  'clan-invite',
  'convoy-invite',
  'convoy-invite-response',
  'convoy-join',
  'convoy-response',
  'convoy-role',
  'convoy-cancelled',
  'convoy-started',
  'forum-like',
  'forum-reply',
  'moderation',
]);

function normalizeMessages(payload: Record<string, DirectMessage> | undefined) {
  return Object.entries(payload ?? {})
    .map(([id, message]) => ({ ...message, id: message.id || id }))
    .sort((left, right) => Number(left.createdAt) - Number(right.createdAt));
}

function normalizeThread(
  threadId: string,
  payload: Record<string, unknown>,
  currentUserId: string,
): DirectMessageThread | null {
  const participantUids = payload.participantUids as Record<string, boolean> | undefined;
  if (!participantUids?.[currentUserId]) return null;
  const participantUserId = Object.keys(participantUids)
    .find((userId) => userId !== currentUserId);
  if (!participantUserId) return null;
  const profiles = payload.participantProfiles as Record<string, Record<string, string>> | undefined;
  const profile = profiles?.[participantUserId] ?? {};
  const readBy = payload.readBy as Record<string, number> | undefined;
  return {
    id: threadId,
    participantUserId,
    participantName: profile.fullName || profile.plate || 'TrackSnap sürücüsü',
    participantPlate: profile.plate || '',
    participantModel: profile.model || 'Araç bilgisi yok',
    messages: normalizeMessages(payload.messages as Record<string, DirectMessage> | undefined),
    lastReadAt: Number(readBy?.[currentUserId] ?? 0),
    updatedAt: Number(payload.updatedAt ?? 0),
  };
}

export function AppDataProvider({ children }: PropsWithChildren) {
  const { profile, user } = useAuth();
  const [notifications, setNotifications] = useState<CruiserNotification[]>([]);
  const [threadMap, setThreadMap] = useState<Record<string, DirectMessageThread>>({});

  useEffect(() => {
    if (!user) return;
    void registerDevicePushToken().catch(() => {
      // Push setup must never block the signed-in application experience.
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      collection(firestoreDb, privateCollectionPath(user.uid, PRIVATE_COLLECTIONS.notifications)),
      (snapshot) => {
        setNotifications(snapshot.docs
          .map((item) => {
            const data = item.data();
            return {
              id: String(data.id ?? item.id),
              type: String(data.type ?? ''),
              title: String(data.title ?? ''),
              body: String(data.body ?? ''),
              createdAt: toMillis(data.createdAt),
              readAt: data.readAt ? toMillis(data.readAt) : null,
            };
          })
          .filter((item) => notificationTypes.has(item.type))
          .sort((left, right) => right.createdAt - left.createdAt)
          .slice(0, 100));
      },
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const threadUnsubscribers = new Map<string, () => void>();
    const indexReference = ref(realtimeDb, realtimeDmUserThreadsPath(user.uid));
    const unsubscribeIndex = onValue(indexReference, (snapshot) => {
      const nextIds = new Set(Object.keys(snapshot.val() ?? {}));
      threadUnsubscribers.forEach((unsubscribe, threadId) => {
        if (nextIds.has(threadId)) return;
        unsubscribe();
        threadUnsubscribers.delete(threadId);
        setThreadMap((current) => {
          const next = { ...current };
          delete next[threadId];
          return next;
        });
      });
      nextIds.forEach((threadId) => {
        if (threadUnsubscribers.has(threadId)) return;
        const unsubscribe = onValue(ref(realtimeDb, realtimeDmThreadPath(threadId)), (threadSnapshot) => {
          const thread = normalizeThread(threadId, threadSnapshot.val() ?? {}, user.uid);
          setThreadMap((current) => {
            const next = { ...current };
            if (thread) next[threadId] = thread;
            else delete next[threadId];
            return next;
          });
        });
        threadUnsubscribers.set(threadId, unsubscribe);
      });
    });
    return () => {
      unsubscribeIndex();
      threadUnsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user]);

  useEffect(() => {
    if (!user || !profile?.plate) return;
    const presenceReference = ref(realtimeDb, `${realtimePresencePath()}/${user.uid}`);
    const offline = {
      firebaseUid: user.uid,
      plate: profile.plate,
      status: 'offline',
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    void onDisconnect(presenceReference).set(offline);
    void set(presenceReference, {
      ...offline,
      status: 'online',
    });
    return () => {
      void set(presenceReference, offline);
    };
  }, [profile?.plate, user]);

  const activeNotifications = useMemo(
    () => user ? notifications : [],
    [notifications, user],
  );
  const threads = useMemo(
    () => user
      ? Object.values(threadMap).sort((left, right) => right.updatedAt - left.updatedAt)
      : [],
    [threadMap, user],
  );
  const unreadConversationCount = threads.filter((thread) => {
    const latest = thread.messages.at(-1);
    return latest && latest.senderUserId !== user?.uid &&
      latest.senderUid !== user?.uid &&
      latest.createdAt > thread.lastReadAt;
  }).length;

  const value = useMemo<AppDataValue>(() => ({
    notifications: activeNotifications,
    unreadNotificationCount: activeNotifications.filter((item) => !item.readAt).length,
    threads,
    unreadConversationCount,
    markNotificationRead: async (notificationId) => {
      await callFirebase('markNotificationRead', { notificationId });
    },
    markAllNotificationsRead: async () => {
      await callFirebase('markAllNotificationsRead');
    },
    openThread: async (targetUserId) => {
      const response = await callFirebase<{ threadId: string }>(
        'ensureDirectMessageThread',
        { targetUserId },
      );
      return response.threadId;
    },
    sendMessage: async (targetUserId, body, share) => {
      await callFirebase('sendDirectMessage', { targetUserId, body: body.trim(), share });
    },
    markThreadRead: async (threadId) => {
      if (!user) return;
      await set(
        ref(realtimeDb, `${realtimeDmThreadPath(threadId)}/readBy/${user.uid}`),
        serverTimestamp(),
      );
    },
  }), [activeNotifications, threads, unreadConversationCount, user]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData, AppDataProvider içinde kullanılmalıdır.');
  return context;
}
