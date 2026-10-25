import { defineConfig } from "@pand/config";
import { createDb } from "@pand/db";
import { createTestDatabase } from "@pand/testing";
import { describe, expect, it } from "vitest";
import { authTables, createPandAuth, ensureAuthTables, resolveRequestActor } from "../src/index.js";

describe("@pand/auth", () => {
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
});
