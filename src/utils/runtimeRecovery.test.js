import { describe, expect, it } from "vitest";
import { isStaleAssetError } from "./runtimeRecovery";

describe("runtimeRecovery", () => {
  it("recognizes stale deployment and lazy chunk failures", () => {
    expect(isStaleAssetError(new Error("ChunkLoadError: Loading chunk 42 failed"))).toBe(true);
    expect(isStaleAssetError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isStaleAssetError(new Error("Importing a module script failed"))).toBe(true);
  });

  it("does not classify ordinary application errors as stale assets", () => {
    expect(isStaleAssetError(new Error("Permission denied"))).toBe(false);
    expect(isStaleAssetError(null)).toBe(false);
  });
});
