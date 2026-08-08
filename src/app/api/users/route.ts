import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { apiError, withApiErrorBoundary } from "@/lib/api-response";

export async function GET() {
  return withApiErrorBoundary(async () => {
  const session = await getSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const allUsers = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarColor: users.avatarColor,
    })
    .from(users)
    .all();

    return NextResponse.json(allUsers);
  }, "List users error", "Failed to load users");
}
