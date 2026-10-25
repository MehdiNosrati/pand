import fs from "node:fs";
import path from "node:path";
import {
  type PandConfig,
  type ProjectPorts,
  loadPandConfig,
  resolveProjectPorts,
} from "@pand/config";
import chokidar from "chokidar";
import { defineCommand } from "citty";
import { consola } from "consola";
import { execa } from "execa";
import { toSnakeCase } from "../generators/template.js";
import {
  GLOBAL_ARGS_DEF,
  emitError,
  emitResult,
  getPlatformRootDir,
  resolveCwd,
} from "../output.js";
import { dbMigrateInternal, resolveDevDatabaseUrl } from "./db.js";
import { sdkGenInternal } from "./sdk-gen.js";

export interface AppSpawnSpec {
  app: "web" | "admin";
  cmd: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  url: string;
}

export function buildAppDevSpawns(
  config: PandConfig,
  ports: ProjectPorts,
  rootDir = "",
): AppSpawnSpec[] {
  const spawns: AppSpawnSpec[] = [];

  if (config.apps?.web) {
    spawns.push({
      app: "web",
      cmd: "pnpm",
      args: ["exec", "vite", "--host", "localhost", "--port", String(ports.webPort)],
      cwd: path.join(rootDir, "apps", "web"),
      env: {
        PORT: String(ports.webPort),
        GATEWAY_PORT: String(ports.gatewayPort),
      },
      url: `http://localhost:${ports.webPort}`,
    });
  }

  if (config.apps?.admin) {
    spawns.push({
      app: "admin",
      cmd: "pnpm",
      args: ["exec", "vite", "--host", "localhost", "--port", String(ports.adminPort)],
      cwd: path.join(rootDir, "apps", "admin"),
      env: {
        PORT: String(ports.adminPort),
        GATEWAY_PORT: String(ports.gatewayPort),
      },
      url: `http://localhost:${ports.adminPort}`,
    });
  }

  return spawns;
}

export async function writeDevArtifacts(rootDir: string) {
  const { config } = await loadPandConfig(rootDir);
  const ports = resolveProjectPorts(config);
  const pandDir = path.join(rootDir, ".pand");
  fs.mkdirSync(pandDir, { recursive: true });

  const platformRoot = getPlatformRootDir();
  const baseComposePath = path.join(platformRoot, "infra", "dev", "docker-compose.yml");
  const composeContent = fs.readFileSync(baseComposePath, "utf8");
  const targetComposePath = path.join(pandDir, "docker-compose.dev.yml");
  fs.writeFileSync(targetComposePath, composeContent, "utf8");

  const dbName = `${toSnakeCase(config.name)}_dev`;
  const serviceUrls: Record<string, string> = {};
  for (const [svc, port] of Object.entries(ports.services)) {
    serviceUrls[svc] = `http://localhost:${port}`;
  }

  const devEnvLines = [
    "NODE_ENV=development",
    `PAND_PROJECT=${config.name}`,
    "PAND_ENV=dev",
    `PAND_PG_PORT=${ports.postgresPort}`,
    `PAND_VALKEY_PORT=${ports.valkeyPort}`,
    `PAND_GRAFANA_PORT=${ports.grafanaPort}`,
    `PAND_OTLP_PORT=${ports.otlpHttpPort}`,
    `PAND_DB_NAME=${dbName}`,
    `DATABASE_URL=postgres://pand:pand@localhost:${ports.postgresPort}/${dbName}`,
    "PAND_INTERNAL_SECRET=dev-internal-secret-must-be-at-least-32-bytes-long",
    "BETTER_AUTH_SECRET=dev-better-auth-secret-must-be-at-least-32-bytes-long",
    `BETTER_AUTH_URL=http://localhost:${ports.webPort}`,
    `PAND_PUBLIC_WEB_URL=http://localhost:${ports.webPort}`,
    `PAND_PUBLIC_ADMIN_URL=http://localhost:${ports.adminPort}`,
    `PAND_SERVICE_URLS='${JSON.stringify(serviceUrls)}'`,
  ];

  const devEnvPath = path.join(pandDir, "dev.env");
  fs.writeFileSync(devEnvPath, `${devEnvLines.join("\n")}\n`, "utf8");

  return {
    composePath: targetComposePath,
    devEnvPath,
    ports,
    serviceUrls,
  };
}

