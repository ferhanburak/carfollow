import { useEffect, useMemo, useState } from "react";
import { appendDirectMessage, buildConversationId, buildConversationList, normalizeConversations } from "../utils/socialChat";

export function useDirectMessages({ user, setUser }) {
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [chatFeedback, setChatFeedback] = useState("");

  const conversationList = useMemo(() => (user ? buildConversationList(user) : []), [user]);
  const normalizedConversations = useMemo(() => (user ? normalizeConversations(user) : {}), [user]);

  useEffect(() => {
    if (!activeConversationId && conversationList.length) {
      setActiveConversationId(conversationList[0].id);
    }
  }, [activeConversationId, conversationList]);

  const activeConversation = activeConversationId ? normalizedConversations[activeConversationId] ?? null : null;

  const openConversation = (friend) => {
    const nextConversationId = buildConversationId(user.plate, friend.plate);
    setActiveConversationId(nextConversationId);
    setChatFeedback(`${friend.fullName} ile sohbet hazir.`);
  };

  const sendMessage = (friend) => {
    if (!friend || !messageDraft.trim()) {
      return;
    }

    setUser((current) => appendDirectMessage(current, friend, messageDraft));
    setChatFeedback(`${friend.fullName} sohbetine yeni mesaj eklendi.`);
    setMessageDraft("");
    setActiveConversationId(buildConversationId(user.plate, friend.plate));
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
