import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestDatabase } from "@pand/testing";
import { describe, expect, it } from "vitest";
import {
  boolean,
  createDb,
  eq,
  migrateServiceSchema,
  pgSchema,
  timestamp,
  uuid,
  varchar,
} from "../src/index.js";

const coreSchema = pgSchema("core");
const tasks = coreSchema.table("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  done: boolean("done").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

describe("@pand/db", () => {
  it("runs schema-isolated migrations, health check, and Drizzle queries", async () => {
    const testDb = await createTestDatabase();
    const tmpMigrations = fs.mkdtempSync(path.join(os.tmpdir(), "pand-migrations-"));

    try {
      const metaDir = path.join(tmpMigrations, "meta");
      fs.mkdirSync(metaDir, { recursive: true });
      fs.writeFileSync(
        path.join(metaDir, "_journal.json"),
        JSON.stringify({
          version: "7",
          dialect: "postgresql",
          entries: [
            {
              idx: 0,
              version: "7",
              when: 1730000000000,
              tag: "0000_init",
              breakpoints: true,
            },
          ],
        }),
      );
      fs.writeFileSync(
        path.join(tmpMigrations, "0000_init.sql"),
        `CREATE SCHEMA IF NOT EXISTS "core";
CREATE TABLE IF NOT EXISTS "core"."tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(255) NOT NULL,
  "done" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);`,
      );

      await migrateServiceSchema({
        databaseUrl: testDb.databaseUrl,
        serviceName: "core",
        migrationsFolder: tmpMigrations,
      });

      const handle = createDb({
        databaseUrl: testDb.databaseUrl,
        schema: { tasks },
      });

      try {
        expect(await handle.checkHealth()).toBe("ok");

        const [inserted] = await handle.db
          .insert(tasks)
          .values({ title: "Write tests", done: false })
          .returning();

        expect(inserted?.title).toBe("Write tests");
        expect(inserted?.done).toBe(false);

        const found = await handle.db
          .select()
          .from(tasks)
          .where(eq(tasks.id, inserted?.id ?? ""));
        expect(found.length).toBe(1);
        expect(found[0]?.title).toBe("Write tests");
      } finally {
        await handle.close();
      }
    } finally {
      fs.rmSync(tmpMigrations, { recursive: true, force: true });
      await testDb.cleanup();
    }
  });
});
