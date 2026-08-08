import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./api-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("returns typed JSON for successful requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ value: 42 }), { status: 200 }),
      ),
    );
    await expect(apiFetch<{ value: number }>("/api/test")).resolves.toEqual({
      value: 42,
    });
  });

  it("throws structured errors with retry metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: "Slow down", code: "RATE_LIMITED" }),
          { status: 429, headers: { "Retry-After": "12" } },
        ),
      ),
    );
    await expect(apiFetch("/api/test")).rejects.toMatchObject({
      message: "Slow down",
      status: 429,
      code: "RATE_LIMITED",
      retryAfter: 12,
    } satisfies Partial<ApiError>);
  });

  it("runs the unauthorized handler once per request contract", async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Expired", code: "UNAUTHORIZED" }), {
          status: 401,
        }),
      ),
    );
    await expect(
      apiFetch("/api/test", undefined, { onUnauthorized }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("preserves abort errors without turning them into request failures", async () => {
    const aborted = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(aborted));
    await expect(apiFetch("/api/test")).rejects.toBe(aborted);
  });
});
