import { NextResponse } from "next/server";

import {
  fileErrorResponse,
  readJson,
  zodFieldErrors,
} from "@/features/files/http";
import { signUploadPartRequestSchema } from "@/features/files/schema";
import { signProjectUploadPart } from "@/features/files/service";
import { getAuthUserFromRequest } from "@/server/authorization";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; uploadId: string }> },
) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await readJson(request);
  if (!body.success) {
    return NextResponse.json(
      { error: "A JSON request body is required." },
      { status: 400 },
    );
  }
  const parsed = signUploadPartRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Choose a valid upload part.",
        fieldErrors: zodFieldErrors(parsed.error),
      },
      { status: 422 },
    );
  }

  const { id, uploadId } = await params;
  try {
    return NextResponse.json({
      data: await signProjectUploadPart(
        authUser,
        id,
        uploadId,
        parsed.data.partNumber,
      ),
    });
  } catch (error) {
    return fileErrorResponse(error);
  }
}
