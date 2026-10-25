import { loadPandConfig } from "@pand/config";
import { defineCommand } from "citty";
import { execa } from "execa";
import { GLOBAL_ARGS_DEF, emitError, emitResult, resolveCwd } from "../output.js";
import { sdkGenInternal } from "./sdk-gen.js";

export async function checkProjectInternal(rootDir: string) {
  // 1. Biome lint/format check
  await execa("pnpm", ["lint"], { cwd: rootDir });

  // 2. TypeScript typecheck across workspace
  await execa("pnpm", ["-r", "typecheck"], { cwd: rootDir });

  // 3. OpenAPI / SDK contract drift check
  const sdkStatus = await sdkGenInternal({ rootDir, checkOnly: true });
  if (sdkStatus.drifted) {
    throw new Error(
      "OpenAPI / SDK contract drift detected! Run `pand sdk gen` to update packages/contracts/openapi.json and packages/sdk/src/schema.d.ts.",
    );
  }

  // 4. Vitest suite across workspace
  await execa("pnpm", ["-r", "test"], { cwd: rootDir });

  return {
    lint: "ok",
    typecheck: "ok",
    sdkDrift: "ok",
    tests: "ok",
  };
}

export const checkCommand = defineCommand({
  meta: {
    name: "check",
    description:
      "Run Biome lint/format check, typecheck, OpenAPI/SDK drift check, and Vitest suite",
  },
  args: {
    ...GLOBAL_ARGS_DEF,
  },
  async run({ args }) {
    try {
      const cwd = resolveCwd(args);
      const { rootDir } = await loadPandConfig(cwd);
      const res = await checkProjectInternal(rootDir);
      emitResult(args, res, "All checks passed (lint, typecheck, SDK contract drift, tests).");
    } catch (err) {
      emitError(args, err);
    }
  },
});
