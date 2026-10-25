import fs from "node:fs";
import path from "node:path";
import {
  ServiceNameRegex,
  addServiceToConfigFile,
  loadPandConfig,
  resolveProjectPorts,
} from "@pands/config";
import { defineCommand } from "citty";
import { execa } from "execa";
import {
  renderTemplateDir,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
} from "../generators/template.js";
import {
  GLOBAL_ARGS_DEF,
  emitError,
  emitResult,
  getCliVersion,
  getPlatformRootDir,
  resolveCwd,
} from "../output.js";

export interface AddServiceInternalOptions {
  rootDir: string;
  serviceName: string;
  portOffset?: number;
  skipInstall?: boolean;
}

export async function addServiceInternal(options: AddServiceInternalOptions) {
  const { rootDir, serviceName } = options;
  if (!ServiceNameRegex.test(serviceName)) {
    throw new Error(
      `Invalid service name "${serviceName}". Must match ${ServiceNameRegex.toString()}`,
    );
  }

  const { config, configPath } = await loadPandConfig(rootDir);
  if (config.services[serviceName] && fs.existsSync(path.join(rootDir, "services", serviceName))) {
    throw new Error(`Service "${serviceName}" already exists in pand.config.ts`);
  }

  const existingOffsets = Object.values(config.services).map((s) => s.portOffset);
  const portOffset = options.portOffset ?? Math.max(9, ...existingOffsets) + 1;

  addServiceToConfigFile(configPath, serviceName, { portOffset, db: true });
  const reloaded = await loadPandConfig(rootDir);
  const ports = resolveProjectPorts(reloaded.config);
  const servicePort = ports.services[serviceName] ?? ports.basePort + portOffset;

  const platformRoot = getPlatformRootDir();
  const templateDir = path.join(platformRoot, "templates", "service");
  const targetDir = path.join(rootDir, "services", serviceName);

  const isLocalMonorepo = fs.existsSync(path.join(platformRoot, "packages", "config"));
  const pandVersion = reloaded.config.pandVersion ?? getCliVersion();

  renderTemplateDir(templateDir, targetDir, {
    project: reloaded.config.name,
    snakeProject: toSnakeCase(reloaded.config.name),
    displayName: reloaded.config.displayName,
    service: serviceName,
    camelService: toCamelCase(serviceName),
    pascalService: toPascalCase(serviceName),
    servicePort,
    platformRoot,
    isLocalMonorepo,
    pandVersion,
  });

  if (!options.skipInstall) {
    await execa("pnpm", ["install"], { cwd: rootDir });
    await execa("pnpm", ["biome", "check", "--write", "."], { cwd: rootDir }).catch(() => {});
  }

  return {
    service: serviceName,
    portOffset,
    port: servicePort,
    dir: targetDir,
  };
}

export const addServiceCommand = defineCommand({
  meta: {
    name: "service",
    description: "Add a backend microservice to the current Pand project",
  },
  args: {
    ...GLOBAL_ARGS_DEF,
    name: {
      type: "positional",
      description: "Service name (lowercase alphanumeric, e.g. billing)",
      required: true,
    },
  },
  async run({ args }) {
    try {
      const cwd = resolveCwd(args);
      const { rootDir } = await loadPandConfig(cwd);
      const result = await addServiceInternal({
        rootDir,
        serviceName: String(args.name),
      });
      emitResult(
        args,
        result,
        `Added service "${result.service}" on port ${result.port} (${result.dir})`,
      );
    } catch (err) {
      emitError(args, err);
    }
  },
});
