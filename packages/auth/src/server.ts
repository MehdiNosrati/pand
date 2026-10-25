import type { PandConfig } from "@pand/config";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, bearer } from "better-auth/plugins";
import { authTables } from "./schema.js";

export interface CreatePandAuthOptions {
  db: unknown;
  config: PandConfig;
  secret?: string;
  baseURL?: string;
}

export interface RequestActor {
  userId: string;
  email: string;
  role: "user" | "admin";
}

export function isAdminEmail(email: string, config: PandConfig): boolean {
  const envAdmins = (process.env.PAND_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const configAdmins = (config.auth?.adminEmails ?? []).map((e) => e.trim().toLowerCase());
  const allAdmins = new Set([...envAdmins, ...configAdmins]);
  return allAdmins.has(email.trim().toLowerCase());
}

export interface PandAuthInstance {
  handler: (req: Request) => Promise<Response>;
  api: {
    getSession: (opts: { headers: Headers }) => Promise<any>;
    [key: string]: any;
  };
  [key: string]: any;
}

export function createPandAuth(options: CreatePandAuthOptions): PandAuthInstance {
  const secret =
    options.secret ??
    process.env.BETTER_AUTH_SECRET ??
    "dev-better-auth-secret-must-be-at-least-32-bytes-long";
  const baseURL = options.baseURL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:4001";

  const auth = betterAuth({
    database: drizzleAdapter(options.db as any, {
      provider: "pg",
      schema: authTables,
    }),
    secret,
    baseURL,
    basePath: "/api/auth",
    emailAndPassword: {
      enabled: options.config.auth?.emailPassword ?? true,
    },
    plugins: [bearer(), admin()],
    databaseHooks: {
      user: {
        create: {
          before: async (userRecord) => {
            if (isAdminEmail(userRecord.email, options.config)) {
              return {
                data: {
                  ...userRecord,
                  role: "admin",
                },
              };
            }
            return {
              data: {
                ...userRecord,
                role: (userRecord as any).role ?? "user",
              },
            };
          },
        },
      },
    },
  });

  return auth as unknown as PandAuthInstance;
}

export async function resolveRequestActor(
  auth: PandAuthInstance,
  req: Request,
): Promise<RequestActor | null> {
  // Support test headers in non-production environments
  if (process.env.NODE_ENV !== "production") {
    const testUserId = req.headers.get("x-test-user-id");
    if (testUserId) {
      return {
        userId: testUserId,
        email: req.headers.get("x-test-user-email") ?? `${testUserId}@mahdins.dev`,
        role: req.headers.get("x-test-user-role") === "admin" ? "admin" : "user",
      };
    }
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer test-user:")) {
      const parts = authHeader.slice("Bearer test-user:".length).split(":");
      const userId = parts[0] || "user-1";
      const role = parts[1] === "admin" ? "admin" : "user";
      return {
        userId,
        email: `${userId}@mahdins.dev`,
        role,
      };
    }
  }

  try {
    const sessionData = await auth.api.getSession({
      headers: req.headers,
    });
    if (!sessionData || !sessionData.user) {
      return null;
    }
    const role = (sessionData.user as any).role === "admin" ? "admin" : "user";
    return {
      userId: sessionData.user.id,
      email: sessionData.user.email,
      role,
    };
  } catch {
    return null;
  }
}
