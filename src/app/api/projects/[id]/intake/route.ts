import { NextResponse } from "next/server";

import { intakeSubmissionRequestSchema } from "@/features/intake/schema";
import {
  getProjectIntake,
  IntakeServiceError,
  submitProjectIntake,
} from "@/features/intake/service";
import { getAuthUserFromRequest } from "@/server/authorization";

function intakeErrorResponse(error: unknown) {
  if (error instanceof IntakeServiceError) {
    return NextResponse.json(
      { error: error.message, fieldErrors: error.fieldErrors },
      { status: error.status },
    );
  }

  throw error;
}

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
    return NextResponse.json({ data: await getProjectIntake(authUser, id) });
  } catch (error) {
    return intakeErrorResponse(error);
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const parsed = intakeSubmissionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Answers must be provided as an object." },
      { status: 400 },
    );
  }

  const { id } = await params;

  try {
    const result = await submitProjectIntake(authUser, id, parsed.data.answers);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
