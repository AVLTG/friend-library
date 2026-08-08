import { describe, expect, it } from "vitest";
import { isSqliteUniqueConstraint } from "./errors";

describe("SQLite error inspection", () => {
  it("finds wrapped unique-constraint targets", () => {
    const cause = new Error("UNIQUE constraint failed: users.username");
    const wrapped = new Error("Failed query", { cause });
    expect(isSqliteUniqueConstraint(wrapped, ["users.username"])).toBe(true);
    expect(isSqliteUniqueConstraint(wrapped, ["books.isbn"])).toBe(false);
  });
});
