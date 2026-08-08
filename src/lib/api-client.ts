"use client";

import type { ApiErrorBody } from "./api-types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly retryAfter: number | null = null,
  ) {
    super(message);
  }
}

type ApiFetchOptions = {
  redirectOnUnauthorized?: boolean;
  onUnauthorized?: () => void;
};

let redirectingToLogin = false;

function redirectToLogin() {
  if (typeof window === "undefined" || redirectingToLogin) return;
  redirectingToLogin = true;
  window.location.assign("/login");
}

export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: ApiFetchOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Unable to reach BookShare", 0, "NETWORK_ERROR");
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      if (response.ok) {
        throw new ApiError(
          "The server returned an invalid response",
          response.status,
          "INVALID_RESPONSE",
        );
      }
    }
  }

  if (!response.ok) {
    const errorBody = body as Partial<ApiErrorBody> | null;
    const message =
      typeof errorBody?.error === "string"
        ? errorBody.error
        : `Request failed (${response.status})`;
    const code =
      typeof errorBody?.code === "string" ? errorBody.code : "REQUEST_FAILED";
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : null;

    if (response.status === 401 && options.redirectOnUnauthorized !== false) {
      (options.onUnauthorized || redirectToLogin)();
    }
    throw new ApiError(
      message,
      response.status,
      code,
      Number.isFinite(retryAfter) ? retryAfter : null,
    );
  }

  return body as T;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
