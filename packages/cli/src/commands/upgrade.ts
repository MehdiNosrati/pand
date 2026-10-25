import fs from "node:fs";
import path from "node:path";
import { loadPandConfig } from "@pands/config";
import { defineCommand } from "citty";
import { renderTemplateDir } from "../generators/template.js";
import {
  GLOBAL_ARGS_DEF,
  emitError,
  emitResult,
  getPlatformRootDir,
  resolveCwd,
} from "../output.js";
import { dbGenerateInternal } from "./db.js";
import { sdkGenInternal } from "./sdk-gen.js";

export async function upgradeProjectInternal(options: {
  rootDir: string;
}) {
  const { config } = await loadPandConfig(options.rootDir);
  const platformRoot = getPlatformRootDir();
  const skillsTemplateDir = path.join(platformRoot, "templates", "project", ".agents", "skills");
  const targetSkillsDir = path.join(options.rootDir, ".agents", "skills");

  if (fs.existsSync(skillsTemplateDir)) {
    renderTemplateDir(skillsTemplateDir, targetSkillsDir, {
      project: config.name,
    });
  }

  await dbGenerateInternal({ rootDir: options.rootDir });
  await sdkGenInternal({ rootDir: options.rootDir });

  return {
    upgraded: true,
    project: config.name,
    pandVersion: config.pandVersion,
    skillsRefreshed: fs.existsSync(targetSkillsDir),
  };
}

export const upgradeCommand = defineCommand({
  meta: {
    name: "upgrade",
    description:
      "Refresh .agents/skills, regenerate DB migrations and SDKs for the current Pand version",
  },
  args: { ...GLOBAL_ARGS_DEF },
  async run({ args }) {
    try {
      const res = await upgradeProjectInternal({ rootDir: resolveCwd(args) });
      emitResult(
        args,
        res,
        `Upgraded project "${res.project}" (skills + migrations + SDK refreshed)`,
      );
    } catch (err) {
      emitError(args, "UPGRADE_ERROR", err instanceof Error ? err.message : String(err));
    }
  },
});
