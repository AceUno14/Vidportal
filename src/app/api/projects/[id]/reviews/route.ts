import { NextResponse } from "next/server";

import { fileErrorResponse, readJson, zodFieldErrors } from "@/features/files/http";
import { createReviewSchema } from "@/features/reviews/schema";
import { createProjectReview, listProjectReviews } from "@/features/reviews/service";
import { getAuthUserFromRequest } from "@/server/authorization";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { return NextResponse.json({ data: await listProjectReviews(user, (await params).id) }); } catch (error) { return fileErrorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(request);
  if (!body.success) return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  const parsed = createReviewSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Choose a ready video file.", fieldErrors: zodFieldErrors(parsed.error) }, { status: 422 });
  try { return NextResponse.json({ data: await createProjectReview(user, (await params).id, parsed.data) }, { status: 201 }); } catch (error) { return fileErrorResponse(error); }
}
