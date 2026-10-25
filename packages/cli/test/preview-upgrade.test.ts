import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { newProjectInternal } from "../src/commands/new.js";
import { previewDownInternal, previewUpInternal } from "../src/commands/preview.js";
import { upgradeProjectInternal } from "../src/commands/upgrade.js";

describe("pand preview and pand upgrade", () => {
  it("spins up and tears down isolated PR preview environments and refreshes project skills on upgrade", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "pand-preview-test-"));
    try {
      const created = await newProjectInternal({
        cwd: tmpBase,
        name: "preview-app",
        minimal: true,
      });

      const sshCmds: string[] = [];
      const upRes = await previewUpInternal({
        rootDir: created.projectDir,
        prNumber: 42,
        sshExecFn: async (cmd) => {
          sshCmds.push(cmd);
        },
      });
      expect(upRes.webUrl).toBe("https://preview-app-pr-42.mahdins.dev");
      expect(upRes.databaseName).toBe("preview_app_pr_42");

      const downRes = await previewDownInternal({
        rootDir: created.projectDir,
        prNumber: 42,
        sshExecFn: async (cmd) => {
          sshCmds.push(cmd);
        },
      });
      expect(downRes.destroyed).toBe(true);
      expect(downRes.databaseDropped).toBe("preview_app_pr_42");

      const upgradeRes = await upgradeProjectInternal({
        rootDir: created.projectDir,
      });
      expect(upgradeRes.upgraded).toBe(true);
      expect(upgradeRes.skillsRefreshed).toBe(true);
      expect(
        fs.existsSync(
          path.join(created.projectDir, ".agents", "skills", "add-feature", "SKILL.md"),
        ),
      ).toBe(true);
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  }, 60_000);
});
