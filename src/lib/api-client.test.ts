import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, apiFetch } from "./api-client";

const responseSchema = z.object({ value: z.number() }).strict();

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
    await expect(apiFetch("/api/test", responseSchema)).resolves.toEqual({
      value: 42,
    });
  });

  it("rejects successful responses that do not match the required schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ value: "42" }), { status: 200 }),
      ),
    );

    await expect(apiFetch("/api/test", responseSchema)).rejects.toMatchObject({
      message: "The server returned an invalid response",
      status: 200,
      code: "INVALID_RESPONSE",
    } satisfies Partial<ApiError>);
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
    await expect(apiFetch("/api/test", responseSchema)).rejects.toMatchObject({
      message: "Slow down",
      status: 429,
      code: "RATE_LIMITED",
      retryAfter: 12,
    } satisfies Partial<ApiError>);
  });

  it("falls back safely when an error response does not match the contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 42, code: null }), { status: 500 }),
      ),
    );

    await expect(apiFetch("/api/test", responseSchema)).rejects.toMatchObject({
      message: "Request failed (500)",
      status: 500,
      code: "REQUEST_FAILED",
    } satisfies Partial<ApiError>);
  });

  it("falls back safely when an error response is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("upstream gateway failure", { status: 502 }),
      ),
    );

    await expect(apiFetch("/api/test", responseSchema)).rejects.toMatchObject({
      message: "Request failed (502)",
      status: 502,
      code: "REQUEST_FAILED",
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
      apiFetch("/api/test", responseSchema, undefined, { onUnauthorized }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("preserves abort errors without turning them into request failures", async () => {
    const aborted = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(aborted));
    await expect(apiFetch("/api/test", responseSchema)).rejects.toBe(aborted);
  });
});
