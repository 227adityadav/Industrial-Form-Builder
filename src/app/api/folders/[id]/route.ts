import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE() {
  return NextResponse.json(
    { error: "Folder flow is disabled. Rebuild in progress." },
    { status: 410 }
  );
}
