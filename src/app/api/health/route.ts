import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ service: "vidportal", status: "ok", timestamp: new Date().toISOString() });
}
