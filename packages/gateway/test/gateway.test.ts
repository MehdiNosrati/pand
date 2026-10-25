import { defineConfig } from "@pands/config";
import { createRoute, createServiceApp, requireAuth, z } from "@pands/service";
import { describe, expect, it } from "vitest";
import { createGatewayApp, mergeServiceOpenApiSpecs } from "../src/index.js";

describe("@pands/gateway", () => {
  it("merges service OpenAPI specs and handles schema collisions", () => {
    const merged = mergeServiceOpenApiSpecs(
      [
        {
          service: "core",
          spec: {
            paths: {
              "/tasks": { get: { summary: "List tasks" } },
              "/healthz": { get: { summary: "Health" } },
            },
            components: {
              schemas: {
                Item: { type: "object", properties: { id: { type: "string" } } },
              },
            },
          },
        },
        {
          service: "billing",
          spec: {
            paths: {
              "/invoices": {
                get: {
                  responses: {
                    200: {
                      content: {
                        "application/json": {
                          schema: { $ref: "#/components/schemas/Item" },
                        },
                      },
                    },
                  },
                },
              },
            },
            components: {
              schemas: {
                Item: { type: "object", properties: { amount: { type: "number" } } },
              },
            },
          },
        },
      ],
      { title: "Test API", version: "0.1.0" },
    );

    expect(merged.openapi).toBe("3.1.0");
    expect(merged.paths["/api/v1/core/tasks"]).toBeDefined();
    expect(merged.paths["/api/v1/core/healthz"]).toBeUndefined();
    expect(merged.paths["/api/v1/billing/invoices"]).toBeDefined();
    expect(merged.components.schemas.Item).toBeDefined();
    expect(merged.components.schemas.Billing_Item).toBeDefined();
  });

  it("proxies requests with minted internal JWT, serves /api/config, /api/openapi.json, and /api/admin/meta", async () => {
    const coreApp = createServiceApp({ name: "core" });
    coreApp.registerAdminEntity({
      service: "core",
      entity: "Note",
      table: "notes",
      basePath: "/api/v1/core/notes",
      primaryKey: "id",
      displayField: "title",
      fields: [{ name: "title", label: "Title", type: "string", required: true, readOnly: false }],
    });

    coreApp.openapi(
      createRoute({
        method: "get",
        path: "/notes",
        middleware: [requireAuth()] as const,
        responses: {
          200: {
            description: "List notes",
            content: {
              "application/json": {
                schema: z.object({
                  userId: z.string(),
                  items: z.array(z.string()),
                }),
              },
            },
          },
        },
      }),
      (c) => {
        const actor = c.get("actor");
        return c.json({ userId: actor?.sub ?? "none", items: ["note-1"] }, 200);
      },
    );

    const config = defineConfig({
      name: "reference",
      displayName: "Reference App",
      basePort: 4000,
      services: {
        core: { portOffset: 10 },
      },
    });

    const gateway = createGatewayApp({
      config,
      serviceApps: { core: coreApp },
    });

    // 1. /api/config
    const cfgRes = await gateway.request("/api/config");
    expect(cfgRes.status).toBe(200);
    const cfgBody = (await cfgRes.json()) as any;
    expect(cfgBody.project).toBe("reference");
    expect(cfgBody.apiBaseUrl).toBe("/api");

    // 2. Unauthenticated call to protected service route fails with 401
    const unauthNotes = await gateway.request("/api/v1/core/notes");
    expect(unauthNotes.status).toBe(401);

    // 3. Authenticated call succeeds and receives minted internal token
    const authNotes = await gateway.request("/api/v1/core/notes", {
      headers: { "x-test-user-id": "user-77" },
    });
    expect(authNotes.status).toBe(200);
    expect(await authNotes.json()).toEqual({
      userId: "user-77",
      items: ["note-1"],
    });

    // 4. Merged OpenAPI spec
    const openApiRes = await gateway.request("/api/openapi.json");
    expect(openApiRes.status).toBe(200);
    const openApi = (await openApiRes.json()) as any;
    expect(openApi.paths["/api/v1/core/notes"]).toBeDefined();

    // 5. Admin meta requires admin role
    const nonAdminMeta = await gateway.request("/api/admin/meta", {
      headers: { "x-test-user-id": "user-77", "x-test-user-role": "user" },
    });
    expect(nonAdminMeta.status).toBe(403);

    const adminMeta = await gateway.request("/api/admin/meta", {
      headers: { "x-test-user-id": "admin-1", "x-test-user-role": "admin" },
    });
    expect(adminMeta.status).toBe(200);
    const metaList = (await adminMeta.json()) as any;
    expect(metaList).toHaveLength(1);
    expect(metaList[0].entity).toBe("Note");
  });
});
