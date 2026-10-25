import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestDatabase } from "@pand/testing";
import { describe, expect, it } from "vitest";
import {
  addEntityInternal,
  addServiceInternal,
  dbGenerateInternal,
  dbMigrateInternal,
  newProjectInternal,
  sdkGenInternal,
  writeDevArtifacts,
} from "../src/index.js";

describe("@pand/cli generators and dev commands", () => {
  it("scaffolds a project, adds a service, adds an entity, generates migrations + SDK, and migrates DB", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "pand-cli-gen-"));
    const testDb = await createTestDatabase();

    try {
      const created = await newProjectInternal({
        cwd: tmpBase,
        name: "cli-demo",
        minimal: true,
      });

      expect(created.name).toBe("cli-demo");
      expect(fs.existsSync(path.join(created.projectDir, "pand.config.ts"))).toBe(true);
      expect(
        fs.existsSync(path.join(created.projectDir, "services", "core", "src", "app.ts")),
      ).toBe(true);

      const billing = await addServiceInternal({
        rootDir: created.projectDir,
        serviceName: "billing",
        skipInstall: true,
      });
      expect(billing.service).toBe("billing");
      expect(billing.portOffset).toBe(11);

      const entityRes = await addEntityInternal({
        rootDir: created.projectDir,
        service: "core",
        entity: "Task",
        fieldsDsl: "title:string,done:boolean=false,priority:enum(low|medium|high)=medium",
      });
      expect(entityRes.table).toBe("tasks");
      expect(entityRes.basePath).toBe("/api/v1/core/tasks");

      const dbGen = await dbGenerateInternal({ rootDir: created.projectDir });
      expect(dbGen.generated).toContain("core");

      const dbMig = await dbMigrateInternal({
        rootDir: created.projectDir,
        databaseUrl: testDb.databaseUrl,
      });
      expect(dbMig.migrated).toContain("core");

      const sdkRes = await sdkGenInternal({ rootDir: created.projectDir });
      expect(sdkRes.pathCount).toBeGreaterThanOrEqual(2);
      expect(fs.existsSync(sdkRes.contractsPath)).toBe(true);
      expect(fs.existsSync(sdkRes.schemaPath)).toBe(true);

      const devArtifacts = await writeDevArtifacts(created.projectDir);
      expect(fs.existsSync(devArtifacts.composePath)).toBe(true);
      expect(fs.existsSync(devArtifacts.devEnvPath)).toBe(true);
    } finally {
      await testDb.cleanup();
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  }, 60_000);
});