export const devCommand = defineCommand({
  meta: {
    name: "dev",
    description:
      "Start local Docker infra, run migrations, generate SDK, and run all services + web/admin with hot reload",
  },
  args: {
    ...GLOBAL_ARGS_DEF,
    dryRun: {
      type: "boolean",
      description:
        "Prepare dev environment, migrate, and generate SDK without blocking on watch processes",
      default: false,
    },
  },
  async run({ args }) {
    try {
      const cwd = resolveCwd(args);
      const { config, rootDir } = await loadPandConfig(cwd);
      const artifacts = await writeDevArtifacts(rootDir);

      await execa(
        "docker",
        ["compose", "-f", artifacts.composePath, "--env-file", artifacts.devEnvPath, "up", "-d"],
        { cwd: rootDir },
      );

      const databaseUrl = await resolveDevDatabaseUrl(rootDir);
      await dbMigrateInternal({ rootDir, databaseUrl });
      await sdkGenInternal({ rootDir });

      if (args.dryRun) {
        emitResult(
          args,
          {
            project: config.name,
            ports: artifacts.ports,
            databaseUrl,
          },
          `Prepared dev environment for ${config.name}`,
        );
        return;
      }

      consola.info(`Starting gateway (:${artifacts.ports.gatewayPort}) and services...`);
      const children: Array<ReturnType<typeof execa>> = [];

      const commonEnv = {
        ...process.env,
        NODE_ENV: "development",
        PAND_PROJECT: config.name,
        PAND_ENV: "dev",
        DATABASE_URL: databaseUrl,
        PAND_INTERNAL_SECRET: "dev-internal-secret-must-be-at-least-32-bytes-long",
        BETTER_AUTH_SECRET: "dev-better-auth-secret-must-be-at-least-32-bytes-long",
        BETTER_AUTH_URL: `http://localhost:${artifacts.ports.webPort}`,
        PAND_PUBLIC_WEB_URL: `http://localhost:${artifacts.ports.webPort}`,
        PAND_PUBLIC_ADMIN_URL: `http://localhost:${artifacts.ports.adminPort}`,
        PAND_SERVICE_URLS: JSON.stringify(artifacts.serviceUrls),
      };

      // Spawn gateway
      children.push(
        execa("pnpm", ["exec", "tsx", "watch", "src/index.ts"], {
          cwd: path.join(rootDir, "services", "gateway"),
          env: { ...commonEnv, PAND_SERVICE: "gateway", PORT: String(artifacts.ports.gatewayPort) },
          stdio: "inherit",
        }),
      );

      // Spawn each microservice
      for (const [svc, port] of Object.entries(artifacts.ports.services)) {
        children.push(
          execa("pnpm", ["exec", "tsx", "watch", "src/index.ts"], {
            cwd: path.join(rootDir, "services", svc),
            env: { ...commonEnv, PAND_SERVICE: svc, PORT: String(port) },
            stdio: "inherit",
          }),
        );
      }

      // Spawn web and admin apps if enabled
      const appSpawns = buildAppDevSpawns(config, artifacts.ports, rootDir);
      for (const app of appSpawns) {
        if (fs.existsSync(app.cwd)) {
          children.push(
            execa(app.cmd, app.args, {
              cwd: app.cwd,
              env: { ...commonEnv, ...app.env },
              stdio: "inherit",
            }),
          );
        }
      }

      if (config.apps?.web && fs.existsSync(path.join(rootDir, "apps", "web"))) {
        consola.info(`Web app running at http://localhost:${artifacts.ports.webPort}`);
      }
      if (config.apps?.admin && fs.existsSync(path.join(rootDir, "apps", "admin"))) {
        consola.info(`Admin app running at http://localhost:${artifacts.ports.adminPort}`);
      }

      // Watch route files for OpenAPI / SDK regeneration
      const watcher = chokidar.watch(path.join(rootDir, "services/*/src/routes/**"), {
        ignoreInitial: true,
      });
      watcher.on("change", () => {
        void sdkGenInternal({ rootDir }).catch((err) =>
          consola.warn("SDK auto-regen failed:", err),
        );
      });

      const cleanup = () => {
        void watcher.close();
        for (const child of children) {
          child.kill("SIGTERM");
        }
      };

      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      await Promise.all(children);
    } catch (err) {
      emitError(args, err);
    }
  },
});
