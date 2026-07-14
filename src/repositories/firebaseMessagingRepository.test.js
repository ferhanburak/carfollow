import { describe, expect, it } from "vitest";
import { normalizeFirebaseMessageThread } from "./firebaseMessagingRepository";

describe("firebaseMessagingRepository", () => {
  it("projects only participant threads and preserves read receipts", () => {
    const conversation = normalizeFirebaseMessageThread("a__b", {
      participantUids: { a: true, b: true },
      participantProfiles: {
        a: { userId: "a", plate: "06 A 06", fullName: "Driver A" },
        b: { userId: "b", plate: "34 B 34", fullName: "Driver B", model: "R6" },
      },
      messages: {
        second: { id: "second", senderUid: "b", authorPlate: "34 B 34", body: "2", createdAt: 20 },
        first: { id: "first", senderUid: "a", authorPlate: "06 A 06", body: "1", createdAt: 10 },
      },
      readBy: { a: 12 },
      updatedAt: 20,
    }, "a");
    expect(conversation.participantUserId).toBe("b");
    expect(conversation.participantPlate).toBe("34 B 34");
    expect(conversation.messages.map((message) => message.id)).toEqual(["first", "second"]);
    expect(conversation.lastReadAt).toBe(12);
  });

  it("rejects thread payloads that do not include the signed-in user", () => {
    expect(normalizeFirebaseMessageThread("a__b", { participantUids: { a: true, b: true } }, "stranger")).toBeNull();
  });
});
