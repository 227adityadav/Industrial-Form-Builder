import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function disabledResponse() {
  return NextResponse.json(
    { error: "Template flow is disabled. Rebuild in progress." },
    { status: 410 }
  );
}

export async function GET() {
  return disabledResponse();
}

export async function DELETE() {
  return disabledResponse();
}
