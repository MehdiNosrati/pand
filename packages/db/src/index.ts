import fs from "node:fs";
import path from "node:path";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import pg from "pg";

const { Pool } = pg;

export interface CreateDbOptions<TSchema extends Record<string, unknown>> {
  databaseUrl?: string;
  schema: TSchema;
  maxConnections?: number;
}

export interface DbInstance<TSchema extends Record<string, unknown>> {
  db: NodePgDatabase<TSchema>;
  pool: pg.Pool;
  checkHealth: () => Promise<string>;
  close: () => Promise<void>;
}

export function createDb<TSchema extends Record<string, unknown>>(
  options: CreateDbOptions<TSchema>,
): DbInstance<TSchema> {
  const connectionString =
    options.databaseUrl ??
    process.env.DATABASE_URL ??
    "postgres://pand:pand@localhost:4032/reference_dev";

  const pool = new Pool({
    connectionString,
    max: options.maxConnections ?? 10,
  });

  const db = drizzle(pool, { schema: options.schema });

  const checkHealth = async (): Promise<string> => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DB health check timed out after 2000ms")), 2000),
      );
      await Promise.race([pool.query("SELECT 1"), timeoutPromise]);
      return "ok";
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  };

  const close = async (): Promise<void> => {
    await pool.end();
  };

  return {
    db,
    pool,
    checkHealth,
    close,
  };
}

export interface MigrateServiceSchemaOptions {
  databaseUrl: string;
  serviceName: string;
  migrationsFolder: string;
}

export async function migrateServiceSchema(options: MigrateServiceSchemaOptions): Promise<void> {
  const pool = new Pool({ connectionString: options.databaseUrl, max: 2 });
  try {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${options.serviceName}"`);
    const journalPath = path.join(options.migrationsFolder, "meta", "_journal.json");
    if (!fs.existsSync(journalPath)) {
      return;
    }
    const db = drizzle(pool);
    await migrate(db, {
      migrationsFolder: options.migrationsFolder,
      migrationsSchema: options.serviceName,
      migrationsTable: "__drizzle_migrations",
    });
  } finally {
    await pool.end();
  }
}

export {
  and,
  asc,
  boolean,
  desc,
  doublePrecision,
  drizzle,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  integer,
  isNotNull,
  isNull,
  jsonb,
  lt,
  lte,
  ne,
  or,
  pgSchema,
  pgTable,
  sql,
  text,
  timestamp,
  uuid,
  varchar,
  type NodePgDatabase,
};
