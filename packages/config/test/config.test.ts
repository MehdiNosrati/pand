import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addServiceToConfigSource,
  computeBasePort,
  defineConfig,
  loadPandConfig,
  resolveProjectPorts,
} from "../src/index.js";

describe("@pands/config", () => {
  it("applies schema defaults accurately", () => {
    const cfg = defineConfig({
      name: "todo",
      displayName: "Todo App",
      services: {
        core: { portOffset: 10 },
      },
    });

    expect(cfg.name).toBe("todo");
    expect(cfg.domain).toBe("mahdins.dev");
    expect(cfg.githubOwner).toBe("mehdinosrati");
    expect(cfg.bundleIdPrefix).toBe("dev.mahdins");
    expect(cfg.auth.emailPassword).toBe(true);
    expect(cfg.auth.magicLink).toBe(false);
    expect(cfg.resources.postgres).toBe(true);
    expect(cfg.resources.valkey).toBe(false);
    expect(cfg.apps.web).toBe(true);
    expect(cfg.apps.admin).toBe(true);
    expect(cfg.apps.ios).toBe(false);
    expect(cfg.services.core?.db).toBe(true);
    expect(cfg.services.core?.memoryMb).toBe(192);
  });

  it("rejects invalid project or service names", () => {
    expect(() =>
      defineConfig({
        name: "Invalid_Name",
        displayName: "Bad",
        services: { core: { portOffset: 10 } },
      }),
    ).toThrow();

    expect(() =>
      defineConfig({
        name: "valid-name",
        displayName: "Bad Service",
        services: { "Bad-Service": { portOffset: 10 } },
      }),
    ).toThrow();
  });

  it("allocates ports deterministically", () => {
    const base1 = computeBasePort("todo");
    const base2 = computeBasePort("todo");
    expect(base1).toBe(base2);
    expect(base1).toBeGreaterThanOrEqual(4000);
    expect(base1).toBeLessThanOrEqual(7900);
    expect(base1 % 100).toBe(0);

    const cfg = defineConfig({
      name: "reference",
      displayName: "Reference",
      basePort: 4000,
      services: {
        core: { portOffset: 10 },
        billing: { portOffset: 11 },
      },
    });

    const ports = resolveProjectPorts(cfg);
    expect(ports).toEqual({
      basePort: 4000,
      gatewayPort: 4001,
      webPort: 4002,
      adminPort: 4003,
      postgresPort: 4032,
      valkeyPort: 4079,
      s3Port: 4090,
      grafanaPort: 4080,
      otlpHttpPort: 4018,
      services: {
        core: 4010,
        billing: 4011,
      },
    });
  });

  it("loads pand.config.ts from disk and mutates services", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pand-cfg-test-"));
    try {
      const configPath = path.join(tmpDir, "pand.config.ts");
      const initialSource = `export default {
  name: "my-app",
  displayName: "My App",
  basePort: 4200,
  services: {
    core: { portOffset: 10, db: true },
  },
};
`;
      fs.writeFileSync(configPath, initialSource, "utf8");
      const nestedDir = path.join(tmpDir, "services", "core");
      fs.mkdirSync(nestedDir, { recursive: true });

      const loaded = await loadPandConfig(nestedDir);
      expect(loaded.rootDir).toBe(path.resolve(tmpDir));
      expect(loaded.config.name).toBe("my-app");
      expect(loaded.config.basePort).toBe(4200);

      const mutated = addServiceToConfigSource(initialSource, "billing", {
        portOffset: 11,
        db: true,
      });
      fs.writeFileSync(configPath, mutated, "utf8");

      const reloaded = await loadPandConfig(tmpDir);
      expect(reloaded.config.services.billing?.portOffset).toBe(11);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
