import { NextResponse } from "next/server";
import { getRankings } from "@/lib/discovery";

export async function GET() {
  try {
    return NextResponse.json(await getRankings());
  } catch {
    return NextResponse.json({ error: { code: "VERIFIER_UNAVAILABLE", message: "Database unavailable." } }, { status: 503 });
  }
}
