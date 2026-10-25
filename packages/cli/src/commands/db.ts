import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { ensureAuthTables } from "@pand/auth";
import { loadPandConfig, resolveProjectPorts } from "@pand/config";
import { migrateServiceSchema } from "@pand/db";
import { defineCommand } from "citty";
import { getTableConfig } from "drizzle-orm/pg-core";
import { execa } from "execa";
import { createJiti } from "jiti";
import pg from "pg";
import { toSnakeCase } from "../generators/template.js";
import { GLOBAL_ARGS_DEF, emitError, emitResult, resolveCwd } from "../output.js";

async function isPortOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onError = () => {
      socket.destroy();
      resolve(false);
    };
    socket.setTimeout(300);
    socket.once("error", onError);
    socket.once("timeout", onError);
    socket.connect(port, host, () => {
      socket.end();
      resolve(true);
    });
  });
}

export async function resolveDevDatabaseUrl(rootDir: string): Promise<string> {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const { config } = await loadPandConfig(rootDir);
  const ports = resolveProjectPorts(config);
  const dbName = `${toSnakeCase(config.name)}_dev`;

  let pgPort = ports.postgresPort;
  if (!(await isPortOpen(pgPort)) && (await isPortOpen(4032))) {
    pgPort = 4032;
  }

  const adminUrl = `postgres://pand:pand@localhost:${pgPort}/postgres`;
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const existsRes = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (existsRes.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await client.end();
  }

  return `postgres://pand:pand@localhost:${pgPort}/${dbName}`;
}

