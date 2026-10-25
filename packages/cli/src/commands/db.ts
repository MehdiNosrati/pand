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

export function getNodeOptionsWithTsx(): string {
  const existing = process.env.NODE_OPTIONS ?? "";
  if (existing.includes("--import tsx") || existing.includes("loader.mjs")) {
    return existing;
  }
  return [existing, "--import tsx"].filter(Boolean).join(" ");
}

export function splitSqlColumns(body: string): string[] {
  const statements: string[] = [];
  let current = "";
  let parenDepth = 0;
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inQuote) {
      current += ch;
      if (ch === quoteChar) {
        inQuote = false;
      }
    } else if (ch === "'" || ch === '"') {
      inQuote = true;
      quoteChar = ch;
      current += ch;
    } else if (ch === "(") {
      parenDepth++;
      current += ch;
    } else if (ch === ")") {
      parenDepth--;
      current += ch;
    } else if (ch === "," && parenDepth === 0) {
      if (current.trim()) statements.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

export function parseSqlToSnapshot(
  sql: string,
  defaultSchema = "public",
  options: { id?: string; prevId?: string } = {},
) {
  const tables: Record<string, any> = {};
  const tableRegex =
    /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(?:(?:"([^"]+)"|([a-zA-Z0-9_]+))\.)?(?:"([^"]+)"|([a-zA-Z0-9_]+))\s*\(([\s\S]*?)\);/gi;
  let match = tableRegex.exec(sql);
  while (match !== null) {
    const schema = match[1] || match[2] || defaultSchema;
    const tableName = match[3] || match[4];
    const body = match[5];
    if (!tableName || !body) {
      match = tableRegex.exec(sql);
      continue;
    }
    const columns: Record<string, any> = {};
    const pkCols = new Set<string>();

    const statements = splitSqlColumns(body);

    for (const stmt of statements) {
      const pkMatch = stmt.match(/(?:CONSTRAINT\s+[\s\S]+?\s+)?PRIMARY KEY\s*\(([^)]+)\)/i);
      if (pkMatch?.[1]) {
        const cols = pkMatch[1].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        for (const c of cols) pkCols.add(c);
      }
    }

    for (const stmt of statements) {
      if (/^(?:CONSTRAINT|PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK|--)/i.test(stmt)) {
        continue;
      }
      const colMatch = stmt.match(/^(?:"([^"]+)"|([a-zA-Z0-9_]+))\s+([^,]+)/);
      if (!colMatch) continue;
      const colName = colMatch[1] || colMatch[2];
      const rest = colMatch[3]?.trim();
      if (!colName || !rest) continue;

      const isPk = /PRIMARY KEY/i.test(rest) || pkCols.has(colName);
      const isNotNull = /NOT NULL/i.test(rest) || isPk;
      let defaultVal: string | undefined;
      const defaultMatch = rest.match(/DEFAULT\s+([^,]+?)(?:\s+NOT NULL|\s+PRIMARY KEY|$)/i);
      if (defaultMatch?.[1]) {
        defaultVal = defaultMatch[1].trim();
        if (defaultVal.startsWith("'") && defaultVal.endsWith("'")) {
          defaultVal = defaultVal.slice(1, -1);
        }
      }

      const type = rest
        .replace(/PRIMARY KEY/gi, "")
        .replace(/NOT NULL/gi, "")
        .replace(/DEFAULT\s+[^,]+/gi, "")
        .trim();

      columns[colName] = {
        name: colName,
        type: type.toLowerCase(),
        primaryKey: isPk,
        notNull: isNotNull,
        ...(defaultVal !== undefined ? { default: defaultVal } : {}),
      };
    }

    const key = schema ? `${schema}.${tableName}` : tableName;
    tables[key] = {
      name: tableName,
      schema: schema || "",
      columns,
      indexes: {},
      foreignKeys: {},
      compositePrimaryKeys: {},
      uniqueConstraints: {},
      policies: {},
      checkConstraints: {},
      isRLSEnabled: false,
    };
    match = tableRegex.exec(sql);
  }

  return {
    id: options.id || "00000000-0000-0000-0000-000000000001",
    prevId: options.prevId || "00000000-0000-0000-0000-000000000000",
    version: "7",
    dialect: "postgresql",
    tables,
    enums: {},
    schemas: {},
    sequences: {},
    roles: {},
    policies: {},
    views: {},
    _meta: {
      columns: {},
      schemas: {},
      tables: {},
    },
  };
}

export function ensureBaselineSnapshot(serviceDir: string, serviceName: string): boolean {
  const drizzleDir = path.join(serviceDir, "drizzle");
  const metaDir = path.join(drizzleDir, "meta");
  const journalPath = path.join(metaDir, "_journal.json");
  if (!fs.existsSync(journalPath)) return false;

  let journal: any;
  try {
    journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  } catch {
    return false;
  }

  if (!journal.entries || !Array.isArray(journal.entries)) return false;

  let createdAny = false;
  for (const entry of journal.entries) {
    const idxStr = String(entry.idx).padStart(4, "0");
    const snapshotPath = path.join(metaDir, `${idxStr}_snapshot.json`);
    if (!fs.existsSync(snapshotPath)) {
      const candidateFiles = [
        path.join(drizzleDir, `${entry.tag}.sql`),
        path.join(drizzleDir, `${idxStr}_init.sql`),
        ...fs
          .readdirSync(drizzleDir)
          .filter((f) => f.startsWith(`${idxStr}_`) && f.endsWith(".sql"))
          .map((f) => path.join(drizzleDir, f)),
      ];
      const sqlFile = candidateFiles.find((f) => fs.existsSync(f));
      if (sqlFile) {
        const sql = fs.readFileSync(sqlFile, "utf8");
        const prevIdxStr = entry.idx > 0 ? String(entry.idx - 1).padStart(4, "0") : null;
        const snapshot = parseSqlToSnapshot(sql, serviceName, {
          id: `00000000-0000-0000-0000-${String(entry.idx + 1).padStart(12, "0")}`,
          prevId: prevIdxStr
            ? `00000000-0000-0000-0000-${String(entry.idx).padStart(12, "0")}`
            : "00000000-0000-0000-0000-000000000000",
        });
        fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
        createdAny = true;
      }
    }
  }
  return createdAny;
}

export function applySafeIdempotentRewrites(serviceDir: string) {
  const drizzleDir = path.join(serviceDir, "drizzle");
  if (!fs.existsSync(drizzleDir)) return;

  for (const file of fs.readdirSync(drizzleDir)) {
    if (!file.endsWith(".sql")) continue;
    const sqlPath = path.join(drizzleDir, file);
    const origSql = fs.readFileSync(sqlPath, "utf8");
    const idempotentSql = origSql
      .replace(/CREATE SCHEMA(?!\s+IF NOT EXISTS)\s+"/g, 'CREATE SCHEMA IF NOT EXISTS "')
      .replace(/CREATE TABLE(?!\s+IF NOT EXISTS)\s+"/g, 'CREATE TABLE IF NOT EXISTS "');
    if (idempotentSql !== origSql) {
      fs.writeFileSync(sqlPath, idempotentSql, "utf8");
    }
  }
}

export async function ensureServiceMigrationsFallback(
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
  const snapshot = parseSqlToSnapshot(sqlContent, serviceName);
  fs.writeFileSync(
    path.join(drizzleDir, "meta", "0000_snapshot.json"),
    `${JSON.stringify(snapshot, null, 2)}\n`,
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
    const drizzleDir = path.join(svcDir, "drizzle");
    const journalPath = path.join(drizzleDir, "meta", "_journal.json");
    const schemaDir = path.join(svcDir, "src", "db", "schema");
    const svcSchemaName = svc === "gateway" ? "auth" : svc;

    // Upgrade path: if existing migrations exist but snapshot is missing, synthesize baseline snapshot first
    ensureBaselineSnapshot(svcDir, svcSchemaName);

    const hasMigrations =
      fs.existsSync(journalPath) &&
      (() => {
        try {
          const j = JSON.parse(fs.readFileSync(journalPath, "utf8"));
          return Array.isArray(j.entries) && j.entries.length > 0;
        } catch {
          return false;
        }
      })();

    let generateOutput = "";
    let generateErrOutput = "";

    try {
      const res = await execa("pnpm", ["exec", "drizzle-kit", "generate"], {
        cwd: svcDir,
        env: {
          ...process.env,
          NODE_OPTIONS: getNodeOptionsWithTsx(),
        },
        stdin: "ignore",
      });
      generateOutput = res.stdout ?? "";
      generateErrOutput = res.stderr ?? "";
    } catch (err: any) {
      generateOutput = err.stdout ?? "";
      generateErrOutput = err.stderr ?? "";
      const combined = `${generateOutput} ${generateErrOutput} ${err.message ?? ""}`;

      if (
        /created or renamed/i.test(combined) ||
        /rename.*column/i.test(combined) ||
        /rename.*table/i.test(combined) ||
        /❯/.test(combined)
      ) {
        throw new Error(
          `drizzle-kit requires confirmation for ambiguous schema changes in service '${svc}' (such as column/table renames or adding NOT NULL columns without defaults). Please provide a default value, make the column nullable, or use a custom migration.`,
        );
      }

      // If fresh service with no migrations, try fallback
      if (!hasMigrations && fs.existsSync(schemaDir)) {
        const fallbackOk = await ensureServiceMigrationsFallback(svcDir, svcSchemaName);
        if (fallbackOk) {
          applySafeIdempotentRewrites(svcDir);
          generated.push(svc);
          continue;
        }
      }

      const errMsg = err.stderr?.trim() || err.stdout?.trim() || err.message;
      throw new Error(`Failed to generate migrations for service '${svc}': ${errMsg}`);
    }

    const combinedOutput = `${generateOutput} ${generateErrOutput}`;
    if (
      /created or renamed/i.test(combinedOutput) ||
      /rename.*column/i.test(combinedOutput) ||
      /rename.*table/i.test(combinedOutput) ||
      /❯/.test(combinedOutput)
    ) {
      throw new Error(
        `drizzle-kit requires confirmation for ambiguous schema changes in service '${svc}' (such as column/table renames or adding NOT NULL columns without defaults). Please provide a default value, make the column nullable, or use a custom migration.`,
      );
    }

    if (!fs.existsSync(journalPath) && fs.existsSync(schemaDir)) {
      await ensureServiceMigrationsFallback(svcDir, svcSchemaName);
    }

    applySafeIdempotentRewrites(svcDir);
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
