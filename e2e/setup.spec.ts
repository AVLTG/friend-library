import { expect, request, test } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";

test("the first user can create the library", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByText("Set up your library")).toBeVisible();

  await page.getByPlaceholder("Jane", { exact: true }).fill("Test");
  await page.getByPlaceholder("Doe", { exact: true }).fill("User");
  await page.getByPlaceholder("janedoe", { exact: true }).fill("testuser");
  await page
    .getByPlaceholder("Min 10 chars, mixed case, number, symbol")
    .fill("TestPassword1!");

  await page.getByRole("button", { name: "Create Library" }).click();

  await expect(page.getByText("Welcome to BookShare!")).toBeVisible();
  await page.getByRole("button", { name: "Enter Your Library" }).click();
  await expect(
    page.getByRole("heading", { name: "Shared Library" }),
  ).toBeVisible();

  const addResponse = await page.request.post("/api/books", {
    headers: { Origin: baseURL },
    data: {
      title: "The Test Book",
      authors: ["Test Author"],
      pageCount: 240,
    },
  });
  expect(addResponse.ok()).toBe(true);
  const { bookId } = (await addResponse.json()) as { bookId: string };

  await page.goto(`/book/${bookId}`);
  await expect(
    page.getByRole("heading", { name: "The Test Book" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Currently reading" }).click();
  await expect(
    page.getByRole("button", { name: "Currently reading" }),
  ).toHaveClass(/bg-warm-700/);

  const usernameWithoutPassword = await page.request.patch(
    "/api/auth/account",
    {
      headers: { Origin: baseURL },
      data: { username: "renamed-user" },
    },
  );
  expect(usernameWithoutPassword.status()).toBe(400);

  const oldSession = (await page.context().cookies()).find(
    (cookie) => cookie.name === "session",
  );
  expect(oldSession).toBeTruthy();

  const passwordResponse = await page.request.patch("/api/auth/account", {
    headers: { Origin: baseURL },
    data: {
      currentPassword: "TestPassword1!",
      newPassword: "ChangedPassword2@",
    },
  });
  expect(passwordResponse.ok()).toBe(true);

  const oldSessionContext = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Cookie: `session=${oldSession?.value}`,
    },
  });
  const staleResponse = await oldSessionContext.get("/api/auth/account");
  expect(staleResponse.status()).toBe(401);
  expect(staleResponse.headers()["set-cookie"]).toContain("session=");
  await oldSessionContext.dispose();
});
