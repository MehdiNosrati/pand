import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  addEntityInternal,
  addServiceInternal,
  checkProjectInternal,
  checkUsageInternal,
  dbGenerateInternal,
  dbMigrateInternal,
  deployInternal,
  getCliVersion,
  queryLogsInternal,
  queryMetricsInternal,
  queryTracesInternal,
  resolveDevDatabaseUrl,
  sdkGenInternal,
} from "@pands/cli";
import { loadPandConfig, resolveProjectPorts } from "@pands/config";
import pg from "pg";
import { z } from "zod";

const FORBIDDEN_SQL_REGEX =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY)\b/i;

export async function executeReadOnlySql(options: {
  sql: string;
  databaseUrl: string;
}): Promise<{ rows: unknown[]; rowCount: number }> {
  if (FORBIDDEN_SQL_REGEX.test(options.sql)) {
    throw new Error(
      "Guardrail violation: pand_db_query_readonly rejects mutating SQL (INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE).",
    );
  }
  const client = new pg.Client({ connectionString: options.databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '5000ms'");
    const res = await client.query(options.sql);
    await client.query("ROLLBACK");
    return {
      rows: res.rows,
      rowCount: res.rowCount ?? res.rows.length,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

export interface PandMcpToolHandlers {
  pand_project_info: (args: { cwd?: string }) => Promise<any>;
  pand_openapi_get: (args: { cwd?: string; service?: string }) => Promise<any>;
  pand_add_service: (args: { cwd?: string; name: string }) => Promise<any>;
  pand_add_entity: (args: {
    cwd?: string;
    service: string;
    entity: string;
    fields: string;
    web?: boolean;
    ios?: boolean;
    android?: boolean;
  }) => Promise<any>;
  pand_sdk_gen: (args: { cwd?: string }) => Promise<any>;
  pand_check: (args: { cwd?: string }) => Promise<any>;
  pand_db_migrate: (args: {
    cwd?: string;
    env: "dev" | "prod";
    confirmProd?: boolean;
    databaseUrl?: string;
  }) => Promise<any>;
  pand_db_query_readonly: (args: {
    cwd?: string;
    env: "dev" | "prod";
    sql: string;
    databaseUrl?: string;
  }) => Promise<any>;
  pand_logs_query: (args: {
    project?: string;
    service?: string;
    since?: string;
    level?: string;
    limit?: number;
  }) => Promise<any>;
  pand_metrics_query: (args: { project?: string; window?: string }) => Promise<any>;
  pand_traces_query: (args: {
    project?: string;
    traceId?: string;
    slowOnly?: boolean;
    errorsOnly?: boolean;
  }) => Promise<any>;
  pand_usage_check: () => Promise<any>;
  pand_deploy: (args: {
    cwd?: string;
    env: string;
    confirmProd?: boolean;
    skipTests?: boolean;
  }) => Promise<any>;
}

export function createPandMcpHandlers(defaultCwd: string = process.cwd()): PandMcpToolHandlers {
  const resolveDir = (cwd?: string) => (cwd ? path.resolve(cwd) : defaultCwd);

  return {
    async pand_project_info({ cwd }) {
      const rootDir = resolveDir(cwd);
      const { config } = await loadPandConfig(rootDir);
      const ports = resolveProjectPorts(config);
      return {
        config,
        ports,
        urls: {
          devGateway: `http://localhost:${ports.gatewayPort}`,
          devWeb: `http://localhost:${ports.webPort}`,
          devAdmin: `http://localhost:${ports.adminPort}`,
          prodWeb: `https://${config.name}.${config.domain}`,
          prodAdmin: `https://${config.name}-admin.${config.domain}`,
        },
      };
    },

    async pand_openapi_get({ cwd }) {
      const rootDir = resolveDir(cwd);
      const contractsPath = path.join(rootDir, "packages", "contracts", "openapi.json");
      if (!fs.existsSync(contractsPath)) {
        await sdkGenInternal({ rootDir });
      }
      return JSON.parse(fs.readFileSync(contractsPath, "utf8"));
    },

    async pand_add_service({ cwd, name }) {
      const rootDir = resolveDir(cwd);
      return addServiceInternal({ rootDir, serviceName: name, skipInstall: true });
    },

    async pand_add_entity({ cwd, service, entity, fields, web, ios, android }) {
      const rootDir = resolveDir(cwd);
      const entityRes = await addEntityInternal({
        rootDir,
        service,
        entity,
        fieldsDsl: fields,
        web,
        ios,
        android,
      });
      await dbGenerateInternal({ rootDir, service });
      await sdkGenInternal({ rootDir });
      return entityRes;
    },

    async pand_sdk_gen({ cwd }) {
      const rootDir = resolveDir(cwd);
      return sdkGenInternal({ rootDir });
    },

    async pand_check({ cwd }) {
      const rootDir = resolveDir(cwd);
      return checkProjectInternal(rootDir);
    },

    async pand_db_migrate({ cwd, env, confirmProd, databaseUrl }) {
      if (env === "prod" && !confirmProd) {
        throw new Error(
          "Guardrail violation: pand_db_migrate with env='prod' requires confirmProd: true",
        );
      }
      const rootDir = resolveDir(cwd);
      return dbMigrateInternal({ rootDir, env, databaseUrl });
    },

    async pand_db_query_readonly({ cwd, sql, databaseUrl }) {
      const rootDir = resolveDir(cwd);
      const dbUrl = databaseUrl ?? (await resolveDevDatabaseUrl(rootDir));
      return executeReadOnlySql({ sql, databaseUrl: dbUrl });
    },

    async pand_logs_query(args) {
      return queryLogsInternal(args);
    },

    async pand_metrics_query(args) {
      return queryMetricsInternal(args);
    },

    async pand_traces_query(args) {
      return queryTracesInternal({
        project: args.project,
        traceId: args.traceId,
        slow: args.slowOnly,
        errors: args.errorsOnly,
      });
    },

    async pand_usage_check() {
      return checkUsageInternal();
    },

    async pand_deploy({ cwd, env, confirmProd, skipTests }) {
      if (env === "prod" && !confirmProd) {
        throw new Error(
          "Guardrail violation: pand_deploy with env='prod' requires confirmProd: true",
        );
      }
      const rootDir = resolveDir(cwd);
      return deployInternal({ rootDir, env, skipTests });
    },
  };
}

export function createPandMcpServer(defaultCwd: string = process.cwd()) {
  const server = new McpServer({
    name: "pand-mcp",
    version: getCliVersion(),
  });
  const handlers = createPandMcpHandlers(defaultCwd);

  const registerJsonTool = (
    name: keyof PandMcpToolHandlers,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
  ) => {
    server.tool(name, description, schema, async (args: any) => {
      try {
        const res = await (handlers[name] as any)(args);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(res, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: err instanceof Error ? err.message : String(err),
            },
          ],
        };
      }
    });
  };

  registerJsonTool("pand_project_info", "Inspect pand.config.ts, services, ports, and URLs", {
    cwd: z.string().optional(),
  });
  registerJsonTool("pand_openapi_get", "Return merged OpenAPI 3.1 contract", {
    cwd: z.string().optional(),
    service: z.string().optional(),
  });
  registerJsonTool("pand_add_service", "Add a new microservice to the Pand project", {
    cwd: z.string().optional(),
    name: z.string(),
  });
  registerJsonTool(
    "pand_add_entity",
    "Add an entity, generate Drizzle migration, and regenerate SDK",
    {
      cwd: z.string().optional(),
      service: z.string(),
      entity: z.string(),
      fields: z.string(),
      web: z.boolean().optional(),
      ios: z.boolean().optional(),
      android: z.boolean().optional(),
    },
  );
  registerJsonTool("pand_sdk_gen", "Regenerate TypeScript, Swift, and Kotlin SDKs", {
    cwd: z.string().optional(),
  });
  registerJsonTool("pand_check", "Run lint, typecheck, contract drift check, and Vitest suite", {
    cwd: z.string().optional(),
  });
  registerJsonTool(
    "pand_db_migrate",
    "Apply forward Drizzle migrations (requires confirmProd for prod)",
    {
      cwd: z.string().optional(),
      env: z.enum(["dev", "prod"]),
      confirmProd: z.boolean().optional(),
    },
  );
  registerJsonTool(
    "pand_db_query_readonly",
    "Execute a read-only SQL query inside BEGIN READ ONLY ... ROLLBACK with 5s timeout",
    {
      cwd: z.string().optional(),
      env: z.enum(["dev", "prod"]),
      sql: z.string(),
    },
  );
  registerJsonTool("pand_logs_query", "Query structured Loki log entries", {
    project: z.string().optional(),
    service: z.string().optional(),
    since: z.string().optional(),
    level: z.string().optional(),
    limit: z.number().optional(),
  });
  registerJsonTool("pand_metrics_query", "Query Prometheus RED metrics", {
    project: z.string().optional(),
    window: z.string().optional(),
  });
  registerJsonTool("pand_traces_query", "Query Tempo distributed trace spans", {
    project: z.string().optional(),
    traceId: z.string().optional(),
    slowOnly: z.boolean().optional(),
    errorsOnly: z.boolean().optional(),
  });
  registerJsonTool(
    "pand_usage_check",
    "Check Box resource headroom, R2 usage, and PostHog quota",
    {},
  );
  registerJsonTool("pand_deploy", "Deploy project to Box (requires confirmProd for prod)", {
    cwd: z.string().optional(),
    env: z.string(),
    confirmProd: z.boolean().optional(),
  });

  return { server, handlers };
}

export async function startPandMcpStdioServer(defaultCwd: string = process.cwd()) {
  const { server } = createPandMcpServer(defaultCwd);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
