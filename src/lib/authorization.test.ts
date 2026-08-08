// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("./auth", () => ({ getSession: mocks.getSession }));
vi.mock("./db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ get: mocks.getUser })),
      })),
    })),
  },
}));

import { authorizeCurrentUser } from "./authorization";

describe("authorizeCurrentUser", () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.getUser.mockReset();
  });

  it("returns 401 without a valid session", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(authorizeCurrentUser()).resolves.toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("returns 401 when the session user no longer exists", async () => {
    mocks.getSession.mockResolvedValue({ userId: "user-1" });
    mocks.getUser.mockResolvedValue(undefined);

    await expect(authorizeCurrentUser()).resolves.toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("returns 403 when a member requests an admin operation", async () => {
    mocks.getSession.mockResolvedValue({ userId: "user-1" });
    mocks.getUser.mockResolvedValue({
      id: "user-1",
      username: "member",
      role: "member",
    });

    await expect(authorizeCurrentUser("admin")).resolves.toEqual({
      ok: false,
      status: 403,
      error: "Forbidden",
    });
  });

  it("uses the current database role on every authorization", async () => {
    mocks.getSession.mockResolvedValue({ userId: "user-1" });
    mocks.getUser
      .mockResolvedValueOnce({ id: "user-1", username: "user", role: "member" })
      .mockResolvedValueOnce({ id: "user-1", username: "user", role: "admin" });

    await expect(authorizeCurrentUser("admin")).resolves.toMatchObject({
      ok: false,
      status: 403,
    });
    await expect(authorizeCurrentUser("admin")).resolves.toMatchObject({
      ok: true,
      user: { role: "admin" },
    });
  });
});
