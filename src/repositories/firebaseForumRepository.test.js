import { describe, expect, it } from "vitest";
import { buildForumState } from "./firebaseForumRepository";

describe("buildForumState", () => {
  it("sorts threads in memory and joins replies and viewer likes", () => {
    const threads = buildForumState({
      viewerUserId: "user-1",
      threads: [
        { id: "old", status: "active", createdAt: 100 },
        { id: "new", status: "active", createdAt: 200 },
        { id: "hidden", status: "hidden", createdAt: 300 },
      ],
      replies: [{ id: "reply-1", threadId: "new", body: "Yanit", createdAt: 250 }],
      likes: [{ id: "like-1", threadId: "new", userId: "user-1" }],
    });

    expect(threads.map((thread) => thread.id)).toEqual(["new", "old"]);
    expect(threads[0].likedByViewer).toBe(true);
    expect(threads[0].replies).toHaveLength(1);
  });
});
