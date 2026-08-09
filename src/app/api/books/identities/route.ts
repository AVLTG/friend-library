import { NextResponse } from "next/server";
import { apiError, withApiErrorBoundary } from "@/lib/api-response";
import { getSession } from "@/lib/auth";
import { readBookIdentities } from "@/lib/book-read";

export async function GET() {
  return withApiErrorBoundary(async () => {
    const session = await getSession();
    if (!session) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    return NextResponse.json(await readBookIdentities());
  }, "List book identities error", "Failed to load library identities");
}
