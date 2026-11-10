import { NextResponse } from "next/server";
import { getPublishedReview } from "@/lib/discovery";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const num = Number(id);
    if (!Number.isInteger(num) || num <= 0) {
      return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Review id required." } }, { status: 400 });
    }
    const found = await getPublishedReview(num);
    if (!found) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Published review not found." } }, { status: 404 });
    return NextResponse.json(found);
  } catch {
    return NextResponse.json({ error: { code: "VERIFIER_UNAVAILABLE", message: "Database unavailable." } }, { status: 503 });
  }
}
