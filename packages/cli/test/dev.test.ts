import { defineConfig, resolveProjectPorts } from "@pands/config";
import { describe, expect, it } from "vitest";
import { buildAppDevSpawns } from "../src/commands/dev.js";

describe("pand dev", () => {
  it("builds web and admin spawn commands only when enabled, with correct ports and localhost binding", () => {
    // 1. Both web and admin enabled
    const fullConfig = defineConfig({
      name: "acme",
      displayName: "Acme App",
      services: {
        core: { portOffset: 10 },
      },
      apps: {
        web: true,
        admin: true,
        ios: false,
        android: false,
      },
    });
    const fullPorts = resolveProjectPorts(fullConfig);
    const fullSpawns = buildAppDevSpawns(fullConfig, fullPorts, "/projects/acme");

    expect(fullSpawns).toHaveLength(2);

    const webSpawn = fullSpawns.find((s) => s.app === "web");
    expect(webSpawn).toBeDefined();
    expect(webSpawn?.cwd).toBe("/projects/acme/apps/web");
    expect(webSpawn?.cmd).toBe("pnpm");
    expect(webSpawn?.args).toEqual([
      "exec",
      "vite",
      "--host",
      "localhost",
      "--port",
      String(fullPorts.webPort),
    ]);
    expect(webSpawn?.env.PORT).toBe(String(fullPorts.webPort));
    expect(webSpawn?.env.GATEWAY_PORT).toBe(String(fullPorts.gatewayPort));
    expect(webSpawn?.url).toBe(`http://localhost:${fullPorts.webPort}`);

    const adminSpawn = fullSpawns.find((s) => s.app === "admin");
    expect(adminSpawn).toBeDefined();
    expect(adminSpawn?.cwd).toBe("/projects/acme/apps/admin");
    expect(adminSpawn?.cmd).toBe("pnpm");
    expect(adminSpawn?.args).toEqual([
      "exec",
      "vite",
      "--host",
      "localhost",
      "--port",
      String(fullPorts.adminPort),
    ]);
    expect(adminSpawn?.env.PORT).toBe(String(fullPorts.adminPort));
    expect(adminSpawn?.env.GATEWAY_PORT).toBe(String(fullPorts.gatewayPort));
    expect(adminSpawn?.url).toBe(`http://localhost:${fullPorts.adminPort}`);

    // 2. Only web enabled (admin disabled)
    const webOnlyConfig = defineConfig({
      name: "acme",
      displayName: "Acme App",
      services: {
        core: { portOffset: 10 },
      },
      apps: {
        web: true,
        admin: false,
        ios: false,
        android: false,
      },
    });
    const webOnlyPorts = resolveProjectPorts(webOnlyConfig);
    const webOnlySpawns = buildAppDevSpawns(webOnlyConfig, webOnlyPorts, "/projects/acme");

    expect(webOnlySpawns).toHaveLength(1);
    expect(webOnlySpawns[0]?.app).toBe("web");
    expect(webOnlySpawns[0]?.env.PORT).toBe(String(webOnlyPorts.webPort));

    // 3. Neither web nor admin enabled (minimal backend only)
    const backendOnlyConfig = defineConfig({
      name: "acme",
      displayName: "Acme App",
      services: {
        core: { portOffset: 10 },
      },
      apps: {
        web: false,
        admin: false,
        ios: false,
        android: false,
      },
    });
    const backendOnlyPorts = resolveProjectPorts(backendOnlyConfig);
    const backendOnlySpawns = buildAppDevSpawns(
      backendOnlyConfig,
      backendOnlyPorts,
      "/projects/acme",
    );

    expect(backendOnlySpawns).toHaveLength(0);
  });
});
