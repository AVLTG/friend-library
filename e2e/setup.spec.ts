import { expect, request, test } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";

test("the first user can create the library", async ({ page, browser }) => {
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
  const inviteToken = (await page.locator("code").textContent())?.trim();
  expect(inviteToken).toMatch(/^[A-Z0-9]{8}$/);
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

  const registrationContexts = await Promise.all([
    request.newContext({ baseURL }),
    request.newContext({ baseURL }),
  ]);
  const registrationResponses = await Promise.all(
    registrationContexts.map((context, index) =>
      context.post("/api/auth/register", {
        headers: { Origin: baseURL },
        data: {
          username: `friend-${index}`,
          firstName: "Friend",
          lastName: index === 0 ? "Zero" : "One",
          password: "FriendPassword3#",
          inviteToken,
        },
      }),
    ),
  );
  expect(registrationResponses.map((response) => response.status()).sort()).toEqual([
    200, 400,
  ]);
  const rejectedRegistration = registrationResponses.find(
    (response) => response.status() === 400,
  );
  expect(rejectedRegistration).toBeDefined();
  expect(await rejectedRegistration!.json()).toMatchObject({
    error: expect.stringMatching(/already used|Invalid/),
  });
  const usersResponse = await page.request.get("/api/users");
  expect(usersResponse.ok()).toBe(true);
  expect(await usersResponse.json()).toHaveLength(2);

  const successfulRegistrationIndex = registrationResponses.findIndex(
    (response) => response.status() === 200,
  );
  const memberApi = registrationContexts[successfulRegistrationIndex];
  const relationshipResponses = await Promise.all([
    memberApi.patch(`/api/books/${bookId}`, {
      headers: { Origin: baseURL },
      data: { owned: true, read: true },
    }),
    memberApi.patch(`/api/books/${bookId}`, {
      headers: { Origin: baseURL },
      data: { annotated: true, currentlyReading: true },
    }),
  ]);
  expect(relationshipResponses.every((response) => response.ok())).toBe(true);
  const memberBookAfterConcurrentWrites = (await (
    await memberApi.get(`/api/books/${bookId}`)
  ).json()) as {
    currentUserBook: {
      owned: boolean;
      read: boolean;
      currentlyReading: boolean;
      annotated: boolean;
    };
  };
  expect(memberBookAfterConcurrentWrites.currentUserBook).toMatchObject({
    owned: true,
    annotated: true,
  });
  expect(
    Number(memberBookAfterConcurrentWrites.currentUserBook.read) +
      Number(memberBookAfterConcurrentWrites.currentUserBook.currentlyReading),
  ).toBe(1);

  const forbiddenDelete = await memberApi.delete(`/api/books/${bookId}`, {
    headers: { Origin: baseURL },
  });
  expect(forbiddenDelete.status()).toBe(403);

  const memberContext = await browser.newContext({
    storageState: await memberApi.storageState(),
  });
  const memberPage = await memberContext.newPage();
  await memberPage.goto(`/book/${bookId}`);
  await expect(
    memberPage.getByRole("button", { name: "Remove my activity" }),
  ).toBeVisible();
  await expect(
    memberPage.getByRole("button", { name: "Delete from shared library" }),
  ).toHaveCount(0);
  await memberPage.getByRole("button", { name: "Remove my activity" }).click();
  await memberPage
    .getByRole("button", { name: "Remove my activity", exact: true })
    .last()
    .click();
  await expect(
    memberPage.getByRole("button", { name: "Remove my activity" }),
  ).toHaveCount(0);
  await memberContext.close();

  await page.reload();
  await expect(page.getByRole("heading", { name: "The Test Book" })).toBeVisible();
  const adminBookAfterMemberRemoval = (await (
    await page.request.get(`/api/books/${bookId}`)
  ).json()) as {
    currentUserBook: { currentlyReading: boolean } | null;
  };
  expect(adminBookAfterMemberRemoval.currentUserBook).toMatchObject({
    currentlyReading: true,
  });
  await expect(
    page.getByRole("button", { name: "Delete from shared library" }),
  ).toBeVisible();
  const deleteResponse = await page.request.delete(`/api/books/${bookId}`, {
    headers: { Origin: baseURL },
  });
  expect(deleteResponse.ok()).toBe(true);
  expect((await page.request.get(`/api/books/${bookId}`)).status()).toBe(404);

  await Promise.all(registrationContexts.map((context) => context.dispose()));
});
