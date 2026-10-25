import { defineConfig } from "@pand/config";
import { createDb } from "@pand/db";
import { createTestDatabase } from "@pand/testing";
import { describe, expect, it } from "vitest";
import {
  authTables,
  buildTrustedOrigins,
  createPandAuth,
  ensureAuthTables,
  resolveRequestActor,
} from "../src/index.js";

describe("@pand/auth", () => {
  it("buildTrustedOrigins correctly resolves, dedupes, and filters origins", () => {
    const devOrigins = buildTrustedOrigins({
      baseURL: "http://localhost:4001",
      trustedOrigins: ["http://localhost:5000", "http://custom.dev"],
      isProduction: false,
    });
    expect(devOrigins).toContain("http://localhost:4001");
    expect(devOrigins).toContain("http://127.0.0.1:4001");
    expect(devOrigins).toContain("http://localhost:5000");
    expect(devOrigins).toContain("http://127.0.0.1:5000");
    expect(devOrigins).toContain("http://custom.dev");

    const prodOrigins = buildTrustedOrigins({
      baseURL: "https://acme.mahdins.dev",
      trustedOrigins: ["https://acme-admin.mahdins.dev", "*", "http://127.0.0.1:4002"],
      isProduction: true,
    });
    expect(prodOrigins).toContain("https://acme.mahdins.dev");
    expect(prodOrigins).toContain("https://acme-admin.mahdins.dev");
    expect(prodOrigins).not.toContain("*");
    expect(prodOrigins).not.toContain("http://127.0.0.1:4002");
  });

  it("handles email/password signup, session resolution, and adminEmails auto-promotion", async () => {
    const testDb = await createTestDatabase();
    await ensureAuthTables(testDb.databaseUrl);
    const dbHandle = createDb({
      databaseUrl: testDb.databaseUrl,
      schema: authTables,
    });

    try {
      const config = defineConfig({
        name: "todo",
        displayName: "Todo App",
        auth: {
          emailPassword: true,
          adminEmails: ["admin@mahdins.dev"],
        },
        services: {
          core: { portOffset: 10 },
        },
      });

      const auth = createPandAuth({
        db: dbHandle.db,
        config,
        baseURL: "http://localhost:4001",
      });

      // 1. Sign up regular user
      const userSignUpRes = await auth.handler(
        new Request("http://localhost:4001/api/auth/sign-up/email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "alice@mahdins.dev",
            password: "Password123!",
            name: "Alice",
          }),
        }),
      );
      expect(userSignUpRes.status).toBe(200);
      const userData = (await userSignUpRes.json()) as {
        token?: string;
        user: { id: string; role?: string };
      };
      expect(userData.user.role).toBe("user");

      const setCookie = userSignUpRes.headers.get("set-cookie") ?? "";
      const sessionReq = new Request("http://localhost:4001/api/v1/core/tasks", {
        headers: {
          cookie: setCookie.split(";")[0] ?? "",
        },
      });
      const resolvedUser = await resolveRequestActor(auth, sessionReq);
      expect(resolvedUser?.email).toBe("alice@mahdins.dev");
      expect(resolvedUser?.role).toBe("user");

      // 2. Sign up admin user (matches adminEmails)
      const adminSignUpRes = await auth.handler(
        new Request("http://localhost:4001/api/auth/sign-up/email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "Admin@mahdins.dev",
            password: "AdminPassword123!",
            name: "Admin User",
          }),
        }),
      );
      expect(adminSignUpRes.status).toBe(200);
      const adminCookie = adminSignUpRes.headers.get("set-cookie") ?? "";
      const adminSessionReq = new Request("http://localhost:4001/api/v1/core/tasks", {
        headers: {
          cookie: adminCookie.split(";")[0] ?? "",
        },
      });
      const resolvedAdmin = await resolveRequestActor(auth, adminSessionReq);
      expect(resolvedAdmin?.email.toLowerCase()).toBe("admin@mahdins.dev");
      expect(resolvedAdmin?.role).toBe("admin");
    } finally {
      await dbHandle.close();
      await testDb.cleanup();
    }
  });

  it("enforces trustedOrigins in dev and production", async () => {
    const testDb = await createTestDatabase();
    await ensureAuthTables(testDb.databaseUrl);
    const dbHandle = createDb({
      databaseUrl: testDb.databaseUrl,
      schema: authTables,
    });

    const origEnv = { ...process.env };

    try {
      const config = defineConfig({
        name: "todo",
        displayName: "Todo App",
        auth: { emailPassword: true },
        services: { core: { portOffset: 10 } },
      });

      const adminPort = 4003;
      const webPort = 4002;
      process.env.PAND_PUBLIC_WEB_URL = `http://localhost:${webPort}`;
      process.env.PAND_PUBLIC_ADMIN_URL = `http://localhost:${adminPort}`;
      process.env.NODE_ENV = "development";

      const devAuth = createPandAuth({
        db: dbHandle.db,
        config,
        baseURL: "http://localhost:4001",
      });

      // 1. In dev, sign-up succeeds with Origin: http://localhost:<adminPort>
      const adminOriginRes = await devAuth.handler(
        new Request("http://localhost:4001/api/auth/sign-up/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: `http://localhost:${adminPort}`,
          },
          body: JSON.stringify({
            email: "bob@mahdins.dev",
            password: "Password123!",
            name: "Bob",
          }),
        }),
      );
      expect(adminOriginRes.status).toBe(200);

      // 2. In dev, sign-up succeeds with Origin: http://127.0.0.1:<webPort>
      const loopbackWebRes = await devAuth.handler(
        new Request("http://localhost:4001/api/auth/sign-up/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: `http://127.0.0.1:${webPort}`,
          },
          body: JSON.stringify({
            email: "carol@mahdins.dev",
            password: "Password123!",
            name: "Carol",
          }),
        }),
      );
      expect(loopbackWebRes.status).toBe(200);

      // 3. Sign-up fails with INVALID_ORIGIN for an unrelated origin such as http://evil.example
      const evilRes = await devAuth.handler(
        new Request("http://localhost:4001/api/auth/sign-up/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://evil.example",
          },
          body: JSON.stringify({
            email: "dave@mahdins.dev",
            password: "Password123!",
            name: "Dave",
          }),
        }),
      );
      expect(evilRes.status).toBe(403);
      const evilData = (await evilRes.json()) as { code?: string; message?: string };
      expect(evilData.code || evilData.message).toMatch(/INVALID_ORIGIN|Invalid origin/);

      // 4. With NODE_ENV=production, 127.0.0.1 origins are rejected
      process.env.NODE_ENV = "production";
      const prodAuth = createPandAuth({
        db: dbHandle.db,
        config,
        baseURL: "http://localhost:4001",
      });

      const prodLoopbackRes = await prodAuth.handler(
        new Request("http://localhost:4001/api/auth/sign-up/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: `http://127.0.0.1:${webPort}`,
          },
          body: JSON.stringify({
            email: "eve@mahdins.dev",
            password: "Password123!",
            name: "Eve",
          }),
        }),
      );
      expect(prodLoopbackRes.status).toBe(403);
      const prodData = (await prodLoopbackRes.json()) as { code?: string; message?: string };
      expect(prodData.code || prodData.message).toMatch(/INVALID_ORIGIN|Invalid origin/);
    } finally {
      process.env = origEnv;
      await dbHandle.close();
      await testDb.cleanup();
    }
  });
});
