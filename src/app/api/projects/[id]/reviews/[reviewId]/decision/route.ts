import { NextResponse } from "next/server";

import { fileErrorResponse, readJson, zodFieldErrors } from "@/features/files/http";
import { approvalSchema } from "@/features/reviews/schema";
import { decideReview } from "@/features/reviews/service";
import { getAuthUserFromRequest } from "@/server/authorization";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; reviewId: string }> }) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(request);
  if (!body.success) return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  const parsed = approvalSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Check the decision details.", fieldErrors: zodFieldErrors(parsed.error) }, { status: 422 });
  const { id, reviewId } = await params;
  try { return NextResponse.json({ data: await decideReview(user, id, reviewId, parsed.data) }); } catch (error) { return fileErrorResponse(error); }
}
