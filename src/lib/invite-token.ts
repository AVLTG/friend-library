import { generateId, generateInviteToken } from "./auth";
import { db } from "./db";
import { inviteTokens } from "./db/schema";
import { withSqliteBusyRetry } from "./db/transaction";

const MAX_TOKEN_ATTEMPTS = 4;

export class InviteTokenGenerationError extends Error {}

function isTokenCollision(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const code =
      "code" in current
        ? (current as Error & { code?: string }).code
        : undefined;
    if (
      (code === "SQLITE_CONSTRAINT" || code === "SQLITE_CONSTRAINT_UNIQUE") &&
      /invite_tokens(?:\.token|_token_unique)/i.test(current.message)
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

export async function createInviteForUser(
  createdBy: string,
  generateToken: () => string = generateInviteToken,
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt += 1) {
    const token = generateToken();
    try {
      await withSqliteBusyRetry(() =>
        db.insert(inviteTokens).values({
          id: generateId(),
          token,
          createdBy,
          expiresAt,
        }),
      );
      return { token, expiresAt };
    } catch (error) {
      if (!isTokenCollision(error)) throw error;
    }
  }

  throw new InviteTokenGenerationError("Could not generate a unique invite token");
}
