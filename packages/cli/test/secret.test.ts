import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  secretExportInternal,
  secretGetInternal,
  secretInitInternal,
  secretListInternal,
  secretSetInternal,
} from "../src/commands/secret.js";

describe("pand secret (age-encryption)", () => {
  it("initializes age key, encrypts secrets, reads, masks, and exports dotenv", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pand-secret-test-"));
    const configDir = path.join(tmpDir, ".config");
    const projectDir = path.join(tmpDir, "app");
    fs.mkdirSync(projectDir, { recursive: true });

    try {
      const initRes = await secretInitInternal({ rootDir: projectDir, configDir });
      expect(initRes.publicKey).toMatch(/^age1/);
      expect(fs.existsSync(initRes.keyPath)).toBe(true);

      await secretSetInternal({
        rootDir: projectDir,
        configDir,
        env: "prod",
        pair: "STRIPE_SECRET_KEY=sk_test_12345",
      });
      await secretSetInternal({
        rootDir: projectDir,
        configDir,
        env: "prod",
        pair: "WEBHOOK_SECRET=whsec_999",
      });

      const val = await secretGetInternal({
        rootDir: projectDir,
        configDir,
        env: "prod",
        key: "STRIPE_SECRET_KEY",
      });
      expect(val).toBe("sk_test_12345");

      const masked = await secretListInternal({
        rootDir: projectDir,
        configDir,
        env: "prod",
        reveal: false,
      });
      expect(masked).toEqual({
        STRIPE_SECRET_KEY: "********",
        WEBHOOK_SECRET: "********",
      });

      const dotenv = await secretExportInternal({
        rootDir: projectDir,
        configDir,
        env: "prod",
      });
      expect(dotenv).toContain('STRIPE_SECRET_KEY="sk_test_12345"');
      expect(dotenv).toContain('WEBHOOK_SECRET="whsec_999"');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
