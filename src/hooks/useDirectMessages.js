import { useEffect, useMemo, useState } from "react";
import {
  saveFirebaseDirectMessage,
  saveFirebasePresence,
  subscribeFirebaseDirectMessages,
  subscribeFirebasePresence,
} from "../repositories/cruiserRepository";
import {
  appendDirectMessage,
  buildConversationId,
  buildConversationList,
  markConversationRead,
  mergeConversations,
  normalizeConversations,
} from "../utils/socialChat";

export function useDirectMessages({ user, setUser }) {
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [chatFeedback, setChatFeedback] = useState("");
  const [firebaseConversations, setFirebaseConversations] = useState({});
  const [presenceMap, setPresenceMap] = useState({});

  const normalizedConversations = useMemo(() => {
    if (!user) {
      return {};
    }

    return mergeConversations(normalizeConversations(user), firebaseConversations);
  }, [firebaseConversations, user]);
  const conversationList = useMemo(
    () => (user ? buildConversationList({ ...user, conversations: normalizedConversations }) : []),
    [normalizedConversations, user],
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
    if (!activeConversationId && conversationList.length) {
      setActiveConversationId(conversationList[0].id);
    }
  }, [activeConversationId, conversationList]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    async function bindRealtimeThreads() {
      if (!user?.plate) {
        if (!cancelled) {
          setFirebaseConversations({});
        }
        return;
      }

      unsubscribe = await subscribeFirebaseDirectMessages(user.plate, (threads) => {
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
  }, [user?.plate]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    async function bindPresence() {
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
  }, [trackedPresencePlates]);

  useEffect(() => {
    if (!user?.plate) {
      return undefined;
    }

    let heartbeatId = null;

    const publishPresence = (status) => {
      void saveFirebasePresence(user.plate, {
        status,
        lastSeen: Date.now(),
      });
    };

    const handleVisibilityChange = () => {
      publishPresence(typeof document !== "undefined" && document.hidden ? "away" : "online");
    };
    const handleBeforeUnload = () => {
      publishPresence("offline");
    };

    publishPresence(typeof document !== "undefined" && document.hidden ? "away" : "online");
    heartbeatId = window.setInterval(() => {
      publishPresence(typeof document !== "undefined" && document.hidden ? "away" : "online");
    }, 30000);

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (heartbeatId) {
        window.clearInterval(heartbeatId);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      window.removeEventListener("beforeunload", handleBeforeUnload);
      publishPresence("offline");
    };
  }, [user?.plate]);

  const activeConversation = activeConversationId ? normalizedConversations[activeConversationId] ?? null : null;

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

    setUser((current) => markConversationRead(current, activeConversationId, Number(lastForeignMessage.createdAt ?? Date.now())));
  }, [activeConversation, activeConversationId, setUser, user?.plate]);

  const openConversation = (friend) => {
    const nextConversationId = buildConversationId(user.plate, friend.plate);
    setActiveConversationId(nextConversationId);
    setUser((current) => markConversationRead(current, nextConversationId));
    setChatFeedback(`${friend.fullName} ile sohbet hazir.`);
  };

  const sendMessage = (friend) => {
    if (!friend || !messageDraft.trim() || !user) {
      return;
    }

    const trimmedMessage = messageDraft.trim();
    const threadId = buildConversationId(user.plate, friend.plate);
    const nextMessage = {
      id: `msg-${Date.now()}`,
      authorPlate: user.plate,
      authorName: user.fullName,
      body: trimmedMessage,
      createdAt: Date.now(),
    };

    setUser((current) => appendDirectMessage(current, friend, trimmedMessage));
    void saveFirebaseDirectMessage(
      threadId,
      [user.plate, friend.plate].sort((left, right) => left.localeCompare(right)),
      [
        {
          plate: user.plate,
          fullName: user.fullName,
          model: user.model,
          avatar: user.avatar ?? "",
        },
        {
          plate: friend.plate,
          fullName: friend.fullName,
          model: friend.model,
          avatar: friend.avatar ?? "",
        },
      ],
      nextMessage,
    );
    setChatFeedback(`${friend.fullName} sohbetine yeni mesaj eklendi.`);
    setMessageDraft("");
    setActiveConversationId(threadId);
  };

  return {
    activeConversation,
    activeConversationId,
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
