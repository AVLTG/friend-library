import { describe, expect, it } from "vitest";
import { sanitizeName, sanitizeText } from "./sanitize";

describe("input sanitizers", () => {
  it("strips markup, trims text, and applies length limits", () => {
    expect(sanitizeText("  <b>Hello</b> world  ", 8)).toBe("Hello wo");
    expect(sanitizeName("  Élodie <script>x</script> O'Neil  ")).toBe(
      "Élodie x O'Neil",
    );
  });
});
