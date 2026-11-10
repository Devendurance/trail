export interface ApiOk<T> {
  ok: true;
  status: number;
  data: T;
}
export interface ApiErr {
  ok: false;
  status: number;
  code: string;
  message: string;
}
export type ApiResult<T> = ApiOk<T> | ApiErr;

/// JSON fetch with timeout. Never throws. Maps network failures to NETWORK.
export async function api<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<ApiResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 20_000);
  try {
    const res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!json) return { ok: false, status: res.status, code: "BAD_RESPONSE", message: "Unreadable response." };
    if (!res.ok && "error" in json) {
      const e = json.error as { code?: string; message?: string };
      return { ok: false, status: res.status, code: e.code ?? "ERROR", message: e.message ?? "Request failed." };
    }
    return { ok: true, status: res.status, data: json as T };
  } catch {
    return { ok: false, status: 0, code: "NETWORK", message: "Could not reach Trail." };
  } finally {
    clearTimeout(timer);
  }
}

export const postJson = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
