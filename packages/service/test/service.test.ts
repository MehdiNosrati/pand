import { describe, expect, it } from "vitest";
import {
  PandError,
  createRoute,
  createServiceApp,
  createServiceClient,
  requireAdmin,
  requireAuth,
  requirePublic,
  signInternalToken,
  z,
} from "../src/index.js";

describe("@pand/service", () => {
  it("exposes /healthz, /readyz, /openapi.json, and /_pand/meta with standard auth & error envelopes", async () => {
    const app = createServiceApp({
      name: "core",
      dbHealth: async () => "ok",
    });

    app.registerAdminEntity({
      service: "core",
      entity: "Task",
      table: "tasks",
      basePath: "/api/v1/core/tasks",
      primaryKey: "id",
      displayField: "title",
      fields: [
        { name: "id", label: "ID", type: "uuid", required: true, readOnly: true },
        { name: "title", label: "Title", type: "string", required: true, readOnly: false },
      ],
    });

    const createTaskRoute = createRoute({
      method: "post",
      path: "/tasks",
      middleware: [requireAuth()] as const,
      request: {
        body: {
          content: {
            "application/json": {
              schema: z.object({
                title: z.string().min(3),
              }),
            },
          },
        },
      },
      responses: {
        201: {
          description: "Created task",
          content: {
            "application/json": {
              schema: z.object({
                id: z.string(),
                title: z.string(),
                ownerId: z.string(),
              }),
            },
          },
        },
      },
    });

    app.openapi(createTaskRoute, (c) => {
      const body = c.req.valid("json");
      const actor = c.get("actor");
      return c.json(
        {
          id: "task-1",
          title: body.title,
          ownerId: actor?.sub ?? "none",
        },
        201,
      );
    });

    app.get("/admin-only", requireAdmin(), (c) => c.json({ secret: true }));
    app.get("/public-ping", requirePublic(), (c) => c.json({ pong: true }));
    app.get("/boom", () => {
      throw PandError.conflict("Already exists", { field: "title" });
    });

    // 1. /healthz & /readyz
    const healthRes = await app.request("/healthz");
    expect(healthRes.status).toBe(200);
    expect(await healthRes.json()).toEqual({
      status: "ok",
      service: "core",
      version: "0.1.0",
    });

    const readyRes = await app.request("/readyz");
    expect(readyRes.status).toBe(200);
    expect(await readyRes.json()).toEqual({
      status: "ready",
      service: "core",
      checks: { db: "ok" },
    });

    // 2. Public route works without token
    const pubRes = await app.request("/public-ping");
    expect(pubRes.status).toBe(200);

    // 3. Auth route rejects missing token with 401 ErrorEnvelope
    const unauthRes = await app.request("/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Buy milk" }),
    });
    expect(unauthRes.status).toBe(401);
    const unauthBody = (await unauthRes.json()) as any;
    expect(unauthBody.error.code).toBe("UNAUTHORIZED");

    // 4. Auth route validates input with 400 VALIDATION_ERROR
    const userToken = await signInternalToken({
      sub: "user-123",
      authenticated: true,
      email: "user@mahdins.dev",
      role: "user",
      caller: "gateway",
      reqId: "req-1",
    });

    const invalidRes = await app.request("/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pand-internal-token": userToken,
      },
      body: JSON.stringify({ title: "ab" }),
    });
    expect(invalidRes.status).toBe(400);
    const invalidBody = (await invalidRes.json()) as any;
    expect(invalidBody.error.code).toBe("VALIDATION_ERROR");

    // 5. Valid auth route succeeds
    const validRes = await app.request("/tasks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pand-internal-token": userToken,
      },
      body: JSON.stringify({ title: "Buy milk" }),
    });
    expect(validRes.status).toBe(201);
    expect(await validRes.json()).toEqual({
      id: "task-1",
      title: "Buy milk",
      ownerId: "user-123",
    });

    // 6. Admin route rejects regular user with 403, accepts admin user
    const forbiddenRes = await app.request("/admin-only", {
      headers: { "x-pand-internal-token": userToken },
    });
    expect(forbiddenRes.status).toBe(403);

    const adminToken = await signInternalToken({
      sub: "admin-1",
      authenticated: true,
      email: "admin@mahdins.dev",
      role: "admin",
      caller: "gateway",
      reqId: "req-2",
    });
    const adminRes = await app.request("/admin-only", {
      headers: { "x-pand-internal-token": adminToken },
    });
    expect(adminRes.status).toBe(200);

    // 7. PandError formatting
    const conflictRes = await app.request("/boom");
    expect(conflictRes.status).toBe(409);
    const conflictBody = (await conflictRes.json()) as any;
    expect(conflictBody.error.code).toBe("CONFLICT");
    expect(conflictBody.error.details).toEqual({ field: "title" });

    // 8. /openapi.json and /_pand/meta
    const openApiRes = await app.request("/openapi.json");
    expect(openApiRes.status).toBe(200);
    const spec = (await openApiRes.json()) as any;
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/tasks"]).toBeDefined();

    const metaRes = await app.request("/_pand/meta", {
      headers: { "x-pand-internal-token": userToken },
    });
    expect(metaRes.status).toBe(200);
    const meta = (await metaRes.json()) as any;
    expect(meta).toHaveLength(1);
    expect(meta[0].entity).toBe("Task");

    // 9. Service-to-service client
    const client = createServiceClient("core", {
      callerService: "billing",
      baseUrl: "http://core.internal",
      customFetch: async (input, init) => {
        const url = new URL(typeof input === "string" ? input : input.toString());
        return app.request(url.pathname + url.search, init);
      },
    });
    const createdViaS2S = await client.request<{ id: string; ownerId: string }>("/tasks", {
      method: "POST",
      body: JSON.stringify({ title: "From billing" }),
    });
    expect(createdViaS2S.ownerId).toBe("service:billing");
  });
});
