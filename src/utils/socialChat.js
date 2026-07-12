function sortMessages(messages) {
  return [...messages].sort((left, right) => Number(left.createdAt ?? 0) - Number(right.createdAt ?? 0));
}

export function buildConversationId(plateA, plateB) {
  return [plateA, plateB]
    .map((plate) => plate.replaceAll(" ", "_"))
    .sort((left, right) => left.localeCompare(right))
    .join("__");
}

export function normalizeConversations(user) {
  const conversations = user.conversations ?? {};
  return Object.fromEntries(
    Object.entries(conversations).map(([threadId, conversation]) => [
      threadId,
      {
        ...conversation,
        messages: sortMessages(conversation.messages ?? []),
      },
    ]),
  );
}

export function buildConversationList(user) {
  const normalizedConversations = normalizeConversations(user);
  return Object.values(normalizedConversations)
    .map((conversation) => {
      const lastMessage = [...(conversation.messages ?? [])].at(-1) ?? null;
      return {
        ...conversation,
        lastMessage,
      };
    })
    .sort((left, right) => Number(right.lastMessage?.createdAt ?? 0) - Number(left.lastMessage?.createdAt ?? 0));
}

export function mergeConversations(...conversationGroups) {
  const merged = {};

  conversationGroups
    .filter(Boolean)
    .forEach((conversationGroup) => {
      Object.entries(conversationGroup).forEach(([threadId, conversation]) => {
        const currentConversation = merged[threadId] ?? {
          ...conversation,
          messages: [],
        };

        merged[threadId] = {
          ...currentConversation,
          ...conversation,
          messages: sortMessages([
            ...(currentConversation.messages ?? []),
            ...(conversation.messages ?? []),
          ]).filter((message, index, messages) => {
            const firstIndex = messages.findIndex((entry) => entry.id === message.id);
            return firstIndex === index;
          }),
        };
      });
    });

  return merged;
}

export function appendDirectMessage(user, friend, messageText) {
  if (!user || !friend || !messageText.trim()) {
    return user;
  }

  const threadId = buildConversationId(user.plate, friend.plate);
  const normalizedConversations = normalizeConversations(user);
  const currentConversation = normalizedConversations[threadId] ?? {
    id: threadId,
    participantPlate: friend.plate,
    participantName: friend.fullName,
    participantModel: friend.model,
    participantAvatar: friend.avatar ?? "",
    messages: [],
  };

  const nextMessage = {
    id: `msg-${Date.now()}`,
    authorPlate: user.plate,
    authorName: user.fullName,
    body: messageText.trim(),
    createdAt: Date.now(),
  };

  return {
    ...user,
    conversations: {
      ...normalizedConversations,
      [threadId]: {
        ...currentConversation,
        messages: [...currentConversation.messages, nextMessage],
      },
    },
  };
}
