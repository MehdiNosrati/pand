import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrateServiceSchema } from "@pand/db";
import { createGatewayApp } from "@pand/gateway";
import { generateTypeScriptSdk } from "@pand/sdk-gen";
import { createTestDatabase } from "@pand/testing";
import { createPandClient } from "@reference/sdk";
import { describe, expect, it } from "vitest";
import config from "../../../pand.config.js";
import { buildCoreApp } from "../src/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const referenceRoot = path.resolve(__dirname, "../../..");

describe("examples/reference E2E", () => {
  it("runs migrations, generates OpenAPI + SDK, and executes full Note CRUD through Gateway via @reference/sdk", async () => {
    const testDb = await createTestDatabase();
    const { app: coreApp, closeDb } = buildCoreApp(testDb.databaseUrl);

    try {
      await migrateServiceSchema({
        databaseUrl: testDb.databaseUrl,
        serviceName: "core",
        migrationsFolder: path.resolve(__dirname, "../drizzle"),
      });

      const gatewayApp = createGatewayApp({
        config,
        serviceApps: { core: coreApp },
      });

      // Fetch merged OpenAPI from gateway and ensure SDK artifacts are generated
      const openApiRes = await gatewayApp.request("/api/openapi.json");
      expect(openApiRes.status).toBe(200);
      const openApiSpec = (await openApiRes.json()) as Record<string, any>;

      await generateTypeScriptSdk({
        openApiSpec,
        outDir: referenceRoot,
      });

      // Create typed SDK client wired to in-process gateway
      const client = createPandClient({
        baseUrl: "http://localhost:4001",
        getToken: () => "test-user:user-e2e-1:admin",
        fetch: async (input: string | Request | URL, init?: RequestInit) => {
          const req = input instanceof Request ? input : new Request(input, init);
          const url = new URL(req.url);
          return await gatewayApp.request(url.pathname + url.search, req);
        },
      });

      // 1. Create Note
      const createRes = await client.POST("/api/v1/core/notes", {
        body: {
          title: "First Pand Note",
          body: "Hello from E2E test",
          pinned: true,
        },
      });
      expect(createRes.response.status).toBe(201);
      expect(createRes.data?.title).toBe("First Pand Note");
      expect(createRes.data?.pinned).toBe(true);
      const noteId = createRes.data!.id;

      // 2. List Notes
      const listRes = await client.GET("/api/v1/core/notes", {
        params: { query: { q: "First" } },
      });
      expect(listRes.response.status).toBe(200);
      expect(listRes.data?.items).toHaveLength(1);
      expect(listRes.data?.items[0]?.id).toBe(noteId);

      // 3. Get Note by ID
      const getRes = await client.GET("/api/v1/core/notes/{id}", {
        params: { path: { id: noteId } },
      });
      expect(getRes.response.status).toBe(200);
      expect(getRes.data?.body).toBe("Hello from E2E test");

      // 4. Update Note
      const updateRes = await client.PATCH("/api/v1/core/notes/{id}", {
        params: { path: { id: noteId } },
        body: {
          title: "Updated Pand Note",
          pinned: false,
        },
      });
      expect(updateRes.response.status).toBe(200);
      expect(updateRes.data?.title).toBe("Updated Pand Note");
      expect(updateRes.data?.pinned).toBe(false);

      // 5. Delete Note
      const deleteRes = await client.DELETE("/api/v1/core/notes/{id}", {
        params: { path: { id: noteId } },
      });
      expect(deleteRes.response.status).toBe(200);
      expect(deleteRes.data?.deleted).toBe(true);

      // 6. Get Deleted Note -> 404
      const missingRes = await client.GET("/api/v1/core/notes/{id}", {
        params: { path: { id: noteId } },
      });
      expect(missingRes.response.status).toBe(404);
    } finally {
      await closeDb();
      await testDb.cleanup();
    }
  });
});
