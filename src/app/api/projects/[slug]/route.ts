import { NextResponse } from "next/server";
import { getProjectFeed } from "@/lib/discovery";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const feed = await getProjectFeed(slug);
    if (!feed) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found." } }, { status: 404 });
    return NextResponse.json(feed);
  } catch {
    return NextResponse.json({ error: { code: "VERIFIER_UNAVAILABLE", message: "Database unavailable." } }, { status: 503 });
  }
}
