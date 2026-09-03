import { NextResponse } from "next/server";

import {
  fileErrorResponse,
  readJson,
  zodFieldErrors,
} from "@/features/files/http";
import { initiateUploadRequestSchema } from "@/features/files/schema";
import {
  initiateProjectUpload,
  listProjectFiles,
} from "@/features/files/service";
import { getAuthUserFromRequest } from "@/server/authorization";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    return NextResponse.json({ data: await listProjectFiles(authUser, id) });
  } catch (error) {
    return fileErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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
  const parsed = initiateUploadRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Check the selected file and transfer details.",
        fieldErrors: zodFieldErrors(parsed.error),
      },
      { status: 422 },
    );
  }

  const { id } = await params;
  try {
    return NextResponse.json(
      { data: await initiateProjectUpload(authUser, id, parsed.data) },
      { status: 201 },
    );
  } catch (error) {
    return fileErrorResponse(error);
  }
}
