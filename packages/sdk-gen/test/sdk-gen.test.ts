import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateKotlinSdk, generateSwiftSdk, generateTypeScriptSdk } from "../src/index.js";

describe("@pands/sdk-gen", () => {
  it("generates openapi.json, schema.d.ts, and typed client wrapper and detects drift", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pand-sdk-gen-"));
    try {
      const spec = {
        openapi: "3.1.0",
        info: { title: "Todo API", version: "0.1.0" },
        paths: {
          "/api/v1/core/tasks": {
            get: {
              operationId: "listTasks",
              responses: {
                "200": {
                  description: "OK",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        required: ["items"],
                        properties: {
                          items: {
                            type: "array",
                            items: { $ref: "#/components/schemas/Task" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            Task: {
              type: "object",
              required: ["id", "title", "done"],
              properties: {
                id: { type: "string", format: "uuid" },
                title: { type: "string" },
                done: { type: "boolean" },
              },
            },
          },
        },
      };

      const firstRun = await generateTypeScriptSdk({
        openApiSpec: spec,
        outDir: tmpDir,
      });

      expect(firstRun.drifted).toBe(true);
      expect(fs.existsSync(firstRun.contractsPath)).toBe(true);
      expect(fs.existsSync(firstRun.schemaPath)).toBe(true);
      expect(fs.existsSync(firstRun.clientPath)).toBe(true);
      expect(firstRun.schemaDts).toContain("/api/v1/core/tasks");
      expect(firstRun.schemaDts).toContain("Task");

      const checkRun = await generateTypeScriptSdk({
        openApiSpec: spec,
        outDir: tmpDir,
        checkOnly: true,
      });
      expect(checkRun.drifted).toBe(false);

      const swiftRes = generateSwiftSdk({
        openApiSpec: spec,
        outDir: tmpDir,
      });
      expect(fs.existsSync(swiftRes.openApiPath)).toBe(true);
      expect(fs.existsSync(swiftRes.configYamlPath)).toBe(true);
      expect(fs.readFileSync(swiftRes.clientSwiftPath, "utf8")).toContain(
        "public struct Task: Codable",
      );

      const kotlinRes = generateKotlinSdk({
        openApiSpec: spec,
        outDir: tmpDir,
        projectName: "todo-app",
      });
      expect(fs.existsSync(kotlinRes.modelsKtPath)).toBe(true);
      expect(fs.existsSync(kotlinRes.apiKtPath)).toBe(true);
      expect(fs.readFileSync(kotlinRes.modelsKtPath, "utf8")).toContain("data class Task(");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
