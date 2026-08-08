import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authorizeCurrentUser } from "@/lib/authorization";
import { db } from "@/lib/db";
import { userBooks } from "@/lib/db/schema";
import { generatedIdSchema } from "@/lib/validation";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeCurrentUser();
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }

  const { id } = await params;
  if (!generatedIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid book ID" }, { status: 400 });
  }

  const deleted = await db
    .delete(userBooks)
    .where(
      and(
        eq(userBooks.userId, authorization.user.id),
        eq(userBooks.bookId, id),
      ),
    )
    .returning({ id: userBooks.id })
    .all();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
