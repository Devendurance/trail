import { NextResponse } from "next/server";
import { clearSessionCookieHeader } from "@/lib/auth";
import { isSecureRequest } from "@/lib/session";

export async function POST(req: Request) {
  const res = NextResponse.json({ authenticated: false });
  res.headers.set("Set-Cookie", clearSessionCookieHeader(isSecureRequest(req)));
  return res;
}
