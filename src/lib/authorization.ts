import { eq } from "drizzle-orm";
import { getSession } from "./auth";
import { db } from "./db";
import { users, type UserRole } from "./db/schema";

interface AuthorizedUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarColor: string;
  role: UserRole;
}

export type AuthorizationResult =
  | { ok: true; user: AuthorizedUser }
  | { ok: false; status: 401 | 403; error: "Unauthorized" | "Forbidden" };

export async function authorizeCurrentUser(
  requiredRole?: UserRole,
): Promise<AuthorizationResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const user = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarColor: users.avatarColor,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .get();

  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  if (requiredRole && user.role !== requiredRole) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, user };
}
