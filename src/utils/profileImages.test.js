import { describe, expect, it } from "vitest";
import { MAX_PROFILE_IMAGE_BYTES, validateProfileImageFile } from "./profileImages";

describe("profile image validation", () => {
  it("accepts device image files below the storage limit", () => {
    expect(validateProfileImageFile(new File(["photo"], "garage.webp", { type: "image/webp" }))).toBe("");
  });

  it("rejects non-images and oversized files", () => {
    expect(validateProfileImageFile(new File(["text"], "profile.txt", { type: "text/plain" }))).toMatch(/gorsel/);
    expect(validateProfileImageFile({ name: "huge.jpg", type: "image/jpeg", size: MAX_PROFILE_IMAGE_BYTES })).toMatch(/5 MB/);
  });
});
