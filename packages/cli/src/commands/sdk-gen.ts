import fs from "node:fs";
import path from "node:path";
import { loadPandConfig } from "@pand/config";
import { type ServiceOpenApiInput, mergeServiceOpenApiSpecs } from "@pand/gateway";
import * as sdkGenPkg from "@pand/sdk-gen";
import { defineCommand } from "citty";
import { createJiti } from "jiti";
import { GLOBAL_ARGS_DEF, emitError, emitResult, resolveCwd } from "../output.js";

export interface SdkGenOptions {
  rootDir: string;
  checkOnly?: boolean;
}

export async function sdkGenInternal(options: SdkGenOptions) {
  const { config } = await loadPandConfig(options.rootDir);
  const jiti = createJiti(import.meta.url, {
    moduleCache: false,
    fsCache: false,
  });

  const serviceSpecs: ServiceOpenApiInput[] = [];

  for (const serviceName of Object.keys(config.services)) {
    const appPath = path.join(options.rootDir, "services", serviceName, "src", "app.ts");
    if (!fs.existsSync(appPath)) {
      continue;
    }
    const mod = (await jiti.import(appPath)) as Record<string, any>;
    const app = mod.default ?? mod.app;
    if (!app || typeof app.request !== "function") {
      throw new Error(`Service "${serviceName}" src/app.ts must export a Hono app`);
    }
    const res = await app.request("/openapi.json");
    if (!res.ok) {
      throw new Error(`Failed to fetch /openapi.json from in-memory service "${serviceName}"`);
    }
    const spec = (await res.json()) as Record<string, any>;
    serviceSpecs.push({ service: serviceName, spec });
  }

  const mergedSpec = mergeServiceOpenApiSpecs(serviceSpecs, {
    title: `${config.displayName} API`,
    version: config.pandVersion,
  });

  const tsResult = await sdkGenPkg.generateTypeScriptSdk({
    openApiSpec: mergedSpec,
    outDir: options.rootDir,
    checkOnly: options.checkOnly,
  });

  // If Swift / Kotlin SDK generators are present and apps.ios / apps.android enabled
  const maybeSwiftGen = (sdkGenPkg as any).generateSwiftSdk;
  if (!options.checkOnly && config.apps.ios && typeof maybeSwiftGen === "function") {
    await maybeSwiftGen({
      openApiSpec: mergedSpec,
      outDir: options.rootDir,
      projectName: config.name,
    });
  }

  const maybeKotlinGen = (sdkGenPkg as any).generateKotlinSdk;
  if (!options.checkOnly && config.apps.android && typeof maybeKotlinGen === "function") {
    await maybeKotlinGen({
      openApiSpec: mergedSpec,
      outDir: options.rootDir,
      projectName: config.name,
      bundleIdPrefix: config.bundleIdPrefix,
    });
  }

  return {
    contractsPath: tsResult.contractsPath,
    schemaPath: tsResult.schemaPath,
    drifted: tsResult.drifted,
    pathCount: Object.keys(mergedSpec.paths ?? {}).length,
  };
}

export const sdkCommand = defineCommand({
  meta: {
    name: "sdk",
    description: "SDK generation commands",
  },
  subCommands: {
    gen: defineCommand({
      meta: {
        name: "gen",
        description: "Merge service OpenAPI specs and generate client SDKs",
      },
      args: {
        ...GLOBAL_ARGS_DEF,
        check: {
          type: "boolean",
          description: "Verify that openapi.json and schema.d.ts have zero drift",
          default: false,
        },
      },
      async run({ args }) {
        try {
          const cwd = resolveCwd(args);
          const { rootDir } = await loadPandConfig(cwd);
          const checkOnly = Boolean(args.check);
          const res = await sdkGenInternal({ rootDir, checkOnly });
          if (checkOnly && res.drifted) {
            throw new Error(
              "OpenAPI / SDK contract drift detected! Run `pand sdk gen` to update generated files.",
            );
          }
          emitResult(
            args,
            res,
            `Generated OpenAPI + SDK (${res.pathCount} paths) -> ${res.contractsPath}`,
          );
        } catch (err) {
          emitError(args, err);
        }
      },
    }),
  },
});
