import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addEntityInternal,
  checkMigrationDriftInternal,
  dbGenerateInternal,
  ensureBaselineSnapshot,
  newProjectInternal,
  parseSqlToSnapshot,
} from "../src/index.js";

describe("pand db generate incremental migrations & drift check", () => {
  it("parses SQL into Drizzle snapshot format correctly", () => {
    const sql = `
      CREATE SCHEMA IF NOT EXISTS "core";
      --> statement-breakpoint
      CREATE TABLE IF NOT EXISTS "core"."items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" varchar(255) NOT NULL,
        "notes" text,
        "count" integer DEFAULT 0 NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    const snapshot = parseSqlToSnapshot(sql, "core");
    expect(snapshot.version).toBe("7");
    expect(snapshot.dialect).toBe("postgresql");
    expect(snapshot.tables["core.items"]).toBeDefined();
    const table = snapshot.tables["core.items"];
    expect(table.columns.id.primaryKey).toBe(true);
    expect(table.columns.id.type).toBe("uuid");
    expect(table.columns.title.type).toBe("varchar(255)");
    expect(table.columns.title.notNull).toBe(true);
    expect(table.columns.notes.notNull).toBe(false);
    expect(table.columns.count.default).toBe("0");
    expect(table.columns.is_active.default).toBe("true");
    expect(table.columns.created_at.type).toBe("timestamp with time zone");
  });

  it("handles fresh service, incremental ALTER migration, drift detection, ambiguous prompts, and baseline upgrade", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "pand-db-gen-test-"));
    try {
      // 1. Scaffold a fresh minimal project
      const created = await newProjectInternal({
        cwd: tmpBase,
        name: "mig-demo",
        minimal: true,
      });

      // Add entity Item
      await addEntityInternal({
        rootDir: created.projectDir,
        service: "core",
        entity: "Item",
        fieldsDsl: "title:string",
      });

      const coreDir = path.join(created.projectDir, "services", "core");
      const drizzleDir = path.join(coreDir, "drizzle");
      const metaDir = path.join(drizzleDir, "meta");

      // Verify migration drift detected before generate
      await expect(checkMigrationDriftInternal(created.projectDir)).rejects.toThrow(
        /Database schema drift detected in service 'core'/i,
      );

      // 2. Fresh service: init migration + snapshot are created
      const gen1 = await dbGenerateInternal({ rootDir: created.projectDir });
      expect(gen1.generated).toContain("core");

      const filesAfterGen1 = fs.readdirSync(drizzleDir);
      const initSqlFile = filesAfterGen1.find((f) => f.startsWith("0000_") && f.endsWith(".sql"));
      expect(initSqlFile).toBeDefined();
      expect(fs.existsSync(path.join(metaDir, "_journal.json"))).toBe(true);
      expect(fs.existsSync(path.join(metaDir, "0000_snapshot.json"))).toBe(true);

      const initSqlContent = fs.readFileSync(path.join(drizzleDir, initSqlFile!), "utf8");
      expect(initSqlContent).toContain('CREATE SCHEMA IF NOT EXISTS "core"');
      expect(initSqlContent).toContain('CREATE TABLE IF NOT EXISTS "core"."items"');

      // Verify check passes now
      await expect(checkMigrationDriftInternal(created.projectDir)).resolves.not.toThrow();

      // 3. Adding a nullable column → 0001 ALTER migration
      const itemsSchemaPath = path.join(coreDir, "src", "db", "schema", "items.ts");
      const origSchema = fs.readFileSync(itemsSchemaPath, "utf8");
      // Append notes: varchar("notes", { length: 255 })
      const updatedSchemaWithNotes = origSchema.replace(
        'id: uuid("id").primaryKey().defaultRandom(),',
        'id: uuid("id").primaryKey().defaultRandom(),\n  notes: varchar("notes", { length: 255 }),',
      );
      fs.writeFileSync(itemsSchemaPath, updatedSchemaWithNotes, "utf8");

      // Verify drift detected
      await expect(checkMigrationDriftInternal(created.projectDir)).rejects.toThrow(
        /Database schema drift detected in service 'core'/i,
      );

      // Generate 0001 migration
      const gen2 = await dbGenerateInternal({ rootDir: created.projectDir });
      expect(gen2.generated).toContain("core");

      const filesAfterGen2 = fs.readdirSync(drizzleDir);
      const alterSqlFile = filesAfterGen2.find((f) => f.startsWith("0001_") && f.endsWith(".sql"));
      expect(alterSqlFile).toBeDefined();
      expect(fs.existsSync(path.join(metaDir, "0001_snapshot.json"))).toBe(true);

      const alterSqlContent = fs.readFileSync(path.join(drizzleDir, alterSqlFile!), "utf8");
      expect(alterSqlContent).toContain(
        'ALTER TABLE "core"."items" ADD COLUMN "notes" varchar(255)',
      );
      // Verify ALTER is not corrupted by IF NOT EXISTS
      expect(alterSqlContent).not.toContain("ALTER TABLE IF NOT EXISTS");

      // Verify check passes again
      await expect(checkMigrationDriftInternal(created.projectDir)).resolves.not.toThrow();

      // 4. Renaming a column or adding a NOT NULL column where rename prompt occurs → clear error, no hang
      const schemaWithAmbiguous = origSchema.replace(
        'title: varchar("title", { length: 255 }).notNull(),',
        'name: varchar("name", { length: 255 }).notNull(),',
      );
      fs.writeFileSync(itemsSchemaPath, schemaWithAmbiguous, "utf8");

      await expect(dbGenerateInternal({ rootDir: created.projectDir })).rejects.toThrow(
        /drizzle-kit requires confirmation for ambiguous schema changes in service 'core'/i,
      );

      // 5. Upgrade path for existing projects: simulate project with 0000_init.sql but no 0000_snapshot.json
      // Revert schema to have subtitle: varchar("subtitle", { length: 255 }) instead of ambiguous change
      const schemaWithSubtitle = origSchema.replace(
        'id: uuid("id").primaryKey().defaultRandom(),',
        'id: uuid("id").primaryKey().defaultRandom(),\n  subtitle: varchar("subtitle", { length: 255 }),',
      );
      fs.writeFileSync(itemsSchemaPath, schemaWithSubtitle, "utf8");

      // Remove 0001 migration and snapshots
      fs.rmSync(path.join(drizzleDir, alterSqlFile!), { force: true });
      fs.rmSync(path.join(metaDir, "0000_snapshot.json"), { force: true });
      fs.rmSync(path.join(metaDir, "0001_snapshot.json"), { force: true });
      // Reset _journal.json to only entry 0
      fs.writeFileSync(
        path.join(metaDir, "_journal.json"),
        JSON.stringify(
          {
            version: "7",
            dialect: "postgresql",
            entries: [
              {
                idx: 0,
                version: "7",
                when: 1730000000000,
                tag: initSqlFile!.replace(".sql", ""),
                breakpoints: true,
              },
            ],
          },
          null,
          2,
        ),
        "utf8",
      );

      expect(fs.existsSync(path.join(metaDir, "0000_snapshot.json"))).toBe(false);

      // Ensure baseline snapshot synthesizes 0000_snapshot.json
      const synthesized = ensureBaselineSnapshot(coreDir, "core");
      expect(synthesized).toBe(true);
      expect(fs.existsSync(path.join(metaDir, "0000_snapshot.json"))).toBe(true);

      // Generating next migration now diffs against baseline and produces correct ALTER
      const gen3 = await dbGenerateInternal({ rootDir: created.projectDir });
      expect(gen3.generated).toContain("core");

      const filesAfterGen3 = fs.readdirSync(drizzleDir);
      const newAlterFile = filesAfterGen3.find((f) => f.startsWith("0001_") && f.endsWith(".sql"));
      expect(newAlterFile).toBeDefined();
      const newAlterContent = fs.readFileSync(path.join(drizzleDir, newAlterFile!), "utf8");
      expect(newAlterContent).toContain(
        'ALTER TABLE "core"."items" ADD COLUMN "subtitle" varchar(255)',
      );

      // 6. Drizzle-kit failure surfaces non-zero exit with stderr
      const drizzleConfigPath = path.join(coreDir, "drizzle.config.ts");
      fs.writeFileSync(
        drizzleConfigPath,
        'throw new Error("Syntax error in drizzle.config.ts");',
        "utf8",
      );

      await expect(dbGenerateInternal({ rootDir: created.projectDir })).rejects.toThrow(
        /Failed to generate migrations for service 'core':/i,
      );
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  }, 120_000);
});
