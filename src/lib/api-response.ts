import { NextResponse } from "next/server";
import { RequestBodyError } from "./validation";

export function apiError(
  code: string,
  message: string,
  status: number,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    { error: message, code },
    { status, headers },
  );
}

export function requestBodyErrorResponse(error: RequestBodyError) {
  return apiError(error.code, error.message, error.status);
}

export async function withApiErrorBoundary(
  operation: () => Promise<Response>,
  context: string,
  message = "Something went wrong",
): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    console.error(`${context}:`, error);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
