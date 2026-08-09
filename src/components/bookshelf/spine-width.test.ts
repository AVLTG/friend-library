import { describe, expect, it } from "vitest";
import { getSpineWidth } from "./spine-width";

describe("getSpineWidth", () => {
  it("scales page counts within the spine width bounds", () => {
    expect(getSpineWidth(80)).toBe(28);
    expect(getSpineWidth(320)).toBe(40);
    expect(getSpineWidth(1_000)).toBe(55);
  });

  it("uses the minimum width when a page count is absent", () => {
    expect(getSpineWidth()).toBe(28);
    expect(getSpineWidth(null)).toBe(28);
  });
});
