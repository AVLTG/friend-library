import { describe, expect, it } from "vitest";
import { sanitizeName, sanitizeText, validateRating } from "./sanitize";

describe("input sanitizers", () => {
  it("strips markup, trims text, and applies length limits", () => {
    expect(sanitizeText("  <b>Hello</b> world  ", 8)).toBe("Hello wo");
    expect(sanitizeName("  Élodie <script>x</script> O'Neil  ")).toBe(
      "Élodie x O'Neil",
    );
  });
});

describe("validateRating", () => {
  it("accepts only numeric half-star ratings in range", () => {
    expect(validateRating(0.5)).toBe(0.5);
    expect(validateRating(4.5)).toBe(4.5);
    expect(validateRating(4.7)).toBeNull();
    expect(validateRating("4.5")).toBeNull();
    expect(validateRating(6)).toBeNull();
  });
});
