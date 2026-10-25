import fs from "node:fs";
import path from "node:path";
import { loadPandConfig } from "@pands/config";
import { defineCommand } from "citty";
import { execa } from "execa";
import { GLOBAL_ARGS_DEF, emitError, emitResult, resolveCwd } from "../output.js";
import { ensureBaselineSnapshot, getNodeOptionsWithTsx } from "./db.js";
import { sdkGenInternal } from "./sdk-gen.js";

export async function checkMigrationDriftInternal(rootDir: string) {
  const { config } = await loadPandConfig(rootDir);
  const targetServices = Object.entries(config.services)
    .filter(([, s]) => s.db)
    .map(([name]) => name);

  for (const svc of targetServices) {
    const svcDir = path.join(rootDir, "services", svc);
    if (!fs.existsSync(svcDir)) continue;
    const schemaDir = path.join(svcDir, "src", "db", "schema");
    if (!fs.existsSync(schemaDir)) continue;

    const schemaFiles = fs.readdirSync(schemaDir).filter((f) => f.endsWith(".ts"));
    if (schemaFiles.length === 0) continue;

    const drizzleDir = path.join(svcDir, "drizzle");
    const journalPath = path.join(drizzleDir, "meta", "_journal.json");

    if (!fs.existsSync(drizzleDir) || !fs.existsSync(journalPath)) {
      throw new Error(
        `Database schema drift detected in service '${svc}'! No migrations exist. Run \`pand db generate\` to create pending migrations.`,
      );
    }

    ensureBaselineSnapshot(svcDir, svc);

    const tempDirName = `.drizzle-check-tmp-${Date.now()}`;
    const tempDir = path.join(svcDir, tempDirName);
    const tempConfigFileName = `drizzle.check.${Date.now()}.config.ts`;
    const tempConfigPath = path.join(svcDir, tempConfigFileName);

    try {
      fs.cpSync(drizzleDir, tempDir, { recursive: true });
      fs.writeFileSync(
        tempConfigPath,
        `export default {
  schema: "./src/db/schema/index.ts",
  out: "./${tempDirName}",
  dialect: "postgresql",
};
`,
        "utf8",
      );

      let res: { stdout: string; stderr: string };
      try {
        res = await execa(
          "pnpm",
          ["exec", "drizzle-kit", "generate", "--config", tempConfigFileName],
          {
            cwd: svcDir,
            env: {
              ...process.env,
              NODE_OPTIONS: getNodeOptionsWithTsx(),
            },
            stdin: "ignore",
          },
        );
      } catch (err: any) {
        const combined = `${err.stdout ?? ""} ${err.stderr ?? ""} ${err.message ?? ""}`;
        if (
          /created or renamed/i.test(combined) ||
          /rename.*column/i.test(combined) ||
          /rename.*table/i.test(combined) ||
          /❯/.test(combined)
        ) {
          throw new Error(
            `Database schema drift detected in service '${svc}'! Ambiguous changes require migration generation. Run \`pand db generate\`.`,
          );
        }
        const errMsg = err.stderr?.trim() || err.stdout?.trim() || err.message;
        throw new Error(`Failed to check database migrations for service '${svc}': ${errMsg}`);
      }

      const combinedOutput = `${res.stdout ?? ""} ${res.stderr ?? ""}`;
      if (
        /created or renamed/i.test(combinedOutput) ||
        /rename.*column/i.test(combinedOutput) ||
        /rename.*table/i.test(combinedOutput) ||
        /❯/.test(combinedOutput)
      ) {
        throw new Error(
          `Database schema drift detected in service '${svc}'! Run \`pand db generate\` to create pending migrations.`,
        );
      }

      const origFiles = new Set(fs.readdirSync(drizzleDir).filter((f) => f.endsWith(".sql")));
      const tempFiles = fs.readdirSync(tempDir).filter((f) => f.endsWith(".sql"));
      const newFiles = tempFiles.filter((f) => !origFiles.has(f));

      if (newFiles.length > 0) {
        throw new Error(
          `Database schema drift detected in service '${svc}'! Run \`pand db generate\` to create pending migrations.`,
        );
      }
    } finally {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      if (fs.existsSync(tempConfigPath)) {
        fs.rmSync(tempConfigPath, { force: true });
      }
    }
  }
}

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

  // 4. Database schema migration drift check
  await checkMigrationDriftInternal(rootDir);

  // 5. Vitest suite across workspace
  await execa("pnpm", ["-r", "test"], { cwd: rootDir });

  return {
    lint: "ok",
    typecheck: "ok",
    sdkDrift: "ok",
    migrationDrift: "ok",
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
