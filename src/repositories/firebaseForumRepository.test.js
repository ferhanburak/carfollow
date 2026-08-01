import { describe, expect, it } from "vitest";
import { buildForumState } from "./firebaseForumRepository";

describe("buildForumState", () => {
  it("sorts threads in memory and joins replies and viewer likes", () => {
    const threads = buildForumState({
      viewerUserId: "user-1",
      threads: [
        { id: "old", status: "active", createdAt: 100 },
        { id: "new", status: "active", createdAt: 200, pinnedReplyId: "reply-2" },
        { id: "hidden", status: "hidden", createdAt: 300 },
      ],
      replies: [
        { id: "reply-1", threadId: "new", body: "Yanıt", createdAt: 250 },
        { id: "reply-2", threadId: "new", body: "Çözüm", createdAt: 300 },
      ],
      likes: [
        { id: "like-1", threadId: "new", userId: "user-1" },
        { id: "like-2", threadId: "new", replyId: "reply-2", targetType: "reply", userId: "user-1" },
      ],
    });

    expect(threads.map((thread) => thread.id)).toEqual(["new", "old"]);
    expect(threads[0].likedByViewer).toBe(true);
    expect(threads[0].replies).toHaveLength(2);
    expect(threads[0].replies[0].id).toBe("reply-2");
    expect(threads[0].replies[0].likedByViewer).toBe(true);
  });
});
