import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { type PandConfig, PandConfigSchema } from "./schema.js";

export interface LoadedPandConfig {
  config: PandConfig;
  configPath: string;
  rootDir: string;
}

export function findPandConfigPath(startDir: string = process.cwd()): string | null {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, "pand.config.ts");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export async function loadPandConfig(cwd: string = process.cwd()): Promise<LoadedPandConfig> {
  const configPath = findPandConfigPath(cwd);
  if (!configPath) {
    throw new Error(`Could not find pand.config.ts starting from ${cwd}`);
  }
  const rootDir = path.dirname(configPath);
  const selfPath = fileURLToPath(new URL("./index.js", import.meta.url));
  const jiti = createJiti(import.meta.url, {
    moduleCache: false,
    fsCache: false,
    alias: {
      "@pands/config": selfPath,
    },
  });
  const loaded = await jiti.import(configPath, { default: true });
  const config = PandConfigSchema.parse(loaded);
  return { config, configPath, rootDir };
}

export function addServiceToConfigSource(
  source: string,
  serviceName: string,
  options: { portOffset: number; db?: boolean; memoryMb?: number },
): string {
  const db = options.db ?? true;
  const entry = `    ${serviceName}: { portOffset: ${options.portOffset}, db: ${db} },`;
  if (source.includes(`${serviceName}:`)) {
    return source;
  }
  const servicesRegex = /(services\s*:\s*\{)/;
  if (!servicesRegex.test(source)) {
    throw new Error("Could not find `services: {` block in pand.config.ts");
  }
  return source.replace(servicesRegex, `$1\n${entry}`);
}

export function addServiceToConfigFile(
  configPath: string,
  serviceName: string,
  options: { portOffset: number; db?: boolean; memoryMb?: number },
): void {
  const current = fs.readFileSync(configPath, "utf8");
  const updated = addServiceToConfigSource(current, serviceName, options);
  fs.writeFileSync(configPath, updated, "utf8");
}

export function enableAppInConfigFile(
  configPath: string,
  appName: "web" | "admin" | "ios" | "android",
): void {
  const current = fs.readFileSync(configPath, "utf8");
  const appRegex = new RegExp(`(${appName}\\s*:\\s*)(false|true)`);
  if (appRegex.test(current)) {
    fs.writeFileSync(configPath, current.replace(appRegex, "$1true"), "utf8");
    return;
  }
  const appsBlockRegex = /(apps\s*:\s*\{)/;
  if (appsBlockRegex.test(current)) {
    fs.writeFileSync(
      configPath,
      current.replace(appsBlockRegex, `$1\n    ${appName}: true,`),
      "utf8",
    );
  }
}

export function getGlobalConfigDir(): string {
  if (process.env.PAND_CONFIG_DIR) {
    fs.mkdirSync(process.env.PAND_CONFIG_DIR, { recursive: true });
    return process.env.PAND_CONFIG_DIR;
  }
  const preferred = path.join(os.homedir(), ".config", "pand");
  try {
    fs.mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    const fallback = path.join(os.homedir(), ".pand");
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}
