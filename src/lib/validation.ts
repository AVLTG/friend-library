import { z } from "zod";

const username = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_-]+$/);
const password = z.string().min(1).max(128);
const strongPassword = z.string().min(10).max(128);
const name = z.string().min(1).max(100);

export const loginSchema = z
  .object({ username, password })
  .strict();

export const registrationSchema = z
  .object({
    username,
    firstName: name,
    lastName: name,
    password: strongPassword,
    inviteToken: z.string().length(8),
  })
  .strict();

export const setupSchema = registrationSchema.omit({ inviteToken: true }).strict();

export const accountUpdateSchema = z
  .object({
    firstName: name.optional(),
    lastName: name.optional(),
    username: username.optional(),
    currentPassword: password.optional(),
    newPassword: strongPassword.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "No changes provided")
  .refine(
    (value) => !value.newPassword || Boolean(value.currentPassword),
    "Current password is required to set a new password",
  )
  .refine(
    (value) =>
      !value.currentPassword || Boolean(value.newPassword || value.username),
    "Current password must accompany a username or password change",
  );

export function isApprovedCoverUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1000) return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      ((url.hostname === "books.google.com" &&
        url.pathname === "/books/content") ||
        (url.hostname === "covers.openlibrary.org" &&
          /^\/b\/isbn\/[^/]+-(S|M|L)\.jpg$/.test(url.pathname)))
    );
  } catch {
    return false;
  }
}

export function safeCoverUrl(value: unknown): string | null {
  return isApprovedCoverUrl(value) ? value : null;
}

const optionalString = (max: number) => z.string().max(max).optional();

export const addBookSchema = z
  .object({
    title: z.string().min(1).max(500),
    authors: z.array(z.string().min(1).max(200)).min(1).max(20),
    isbn: optionalString(20),
    description: optionalString(5000),
    coverUrl: z.string().refine(isApprovedCoverUrl).optional(),
    pageCount: z.number().int().min(1).max(99999).optional(),
    publishedDate: optionalString(20),
    categories: z.array(z.string().min(1).max(100)).max(50).optional(),
    googleBooksId: optionalString(50),
  })
  .strict();

const rating = z
  .number()
  .min(0.5)
  .max(5)
  .refine((value) => Number.isInteger(value * 2), "Rating must use half-star increments");

export const updateBookSchema = z
  .object({
    owned: z.boolean().optional(),
    read: z.boolean().optional(),
    currentlyReading: z.boolean().optional(),
    annotated: z.boolean().optional(),
    rating: rating.nullable().optional(),
    review: z.string().max(5000).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "No changes provided")
  .refine(
    (value) => !(value.read === true && value.currentlyReading === true),
    "A book cannot be read and currently reading at the same time",
  );

export const generatedIdSchema = z.string().regex(/^[A-Za-z0-9]{21}$/);

export const searchQuerySchema = z
  .object({ q: z.string().trim().min(2).max(200) })
  .strict();

export type LoginRequestBody = z.infer<typeof loginSchema>;
export type RegistrationRequestBody = z.infer<typeof registrationSchema>;
export type SetupRequestBody = z.infer<typeof setupSchema>;
export type AccountUpdateRequestBody = z.infer<typeof accountUpdateSchema>;
export type AddBookRequestBody = z.infer<typeof addBookSchema>;
export type UpdateBookRequestBody = z.infer<typeof updateBookSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export class RequestBodyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code =
      status === 413
        ? "BODY_TOO_LARGE"
        : status === 415
          ? "UNSUPPORTED_MEDIA_TYPE"
          : "INVALID_REQUEST",
  ) {
    super(message);
  }
}

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = 16_384,
): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  if (contentType !== "application/json") {
    throw new RequestBodyError("Content-Type must be application/json", 415);
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) {
    throw new RequestBodyError("Request body is too large", 413);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new RequestBodyError("Request body is too large", 413);
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new RequestBodyError("Malformed JSON body", 400);
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    const message = result.error.issues[0]?.message || "Invalid request body";
    throw new RequestBodyError(
      message,
      400,
      message === "A book cannot be read and currently reading at the same time"
        ? "INVALID_READING_STATE"
        : "INVALID_REQUEST",
    );
  }

  return result.data;
}
