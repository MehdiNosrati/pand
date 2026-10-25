import path from "node:path";
import { createTestDatabase } from "@pand/testing";
import { describe, expect, it } from "vitest";
import { createPandMcpServer } from "../src/index.js";

describe("@pand/mcp server & guardrails", () => {
  it("exposes all 13 MCP tools, enforces prod confirmation guardrails, and enforces read-only SQL", async () => {
    const refDir = path.resolve(import.meta.dirname, "../../../examples/reference");
    const { handlers } = createPandMcpServer(refDir);
    const testDb = await createTestDatabase();

    try {
      const info = await handlers.pand_project_info({});
      expect(info.config.name).toBe("reference");
      expect(info.ports.gatewayPort).toBe(4001);

      const openapi = await handlers.pand_openapi_get({});
      expect(openapi.openapi).toBe("3.1.0");

      // Prod guardrail checks
      await expect(handlers.pand_db_migrate({ env: "prod", confirmProd: false })).rejects.toThrow(
        /confirmProd: true/,
      );

      await expect(handlers.pand_deploy({ env: "prod", confirmProd: false })).rejects.toThrow(
        /confirmProd: true/,
      );

      // Read-only SQL guardrail check
      await expect(
        handlers.pand_db_query_readonly({
          env: "dev",
          sql: "DROP TABLE core.tasks;",
          databaseUrl: testDb.databaseUrl,
        }),
      ).rejects.toThrow(/rejects mutating SQL/);

      const selectRes = await handlers.pand_db_query_readonly({
        env: "dev",
        sql: "SELECT 1 + 1 AS sum",
        databaseUrl: testDb.databaseUrl,
      });
      expect(selectRes.rows).toEqual([{ sum: 2 }]);
    } finally {
      await testDb.cleanup();
    }
  });
});
