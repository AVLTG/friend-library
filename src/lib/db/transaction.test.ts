import { describe, expect, it, vi } from "vitest";
import { withSqliteBusyRetry } from "./transaction";

describe("SQLite transaction retry", () => {
  it("retries lock contention and returns the eventual result", async () => {
    const busy = Object.assign(new Error("database is locked"), {
      code: "SQLITE_BUSY",
    });
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(busy)
      .mockRejectedValueOnce(busy)
      .mockResolvedValue("completed");

    await expect(withSqliteBusyRetry(operation)).resolves.toBe("completed");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry unrelated errors", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("failure"));

    await expect(withSqliteBusyRetry(operation)).rejects.toThrow("failure");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
