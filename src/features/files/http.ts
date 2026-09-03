import { NextResponse } from "next/server";
import type { z } from "zod";

import { FileServiceError } from "@/features/files/service";

export function fileErrorResponse(error: unknown) {
  if (error instanceof FileServiceError) {
    return NextResponse.json(
      { error: error.message, fieldErrors: error.fieldErrors },
      { status: error.status },
    );
  }

  throw error;
}

export async function readJson(request: Request) {
  try {
    return { success: true as const, data: await request.json() };
  } catch {
    return { success: false as const };
  }
}

export function zodFieldErrors(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "request");
    fieldErrors[key] ??= issue.message;
  }

  return fieldErrors;
}
