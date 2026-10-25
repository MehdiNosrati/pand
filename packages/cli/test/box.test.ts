import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  boxCreateInternal,
  boxStatusInternal,
  generateBoxSetupScript,
} from "../src/commands/box.js";

describe("pand box commands", () => {
  it("provisions Hetzner CX33 in fsn1, updates Cloudflare wildcard DNS, and reports Box status", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pand-box-test-"));
    const calls: Array<{ url: string; method: string; body?: any }> = [];

    const mockFetch = vi.fn(async (input: any, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });

      if (url.includes("api.hetzner.cloud/v1/servers")) {
        return new Response(
          JSON.stringify({
            server: {
              id: 987654,
              public_net: { ipv4: { ip: "49.13.100.200" } },
            },
          }),
          { status: 201 },
        );
      }
      if (url.includes("api.cloudflare.com/client/v4/zones?")) {
        return new Response(JSON.stringify({ result: [{ id: "zone-mahdins-1" }] }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    try {
      const meta = await boxCreateInternal({
        hetznerToken: "htz_test_token",
        cloudflareToken: "cf_test_token",
        configDir: tmpDir,
        fetchFn: mockFetch,
      });

      expect(meta.ip).toBe("49.13.100.200");
      expect(meta.serverType).toBe("cx33");
      expect(meta.location).toBe("fsn1");
      expect(meta.domain).toBe("mahdins.dev");
      expect(calls.some((c) => c.body?.name === "*.mahdins.dev")).toBe(true);

      const script = generateBoxSetupScript();
      expect(script).toContain("/swapfile");
      expect(script).toContain("docker-compose.system.yml");

      const status = await boxStatusInternal({ configDir: tmpDir });
      expect(status.ip).toBe("49.13.100.200");
      expect(status.containersRunning).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
