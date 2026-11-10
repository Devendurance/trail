import { cookies } from "next/headers";
import { SESSION_COOKIE, parseSessionToken, type SessionPayload } from "./auth";
import { getSessionSecret } from "./config";

export async function readSession(): Promise<SessionPayload | null> {
  const secret = getSessionSecret();
  if (!secret) return null;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return parseSessionToken(token, secret);
}

export function isSecureRequest(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  if (process.env.NODE_ENV === "production") return proto === "https";
  return false;
}
