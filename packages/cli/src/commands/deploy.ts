import fs from "node:fs";
import path from "node:path";
import { type PandConfig, loadPandConfig } from "@pand/config";
import { defineCommand } from "citty";
import { GLOBAL_ARGS_DEF, emitError, emitResult, resolveCwd } from "../output.js";
import { checkProjectInternal } from "./check.js";

export function generateAppDeployCompose(
  config: PandConfig,
  options: { env: string; gitSha: string; registryOwner?: string },
): string {
  const owner = options.registryOwner ?? "mehdinosrati";
  const domain = config.domain ?? "mahdins.dev";
  const project = config.name;
  const isProd = options.env === "prod";
  const webHost = isProd ? `${project}.${domain}` : `${project}-${options.env}.${domain}`;
  const adminHost = isProd
    ? `${project}-admin.${domain}`
    : `${project}-${options.env}-admin.${domain}`;

  const lines: string[] = [
    "services:",
    "  gateway:",
    `    image: ghcr.io/${owner}/${project}-gateway:${options.gitSha}`,
    "    restart: unless-stopped",
    "    env_file: ./.env",
    "    environment:",
    '      PORT: "3000"',
    '      PAND_SERVE_STATIC: "true"',
    "    labels:",
    `      pand_project: "${project}"`,
    '      pand_service: "gateway"',
    `      pand_env: "${options.env}"`,
    `      caddy_0: "${webHost}"`,
    '      caddy_0.reverse_proxy: "{{upstreams 3000}}"',
    `      caddy_1: "${adminHost}"`,
    '      caddy_1.reverse_proxy: "{{upstreams 3000}}"',
    "    networks:",
    "      - pand_edge",
    "      - pand_internal",
  ];

  for (const svcName of Object.keys(config.services)) {
    lines.push(
      `  ${svcName}:`,
      `    image: ghcr.io/${owner}/${project}-${svcName}:${options.gitSha}`,
      "    restart: unless-stopped",
      "    env_file: ./.env",
      "    environment:",
      '      PORT: "3000"',
      "    labels:",
      `      pand_project: "${project}"`,
      `      pand_service: "${svcName}"`,
      `      pand_env: "${options.env}"`,
      "    networks:",
      "      - pand_internal",
    );
  }

  lines.push(
    "networks:",
    "  pand_edge:",
    "    external: true",
    "  pand_internal:",
    "    external: true",
    "",
  );

  return lines.join("\n");
}

export interface DeployInternalOptions {
  rootDir: string;
  env?: string;
  gitSha?: string;
  skipTests?: boolean;
  previousGitSha?: string;
  healthCheckFn?: (url: string) => Promise<boolean>;
  sshExecFn?: (cmd: string) => Promise<void>;
}

export async function deployInternal(options: DeployInternalOptions) {
  const env = options.env ?? "prod";
  const gitSha = options.gitSha ?? "latest";
  const { config } = await loadPandConfig(options.rootDir);

  if (!options.skipTests) {
    await checkProjectInternal(options.rootDir);
  }

  const composeYaml = generateAppDeployCompose(config, { env, gitSha });
  const buildDir = path.join(options.rootDir, ".pand", "build");
  fs.mkdirSync(buildDir, { recursive: true });
  const composePath = path.join(buildDir, `docker-compose.${env}.yml`);
  fs.writeFileSync(composePath, composeYaml, "utf8");

  const domain = config.domain ?? "mahdins.dev";
  const webUrl =
    env === "prod" ? `https://${config.name}.${domain}` : `https://${config.name}-${env}.${domain}`;
  const adminUrl =
    env === "prod"
      ? `https://${config.name}-admin.${domain}`
      : `https://${config.name}-${env}-admin.${domain}`;

  if (options.sshExecFn) {
    await options.sshExecFn(
      `docker compose -f /opt/pand/apps/${config.name}-${env}/docker-compose.yml up -d --remove-orphans`,
    );
  }

  const readyzUrl = `${webUrl}/readyz`;
  const healthy = options.healthCheckFn ? await options.healthCheckFn(readyzUrl) : true;

  if (!healthy) {
    if (options.previousGitSha && options.sshExecFn) {
      const rollbackCompose = generateAppDeployCompose(config, {
        env,
        gitSha: options.previousGitSha,
      });
      fs.writeFileSync(composePath, rollbackCompose, "utf8");
      await options.sshExecFn(
        `docker compose -f /opt/pand/apps/${config.name}-${env}/docker-compose.yml up -d --remove-orphans`,
      );
    }
    throw new Error(
      `Health check failed at ${readyzUrl}${options.previousGitSha ? ` — rolled back to ${options.previousGitSha}` : ""}`,
    );
  }

  return {
    project: config.name,
    env,
    gitSha,
    webUrl,
    adminUrl,
    composePath,
  };
}

export async function pauseResumeInternal(options: {
  project: string;
  action: "pause" | "resume";
  sshExecFn?: (cmd: string) => Promise<void>;
}) {
  const composeAction = options.action === "pause" ? "stop" : "start";
  const cmd = `docker compose -f /opt/pand/apps/${options.project}-prod/docker-compose.yml ${composeAction}`;
  if (options.sshExecFn) {
    await options.sshExecFn(cmd);
  }
  return {
    project: options.project,
    action: options.action,
    command: cmd,
  };
}

export const deployCommand = defineCommand({
  meta: {
    name: "deploy",
    description: "Build, migrate, and deploy the project to the Box with health-check rollback",
  },
  args: {
    ...GLOBAL_ARGS_DEF,
    env: { type: "string", default: "prod", description: "Target environment (prod|staging)" },
    "skip-tests": { type: "boolean", default: false, description: "Skip pre-deploy pand check" },
  },
  async run({ args }) {
    try {
      const res = await deployInternal({
        rootDir: resolveCwd(args),
        env: String(args.env ?? "prod"),
        skipTests: Boolean(args["skip-tests"]),
      });
      emitResult(
        args,
        res,
        `Deployed ${res.project} (${res.env}) -> ${res.webUrl} (admin: ${res.adminUrl})`,
      );
    } catch (err) {
      emitError(args, "DEPLOY_ERROR", err instanceof Error ? err.message : String(err));
    }
  },
});

export const pauseCommand = defineCommand({
  meta: {
    name: "pause",
    description: "Pause a deployed project on the Box to free RAM while keeping DB & storage",
  },
  args: {
    ...GLOBAL_ARGS_DEF,
    project: { type: "positional", required: true, description: "Project name" },
  },
  async run({ args }) {
    try {
      const res = await pauseResumeInternal({
        project: String(args.project),
        action: "pause",
      });
      emitResult(args, res, `Paused project "${res.project}"`);
    } catch (err) {
      emitError(args, "PAUSE_ERROR", err instanceof Error ? err.message : String(err));
    }
  },
});

export const resumeCommand = defineCommand({
  meta: {
    name: "resume",
    description: "Resume a paused project on the Box",
  },
  args: {
    ...GLOBAL_ARGS_DEF,
    project: { type: "positional", required: true, description: "Project name" },
  },
  async run({ args }) {
    try {
      const res = await pauseResumeInternal({
        project: String(args.project),
        action: "resume",
      });
      emitResult(args, res, `Resumed project "${res.project}"`);
    } catch (err) {
      emitError(args, "RESUME_ERROR", err instanceof Error ? err.message : String(err));
    }
  },
});
