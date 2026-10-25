import fs from "node:fs";
import path from "node:path";
import {
  ProjectNameRegex,
  computeBasePort,
  enableAppInConfigFile,
  loadPandConfig,
  resolveProjectPorts,
} from "@pands/config";
import { defineCommand } from "citty";
import { execa } from "execa";
import {
  renderTemplateDir,
  toHumanTitle,
  toPascalCase,
  toSnakeCase,
} from "../generators/template.js";
import {
  GLOBAL_ARGS_DEF,
  emitError,
  emitResult,
  getPlatformRootDir,
  resolveCwd,
} from "../output.js";
import { addServiceInternal } from "./add-service.js";
import { sdkGenInternal } from "./sdk-gen.js";

export interface ScaffoldAppOptions {
  rootDir: string;
  appName: "web" | "admin" | "ios" | "android";
}

export async function scaffoldClientApp(options: ScaffoldAppOptions): Promise<string | null> {
  const { rootDir, appName } = options;
  const platformRoot = getPlatformRootDir();
  const templateDir = path.join(platformRoot, "templates", appName);
  if (!fs.existsSync(templateDir)) {
    return null;
  }

  const { config, configPath } = await loadPandConfig(rootDir);
  enableAppInConfigFile(configPath, appName);
  const ports = resolveProjectPorts(config);
  const targetDir = path.join(rootDir, "apps", appName);

  const isLocalMonorepo = fs.existsSync(path.join(platformRoot, "packages", "config"));

  renderTemplateDir(templateDir, targetDir, {
    project: config.name,
    snakeProject: toSnakeCase(config.name),
    pascalProject: toPascalCase(config.name),
    displayName: config.displayName,
    bundleIdPrefix: config.bundleIdPrefix,
    basePort: ports.basePort,
    gatewayPort: ports.gatewayPort,
    webPort: ports.webPort,
    adminPort: ports.adminPort,
    platformRoot,
    isLocalMonorepo,
  });

  return targetDir;
}

export interface NewProjectOptions {
  cwd: string;
  name: string;
  minimal?: boolean;
  ios?: boolean;
  android?: boolean;
  skipInstall?: boolean;
}

export async function newProjectInternal(options: NewProjectOptions) {
  const { cwd, name } = options;
  if (!ProjectNameRegex.test(name)) {
    throw new Error(`Invalid project name "${name}". Must match ${ProjectNameRegex.toString()}`);
  }

  const projectDir = path.resolve(cwd, name);
  if (fs.existsSync(projectDir) && fs.readdirSync(projectDir).length > 0) {
    throw new Error(`Target directory already exists and is not empty: ${projectDir}`);
  }

  const basePort = computeBasePort(name);
  const displayName = toHumanTitle(name);
  const platformRoot = getPlatformRootDir();
  const projectTemplateDir = path.join(platformRoot, "templates", "project");

  const webEnabled = !options.minimal && fs.existsSync(path.join(platformRoot, "templates", "web"));
  const adminEnabled =
    !options.minimal && fs.existsSync(path.join(platformRoot, "templates", "admin"));
  const iosEnabled = Boolean(options.ios);
  const androidEnabled = Boolean(options.android);

  const isLocalMonorepo = fs.existsSync(path.join(platformRoot, "packages", "config"));

  renderTemplateDir(projectTemplateDir, projectDir, {
    project: name,
    snakeProject: toSnakeCase(name),
    pascalProject: toPascalCase(name),
    displayName,
    basePort,
    gatewayPort: basePort + 1,
    webPort: basePort + 2,
    adminPort: basePort + 3,
    postgresPort: basePort + 32,
    valkeyPort: basePort + 79,
    s3Port: basePort + 90,
    grafanaPort: basePort + 80,
    otlpHttpPort: basePort + 18,
    webEnabled,
    adminEnabled,
    iosEnabled,
    androidEnabled,
    platformRoot,
    isLocalMonorepo,
  });

  await addServiceInternal({
    rootDir: projectDir,
    serviceName: "core",
    portOffset: 10,
    skipInstall: true,
  });

  if (webEnabled) {
    await scaffoldClientApp({ rootDir: projectDir, appName: "web" });
  }
  if (adminEnabled) {
    await scaffoldClientApp({ rootDir: projectDir, appName: "admin" });
  }
  if (iosEnabled) {
    await scaffoldClientApp({ rootDir: projectDir, appName: "ios" });
  }
  if (androidEnabled) {
    await scaffoldClientApp({ rootDir: projectDir, appName: "android" });
  }

  if (!options.skipInstall) {
    await execa("git", ["init"], { cwd: projectDir });
    await execa("pnpm", ["install"], { cwd: projectDir });
    await sdkGenInternal({ rootDir: projectDir }).catch(() => {});
    await execa("pnpm", ["biome", "check", "--write", "."], { cwd: projectDir }).catch(() => {});
  }

  return {
    name,
    projectDir,
    basePort,
    services: ["core"],
    apps: {
      web: webEnabled,
      admin: adminEnabled,
      ios: iosEnabled,
      android: androidEnabled,
    },
  };
}

export const newCommand = defineCommand({
  meta: {
    name: "new",
    description: "Create a new Pand project in ./<name>",
  },
  args: {
    ...GLOBAL_ARGS_DEF,
    name: {
      type: "positional",
      description: "Project slug (lowercase, e.g. todo)",
      required: true,
    },
    minimal: {
      type: "boolean",
      description: "Create backend + SDK only (skip web/admin apps)",
      default: false,
    },
    ios: {
      type: "boolean",
      description: "Enable and scaffold native SwiftUI iOS app",
      default: false,
    },
    android: {
      type: "boolean",
      description: "Enable and scaffold native Jetpack Compose Android app",
      default: false,
    },
  },
  async run({ args }) {
    try {
      const cwd = resolveCwd(args);
      const result = await newProjectInternal({
        cwd,
        name: String(args.name),
        minimal: Boolean(args.minimal),
        ios: Boolean(args.ios),
        android: Boolean(args.android),
      });
      emitResult(
        args,
        result,
        `Created Pand project "${result.name}" at ${result.projectDir} (basePort: ${result.basePort})`,
      );
    } catch (err) {
      emitError(args, err);
    }
  },
});

export const addAppCommand = defineCommand({
  meta: {
    name: "app",
    description: "Enable and scaffold a client app (web | admin | ios | android)",
  },
  args: {
    ...GLOBAL_ARGS_DEF,
    target: {
      type: "positional",
      description: "App type: web | admin | ios | android",
      required: true,
    },
  },
  async run({ args }) {
    try {
      const cwd = resolveCwd(args);
      const { rootDir } = await loadPandConfig(cwd);
      const target = String(args.target) as "web" | "admin" | "ios" | "android";
      if (!["web", "admin", "ios", "android"].includes(target)) {
        throw new Error(`Invalid app target "${target}". Expected web | admin | ios | android.`);
      }
      const dir = await scaffoldClientApp({ rootDir, appName: target });
      if (target === "web" || target === "admin") {
        await execa("pnpm", ["install"], { cwd: rootDir });
      }
      await execa("pnpm", ["biome", "check", "--write", "."], { cwd: rootDir }).catch(() => {});
      emitResult(args, { app: target, dir }, `Enabled and scaffolded app "${target}"`);
    } catch (err) {
      emitError(args, err);
    }
  },
});
