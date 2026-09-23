import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

interface CloudflareEnv {
  STATIONERY_KV?: {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string) => Promise<void>;
    list: (options?: { prefix?: string }) => Promise<{ keys: Array<{ name: string }> }>;
  };
}

function getKV(request: Request, env: unknown): CloudflareEnv["STATIONERY_KV"] | null {
  const g = globalThis as any;
  const req = request as any;
  const e = env as any;
  return (
    e?.STATIONERY_KV ||
    g.__env__?.STATIONERY_KV ||
    req?.runtime?.cloudflare?.env?.STATIONERY_KV ||
    g?.STATIONERY_KV ||
    null
  );
}

const CORS_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

async function handleApiRequest(request: Request, env: unknown): Promise<Response | null> {
  const url = new URL(request.url);
  const kv = getKV(request, env);


  // ─── Cloud DB (per-tenant read/write) ───────────────────────────────────────
  if (url.pathname === "/api/cloud-db") {
    if (request.method === "GET") {
      if (!kv) {
        const g = globalThis as any;
        const req = request as any;
        return json({
          ok: false,
          error: "KV storage not bound",
          debug: {
            hasGlobalEnv: !!g.__env__,
            globalEnvKeys: g.__env__ ? Object.keys(g.__env__) : [],
            hasReqRuntime: !!req.runtime,
            reqRuntimeCfKeys: req.runtime?.cloudflare ? Object.keys(req.runtime.cloudflare) : [],
            hasDirectKV: !!g.STATIONERY_KV,
          },
        });
      }
      const tenantId = url.searchParams.get("tenantId") || "tenant-abay";
      try {
        const data = await kv.get(`db:${tenantId}`);
        if (!data) return json({ ok: true, data: null });
        return json({ ok: true, data: JSON.parse(data) });
      } catch (err: any) {
        return json({ ok: false, error: err.message }, 500);
      }
    }

    if (request.method === "POST") {
      if (!kv) return json({ ok: false, error: "KV storage not bound" });
      try {
        const body = (await request.json()) as { tenantId: string; data: any };
        if (!body.tenantId || !body.data) {
          return json({ ok: false, error: "Missing tenantId or data" }, 400);
        }
        await kv.put(`db:${body.tenantId}`, JSON.stringify(body.data));

        // Update the tenant directory index so any device can find where users belong
        let dirStr = await kv.get("directory:tenants");
        let dir: Array<{ tenantId: string; name: string; users: string[]; plan?: string; approved?: boolean }> =
          dirStr ? JSON.parse(dirStr) : [];
        const existingIdx = dir.findIndex((d) => d.tenantId === body.tenantId);
        const userEmails = (body.data.users || []).map((u: any) => u.email.toLowerCase());
        const tenantRecord = body.data.tenants?.[0] || {};
        const tenantName = tenantRecord.name || body.tenantId;

        if (existingIdx >= 0) {
          dir[existingIdx] = {
            tenantId: body.tenantId,
            name: tenantName,
            users: userEmails,
            plan: tenantRecord.plan,
            approved: tenantRecord.approved,
          };
        } else {
          dir.push({
            tenantId: body.tenantId,
            name: tenantName,
            users: userEmails,
            plan: tenantRecord.plan,
            approved: tenantRecord.approved,
          });
        }
        await kv.put("directory:tenants", JSON.stringify(dir));

        return json({ ok: true, updated: true });
      } catch (err: any) {
        return json({ ok: false, error: err.message }, 500);
      }
    }
  }

  // ─── Find tenant by email ────────────────────────────────────────────────────
  if (url.pathname === "/api/find-tenant" && request.method === "GET") {
    const email = url.searchParams.get("email")?.toLowerCase().trim() || "";
    if (!kv) return json({ ok: false, error: "KV not bound" });
    try {
      const dirStr = await kv.get("directory:tenants");
      const dir: Array<{ tenantId: string; name: string; users: string[] }> = dirStr
        ? JSON.parse(dirStr)
        : [];
      const match = dir.find((d) => d.users.includes(email));
      return json({ ok: true, tenantId: match?.tenantId ?? null });
    } catch (err: any) {
      return json({ ok: false, error: err.message }, 500);
    }
  }

  // ─── Superadmin: list all organizations ─────────────────────────────────────
  if (url.pathname === "/api/superadmin/orgs" && request.method === "GET") {
    if (!kv) return json({ ok: false, error: "KV not bound" });
    try {
      const dirStr = await kv.get("directory:tenants");
      const dir = dirStr ? JSON.parse(dirStr) : [];
      return json({ ok: true, orgs: dir });
    } catch (err: any) {
      return json({ ok: false, error: err.message }, 500);
    }
  }

  // ─── Superadmin: update org plan/approval ───────────────────────────────────
  if (url.pathname === "/api/superadmin/orgs/update" && request.method === "POST") {
    if (!kv) return json({ ok: false, error: "KV not bound" });
    try {
      const body = (await request.json()) as {
        tenantId: string;
        plan?: string;
        approved?: boolean;
        expiresAt?: string | null;
      };
      if (!body.tenantId) return json({ ok: false, error: "Missing tenantId" }, 400);

      // Update the tenant's own DB record
      const dbStr = await kv.get(`db:${body.tenantId}`);
      if (dbStr) {
        const dbData = JSON.parse(dbStr);
        if (dbData.tenants?.[0]) {
          if (body.plan !== undefined) dbData.tenants[0].plan = body.plan;
          if (body.approved !== undefined) dbData.tenants[0].approved = body.approved;
          if (body.expiresAt !== undefined) dbData.tenants[0].expiresAt = body.expiresAt;
          await kv.put(`db:${body.tenantId}`, JSON.stringify(dbData));
        }
      }

      // Also update the directory index
      const dirStr = await kv.get("directory:tenants");
      let dir: any[] = dirStr ? JSON.parse(dirStr) : [];
      const idx = dir.findIndex((d: any) => d.tenantId === body.tenantId);
      if (idx >= 0) {
        if (body.plan !== undefined) dir[idx].plan = body.plan;
        if (body.approved !== undefined) dir[idx].approved = body.approved;
        if (body.expiresAt !== undefined) dir[idx].expiresAt = body.expiresAt;
        await kv.put("directory:tenants", JSON.stringify(dir));
      }

      return json({ ok: true });
    } catch (err: any) {
      return json({ ok: false, error: err.message }, 500);
    }
  }

  // ─── Superadmin: wipe/clean database in KV ──────────────────────────────────
  if (url.pathname === "/api/superadmin/clean-db" && request.method === "POST") {
    if (!kv) return json({ ok: false, error: "KV not bound" });
    try {
      const body = (await request.json()) as { tenantId: string; cleanData: any };
      if (!body.tenantId || !body.cleanData) return json({ ok: false, error: "Missing tenantId or cleanData" }, 400);
      await kv.put(`db:${body.tenantId}`, JSON.stringify(body.cleanData));
      return json({ ok: true, cleaned: true });
    } catch (err: any) {
      return json({ ok: false, error: err.message }, 500);
    }
  }

  return null;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const apiResponse = await handleApiRequest(request, env);
      if (apiResponse) return apiResponse;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
