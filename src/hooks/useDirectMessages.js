import { useEffect, useMemo, useState } from "react";
import { saveFirebaseDirectMessage, subscribeFirebaseDirectMessages } from "../repositories/cruiserRepository";
import {
  appendDirectMessage,
  buildConversationId,
  buildConversationList,
  mergeConversations,
  normalizeConversations,
} from "../utils/socialChat";

export function useDirectMessages({ user, setUser }) {
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [chatFeedback, setChatFeedback] = useState("");
  const [firebaseConversations, setFirebaseConversations] = useState({});

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

  const activeConversation = activeConversationId ? normalizedConversations[activeConversationId] ?? null : null;

  const openConversation = (friend) => {
    const nextConversationId = buildConversationId(user.plate, friend.plate);
    setActiveConversationId(nextConversationId);
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
    sendMessage,
    setMessageDraft,
  };
}
