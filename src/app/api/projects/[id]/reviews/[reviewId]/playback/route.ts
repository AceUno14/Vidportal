import { NextResponse } from "next/server";
import { fileErrorResponse } from "@/features/files/http";
import { getReviewPlayback } from "@/features/reviews/service";
import { getAuthUserFromRequest } from "@/server/authorization";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; reviewId: string }> }) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, reviewId } = await params;
  try { return NextResponse.json({ data: await getReviewPlayback(user, id, reviewId) }); } catch (error) { return fileErrorResponse(error); }
}
