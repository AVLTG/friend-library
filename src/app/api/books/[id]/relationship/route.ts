import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authorizeCurrentUser } from "@/lib/authorization";
import { userBooks } from "@/lib/db/schema";
import { generatedIdSchema } from "@/lib/validation";
import { apiError, withApiErrorBoundary } from "@/lib/api-response";
import { maintenanceTransaction } from "@/lib/db/maintenance-write";
import { withSqliteBusyRetry } from "@/lib/db/transaction";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiErrorBoundary(async () => {
  const authorization = await authorizeCurrentUser();
  if (!authorization.ok) {
    return apiError(
      authorization.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      authorization.error,
      authorization.status,
    );
  }

  const { id } = await params;
  if (!generatedIdSchema.safeParse(id).success) {
    return apiError("INVALID_BOOK_ID", "Invalid book ID", 400);
  }

  const deleted = await withSqliteBusyRetry(() =>
    maintenanceTransaction((tx) =>
      tx
        .delete(userBooks)
        .where(
          and(
            eq(userBooks.userId, authorization.user.id),
            eq(userBooks.bookId, id),
          ),
        )
        .returning({ id: userBooks.id })
        .all(),
    ),
  );

  if (deleted.length === 0) {
    return apiError("RELATIONSHIP_NOT_FOUND", "Relationship not found", 404);
  }

    return NextResponse.json({ success: true });
  }, "Remove relationship error", "Failed to remove book activity");
}