async function ensureServiceMigrationsFallback(
  serviceDir: string,
  serviceName: string,
): Promise<boolean> {
  const drizzleDir = path.join(serviceDir, "drizzle");
  const journalPath = path.join(drizzleDir, "meta", "_journal.json");
  const schemaIndexPath = path.join(serviceDir, "src", "db", "schema", "index.ts");
  if (!fs.existsSync(schemaIndexPath)) {
    return false;
  }

  const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false });
  const mod = (await jiti.import(schemaIndexPath)) as Record<string, unknown>;

  const sqlStatements: string[] = [`CREATE SCHEMA IF NOT EXISTS "${serviceName}";`];

  for (const exported of Object.values(mod)) {
    if (!exported || typeof exported !== "object") continue;
    try {
      const cfg = getTableConfig(exported as any);
      if (!cfg || !cfg.name || !cfg.columns) continue;
      const schemaPrefix = cfg.schema ? `"${cfg.schema}".` : `"${serviceName}".`;
      const colDefs: string[] = [];
      for (const col of cfg.columns) {
        const sqlType = col.getSQLType();
        let def = `"${col.name}" ${sqlType}`;
        if (col.primary) {
          def += " PRIMARY KEY";
        }
        if (col.hasDefault) {
          if (sqlType === "uuid") {
            def += " DEFAULT gen_random_uuid()";
          } else if (sqlType.startsWith("timestamp")) {
            def += " DEFAULT now()";
          } else if (col.default !== undefined && typeof col.default !== "object") {
            def +=
              typeof col.default === "string"
                ? ` DEFAULT '${col.default}'`
                : ` DEFAULT ${String(col.default)}`;
          }
        }
        if (col.notNull) {
          def += " NOT NULL";
        }
        colDefs.push(`  ${def}`);
      }
      sqlStatements.push(
        `CREATE TABLE IF NOT EXISTS ${schemaPrefix}"${cfg.name}" (\n${colDefs.join(",\n")}\n);`,
      );
    } catch {
      // Not a Drizzle table object
    }
  }

  if (sqlStatements.length <= 1) {
    return false;
  }

  fs.mkdirSync(path.join(drizzleDir, "meta"), { recursive: true });
  const sqlContent = `${sqlStatements.join("\n--> statement-breakpoint\n")}\n`;
  fs.writeFileSync(path.join(drizzleDir, "0000_init.sql"), sqlContent, "utf8");
  fs.writeFileSync(
    journalPath,
    `${JSON.stringify(
      {
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
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return true;
}

export async function dbGenerateInternal(options: { rootDir: string; service?: string }) {
  const { config } = await loadPandConfig(options.rootDir);
  const targetServices = options.service
    ? [options.service]
    : Object.entries(config.services)
        .filter(([, s]) => s.db)
        .map(([name]) => name);

  const generated: string[] = [];

  // Also include gateway if it has a schema
  const allTargets = [...targetServices];
  if (
    !options.service &&
    fs.existsSync(path.join(options.rootDir, "services", "gateway", "src", "db", "schema"))
  ) {
    allTargets.unshift("gateway");
  }

  for (const svc of allTargets) {
    const svcDir = path.join(options.rootDir, "services", svc);
    if (!fs.existsSync(svcDir)) continue;
    const journalPath = path.join(svcDir, "drizzle", "meta", "_journal.json");

    try {
      await execa("pnpm", ["exec", "drizzle-kit", "generate"], { cwd: svcDir });
    } catch {
      // Fall back to deterministic table inspection if drizzle-kit CLI encounters an issue
    }

    if (!fs.existsSync(journalPath)) {
      await ensureServiceMigrationsFallback(svcDir, svc === "gateway" ? "auth" : svc);
    } else {
      // Also ensure any new tables are reflected if journal has 0 entries
      const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
      if (!journal.entries || journal.entries.length === 0) {
        await ensureServiceMigrationsFallback(svcDir, svc === "gateway" ? "auth" : svc);
      }
    }

    // Make any drizzle-kit generated SQL idempotent (CREATE SCHEMA IF NOT EXISTS / CREATE TABLE IF NOT EXISTS)
    const drizzleDir = path.join(svcDir, "drizzle");
    if (fs.existsSync(drizzleDir)) {
      for (const file of fs.readdirSync(drizzleDir)) {
        if (!file.endsWith(".sql")) continue;
        const sqlPath = path.join(drizzleDir, file);
        const origSql = fs.readFileSync(sqlPath, "utf8");
        const idempotentSql = origSql
          .replace(/CREATE SCHEMA "/g, 'CREATE SCHEMA IF NOT EXISTS "')
          .replace(/CREATE TABLE "/g, 'CREATE TABLE IF NOT EXISTS "');
        if (idempotentSql !== origSql) {
          fs.writeFileSync(sqlPath, idempotentSql, "utf8");
        }
      }
    }

    generated.push(svc);
  }

  return { generated };
}

export async function dbMigrateInternal(options: {
  rootDir: string;
  env?: string;
  databaseUrl?: string;
}) {
  const { config } = await loadPandConfig(options.rootDir);
  const databaseUrl = options.databaseUrl ?? (await resolveDevDatabaseUrl(options.rootDir));
  const migrated: string[] = [];

  const gatewayMigrations = path.join(options.rootDir, "services", "gateway", "drizzle");
  if (fs.existsSync(gatewayMigrations)) {
    await migrateServiceSchema({
      databaseUrl,
      serviceName: "auth",
      migrationsFolder: gatewayMigrations,
    });
    migrated.push("gateway");
  } else {
    await ensureAuthTables(databaseUrl);
  }

  for (const [serviceName, serviceCfg] of Object.entries(config.services)) {
    if (!serviceCfg.db) continue;
    const migrationsFolder = path.join(options.rootDir, "services", serviceName, "drizzle");
    await migrateServiceSchema({
      databaseUrl,
      serviceName,
      migrationsFolder,
    });
    migrated.push(serviceName);
  }

  return { databaseUrl, migrated };
}

export async function dbSeedInternal(options: { rootDir: string }) {
  const { config } = await loadPandConfig(options.rootDir);
  const databaseUrl = await resolveDevDatabaseUrl(options.rootDir);
  const seeded: string[] = [];

  for (const serviceName of Object.keys(config.services)) {
    const seedFile = path.join(options.rootDir, "services", serviceName, "src", "db", "seed.ts");
    if (fs.existsSync(seedFile)) {
      await execa("pnpm", ["exec", "tsx", seedFile], {
        cwd: path.join(options.rootDir, "services", serviceName),
        env: { ...process.env, DATABASE_URL: databaseUrl },
      });
      seeded.push(serviceName);
    }
  }

  return { seeded };
}

export const dbCommand = defineCommand({
  meta: {
    name: "db",
    description: "Database migration and seed commands (generate | migrate | seed)",
  },
  subCommands: {
    generate: defineCommand({
      meta: { name: "generate", description: "Generate Drizzle SQL migrations" },
      args: {
        ...GLOBAL_ARGS_DEF,
        service: {
          type: "string",
          description: "Generate for a single service",
        },
      },
      async run({ args }) {
        try {
          const cwd = resolveCwd(args);
          const { rootDir } = await loadPandConfig(cwd);
          const res = await dbGenerateInternal({
            rootDir,
            service: args.service ? String(args.service) : undefined,
          });
          emitResult(args, res, `Generated migrations for: ${res.generated.join(", ")}`);
        } catch (err) {
          emitError(args, err);
        }
      },
    }),
    migrate: defineCommand({
      meta: { name: "migrate", description: "Run pending Drizzle SQL migrations" },
      args: {
        ...GLOBAL_ARGS_DEF,
        env: {
          type: "string",
          description: "Target environment (dev | prod)",
          default: "dev",
        },
      },
      async run({ args }) {
        try {
          const cwd = resolveCwd(args);
          const { rootDir } = await loadPandConfig(cwd);
          const res = await dbMigrateInternal({
            rootDir,
            env: String(args.env ?? "dev"),
          });
          emitResult(args, res, `Migrated schemas: ${res.migrated.join(", ")}`);
        } catch (err) {
          emitError(args, err);
        }
      },
    }),
    seed: defineCommand({
      meta: { name: "seed", description: "Run service database seed scripts" },
      args: {
        ...GLOBAL_ARGS_DEF,
      },
      async run({ args }) {
        try {
          const cwd = resolveCwd(args);
          const { rootDir } = await loadPandConfig(cwd);
          const res = await dbSeedInternal({ rootDir });
          emitResult(args, res, `Seeded services: ${res.seeded.join(", ") || "none"}`);
        } catch (err) {
          emitError(args, err);
        }
      },
    }),
  },
});
