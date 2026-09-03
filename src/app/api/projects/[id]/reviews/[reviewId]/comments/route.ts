import { NextResponse } from "next/server";
import { fileErrorResponse, readJson, zodFieldErrors } from "@/features/files/http";
import { commentSchema } from "@/features/reviews/schema";
import { addReviewComment } from "@/features/reviews/service";
import { getAuthUserFromRequest } from "@/server/authorization";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; reviewId: string }> }) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(request);
  if (!body.success) return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  const parsed = commentSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Write a comment before posting.", fieldErrors: zodFieldErrors(parsed.error) }, { status: 422 });
  const { id, reviewId } = await params;
  try { return NextResponse.json({ data: await addReviewComment(user, id, reviewId, parsed.data) }, { status: 201 }); } catch (error) { return fileErrorResponse(error); }
}
