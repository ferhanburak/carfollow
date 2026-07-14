import { useEffect, useMemo, useState } from "react";
import {
  ensureFirebaseDirectMessageThread,
  initializeFirebasePresence,
  isFirebaseMessagingRepositoryEnabled,
  markFirebaseConversationRead,
  saveFirebasePresenceState,
  saveFirebaseTypingState,
  sendFirebaseDirectMessage,
  subscribeFirebaseDirectMessages,
  subscribeFirebasePresence,
  subscribeFirebaseTyping,
} from "../repositories/cruiserRepository";
import {
  appendDirectMessage,
  buildConversationId,
  buildConversationList,
  markConversationRead,
  normalizeConversations,
} from "../utils/socialChat";

export function useDirectMessages({ user, setUser }) {
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [chatFeedback, setChatFeedback] = useState("");
  const [firebaseConversations, setFirebaseConversations] = useState({});
  const [presenceMap, setPresenceMap] = useState({});
  const [typingMap, setTypingMap] = useState({});
  const firebaseMessagingEnabled = isFirebaseMessagingRepositoryEnabled();

  const normalizedConversations = useMemo(() => {
    if (!user) {
      return {};
    }

    return firebaseMessagingEnabled ? firebaseConversations : normalizeConversations(user);
  }, [firebaseConversations, firebaseMessagingEnabled, user]);
  const allowedConversationPlates = useMemo(() => {
    const blockedPlates = new Set((user?.blockedDrivers ?? []).map((entry) => entry.plate));
    return new Set(
      (user?.friends ?? [])
        .map((entry) => entry.plate)
        .filter((plate) => !blockedPlates.has(plate)),
    );
  }, [user?.blockedDrivers, user?.friends]);
  const conversationList = useMemo(
    () => user
      ? buildConversationList({ ...user, conversations: normalizedConversations })
        .filter((conversation) => allowedConversationPlates.has(conversation.participantPlate))
      : [],
    [allowedConversationPlates, normalizedConversations, user],
  );
  const totalUnreadCount = useMemo(
    () => conversationList.reduce((sum, conversation) => sum + Number(conversation.unreadCount ?? 0), 0),
    [conversationList],
  );
  const trackedPresencePlates = useMemo(
    () =>
      Array.from(
        new Set([
          ...(user?.friends ?? []).map((entry) => entry.plate),
          ...conversationList.map((conversation) => conversation.participantPlate),
        ].filter(Boolean)),
      ),
    [conversationList, user?.friends],
  );

  useEffect(() => {
    const activeConversationIsVisible = conversationList.some(
      (conversation) => conversation.id === activeConversationId,
    );
    const nextConversationId = activeConversationIsVisible
      ? activeConversationId
      : conversationList[0]?.id ?? null;
    if (nextConversationId !== activeConversationId) {
      setActiveConversationId(nextConversationId);
    }
  }, [activeConversationId, conversationList]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    async function bindRealtimeThreads() {
      if (!firebaseMessagingEnabled || !user?.firebaseUid) {
        if (!cancelled) {
          setFirebaseConversations({});
        }
        return;
      }

      unsubscribe = await subscribeFirebaseDirectMessages((threads) => {
        if (!cancelled) {
          setFirebaseConversations(threads);
        }
      });
    }

    void bindRealtimeThreads();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [firebaseMessagingEnabled, user?.firebaseUid]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    async function bindPresence() {
      if (!firebaseMessagingEnabled) return;
      unsubscribe = await subscribeFirebasePresence(trackedPresencePlates, (presence) => {
        if (!cancelled) {
          setPresenceMap(presence);
        }
      });
    }

    void bindPresence();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [firebaseMessagingEnabled, trackedPresencePlates]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    async function bindTyping() {
      if (!firebaseMessagingEnabled || !activeConversationId) {
        if (!cancelled) {
          setTypingMap({});
        }
        return;
      }

      unsubscribe = await subscribeFirebaseTyping(activeConversationId, (typingState) => {
        if (!cancelled) {
          setTypingMap(typingState);
        }
      });
    }

    void bindTyping();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeConversationId, firebaseMessagingEnabled]);

  useEffect(() => {
    if (!firebaseMessagingEnabled || !user?.plate || !user?.firebaseUid) {
      return undefined;
    }

    let disconnectCleanup = () => {};
    let cancelled = false;
    const profile = { plate: user.plate };
    void initializeFirebasePresence(profile).then((cleanup) => {
      if (cancelled) cleanup();
      else disconnectCleanup = cleanup;
    });

    const handleVisibilityChange = () => {
      void saveFirebasePresenceState(profile, typeof document !== "undefined" && document.hidden ? "away" : "online");
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      cancelled = true;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      disconnectCleanup();
    };
  }, [firebaseMessagingEnabled, user?.firebaseUid, user?.plate]);

  const activeConversationCandidate = activeConversationId
    ? normalizedConversations[activeConversationId] ?? null
    : null;
  const activeConversation = activeConversationCandidate &&
    allowedConversationPlates.has(activeConversationCandidate.participantPlate)
    ? activeConversationCandidate
    : null;
  const activeTypingUsers = useMemo(
    () =>
      Object.values(typingMap ?? {}).filter(
        (entry) => entry?.plate && entry.plate !== user?.plate && entry.status === "typing",
      ),
    [typingMap, user?.plate],
  );

  useEffect(() => {
    if (!activeConversationId || !activeConversation) {
      return;
    }

    const lastForeignMessage = [...(activeConversation.messages ?? [])]
      .filter((message) => message.authorPlate !== user?.plate)
      .at(-1);

    if (!lastForeignMessage) {
      return;
    }

    if (Number(lastForeignMessage.createdAt ?? 0) <= Number(activeConversation.lastReadAt ?? 0)) {
      return;
    }

    if (firebaseMessagingEnabled) {
      void markFirebaseConversationRead(activeConversationId);
    } else {
      setUser((current) => markConversationRead(current, activeConversationId, Number(lastForeignMessage.createdAt ?? Date.now())));
    }
  }, [activeConversation, activeConversationId, firebaseMessagingEnabled, setUser, user?.plate]);

  useEffect(() => {
    if (!firebaseMessagingEnabled || !user?.plate || !activeConversationId) {
      return undefined;
    }

    const isTyping = Boolean(messageDraft.trim());
    const profile = { plate: user.plate };
    void saveFirebaseTypingState(activeConversationId, profile, isTyping ? "typing" : "idle");

    if (!isTyping) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void saveFirebaseTypingState(activeConversationId, profile, "idle");
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [activeConversationId, firebaseMessagingEnabled, messageDraft, user?.plate]);

  const openConversation = async (friend) => {
    if (!(user.friends ?? []).some((entry) => entry.plate === friend?.plate)) {
      setChatFeedback("Sohbet acmak icin once arkadas olmalisiniz.");
      return false;
    }
    const targetUserId = friend.userId ?? friend.id;
    let nextConversationId = buildConversationId(user.plate, friend.plate);
    if (firebaseMessagingEnabled) {
      if (!targetUserId) {
        setChatFeedback("Surucu kimligi bulunamadi.");
        return false;
      }
      try {
        const result = await ensureFirebaseDirectMessageThread(targetUserId);
        nextConversationId = result.threadId;
      } catch (error) {
        setChatFeedback(error instanceof Error ? error.message : "Sohbet acilamadi.");
        return false;
      }
    }
    setActiveConversationId(nextConversationId);
    if (!firebaseMessagingEnabled) setUser((current) => markConversationRead(current, nextConversationId));
    setChatFeedback(`${friend.fullName} ile sohbet hazir.`);
    return true;
  };

  const sendMessage = async (friend) => {
    if (!friend || !messageDraft.trim() || !user) {
      return false;
    }
    if (!(user.friends ?? []).some((entry) => entry.plate === friend.plate)) {
      setChatFeedback("Mesaj gondermek icin aktif arkadaslik gerekli.");
      return false;
    }

    const trimmedMessage = messageDraft.trim();
    const targetUserId = friend.userId ?? friend.id;
    const threadId = firebaseMessagingEnabled ? null : buildConversationId(user.plate, friend.plate);
    if (firebaseMessagingEnabled) {
      if (!targetUserId) {
        setChatFeedback("Surucu kimligi bulunamadi.");
        return false;
      }
      try {
        const result = await sendFirebaseDirectMessage(targetUserId, trimmedMessage);
        setActiveConversationId(result.threadId);
      } catch (error) {
        setChatFeedback(error instanceof Error ? error.message : "Mesaj gonderilemedi.");
        return false;
      }
    } else {
      setUser((current) => appendDirectMessage(current, friend, trimmedMessage));
    }
    setChatFeedback(`${friend.fullName} sohbetine yeni mesaj eklendi.`);
    setMessageDraft("");
    if (!firebaseMessagingEnabled) setActiveConversationId(threadId);
    return true;
  };

  return {
    activeConversation,
    activeConversationId,
    activeTypingUsers,
    chatFeedback,
    conversationList,
    messageDraft,
    openConversation,
    presenceMap,
    sendMessage,
    setMessageDraft,
    totalUnreadCount,
  };
}
