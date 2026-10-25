import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  deployInternal,
  generateAppDeployCompose,
  pauseResumeInternal,
} from "../src/commands/deploy.js";
import { newProjectInternal } from "../src/commands/new.js";

describe("pand deploy, pause, and resume", () => {
  it("generates Caddy-labeled production compose, verifies health check, rolls back on failure, and supports pause/resume", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "pand-deploy-test-"));
    try {
      const created = await newProjectInternal({
        cwd: tmpBase,
        name: "acme",
        minimal: true,
        skipInstall: true,
      });

      const executedSsh: string[] = [];
      const res = await deployInternal({
        rootDir: created.projectDir,
        env: "prod",
        gitSha: "sha-v2",
        skipTests: true,
        sshExecFn: async (cmd) => {
          executedSsh.push(cmd);
        },
        healthCheckFn: async () => true,
      });

      expect(res.webUrl).toBe("https://acme.mahdins.dev");
      expect(res.adminUrl).toBe("https://acme-admin.mahdins.dev");
      const composeContent = fs.readFileSync(res.composePath, "utf8");
      expect(composeContent).toContain('caddy_0: "acme.mahdins.dev"');
      expect(composeContent).toContain('caddy_1: "acme-admin.mahdins.dev"');

      // Verify auto-rollback when healthCheckFn returns false
      await expect(
        deployInternal({
          rootDir: created.projectDir,
          env: "prod",
          gitSha: "sha-broken",
          previousGitSha: "sha-v2",
          skipTests: true,
          sshExecFn: async (cmd) => {
            executedSsh.push(cmd);
          },
          healthCheckFn: async () => false,
        }),
      ).rejects.toThrow(/rolled back to sha-v2/);

      const rolledBackCompose = fs.readFileSync(res.composePath, "utf8");
      expect(rolledBackCompose).toContain("ghcr.io/mehdinosrati/acme-gateway:sha-v2");

      const paused = await pauseResumeInternal({ project: "acme", action: "pause" });
      expect(paused.command).toContain(
        "docker compose -f /opt/pand/apps/acme-prod/docker-compose.yml stop",
      );
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  }, 60_000);
});
