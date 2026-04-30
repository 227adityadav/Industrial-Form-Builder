import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "Submission flow is disabled. Rebuild in progress." },
    { status: 410 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Submission flow is disabled. Rebuild in progress." },
    { status: 410 }
  );
}
