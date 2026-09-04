import { NextResponse } from "next/server";

import { fileErrorResponse } from "@/features/files/http";
import { publishFinalDeliverable } from "@/features/files/service";
import { getAuthUserFromRequest } from "@/server/authorization";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id, fileId } = await params;
  try {
    return NextResponse.json({
      data: await publishFinalDeliverable(authUser, id, fileId),
    });
  } catch (error) {
    return fileErrorResponse(error);
  }
}
