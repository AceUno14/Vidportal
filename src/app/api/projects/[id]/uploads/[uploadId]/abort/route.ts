import { NextResponse } from "next/server";

import { fileErrorResponse } from "@/features/files/http";
import { abortProjectUpload } from "@/features/files/service";
import { getAuthUserFromRequest } from "@/server/authorization";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; uploadId: string }> },
) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id, uploadId } = await params;
  try {
    return NextResponse.json({
      data: await abortProjectUpload(authUser, id, uploadId),
    });
  } catch (error) {
    return fileErrorResponse(error);
  }
}
