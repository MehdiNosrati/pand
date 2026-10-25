import fs from "node:fs";
import path from "node:path";
import { loadPandConfig, resolveProjectPorts } from "@pand/config";
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
