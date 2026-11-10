import { NextResponse } from "next/server";
import { listSupportedProjects, VERIFICATION_LIMITS } from "@/lib/discovery";

export async function GET() {
  try {
    const items = await listSupportedProjects();
    return NextResponse.json({ projects: items, verificationLimits: VERIFICATION_LIMITS });
  } catch {
    return NextResponse.json({ error: { code: "VERIFIER_UNAVAILABLE", message: "Database unavailable." } }, { status: 503 });
  }
}
