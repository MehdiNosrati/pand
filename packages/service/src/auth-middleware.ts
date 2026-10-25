import type { MiddlewareHandler } from "hono";
import { PandError } from "./errors.js";
import { type InternalTokenClaims, verifyInternalToken } from "./internal-jwt.js";

export interface ServiceVariables {
  requestId: string;
  actor: InternalTokenClaims | null;
}

export function internalTokenMiddleware(secret?: string): MiddlewareHandler<{
  Variables: ServiceVariables;
}> {
  return async (c, next) => {
    const rawToken = c.req.header("x-pand-internal-token");
    if (!rawToken) {
      c.set("actor", null);
      await next();
      return;
    }
    const claims = await verifyInternalToken(rawToken, secret);
    c.set("actor", claims);
    await next();
  };
}

export function requirePublic(): MiddlewareHandler<{ Variables: ServiceVariables }> {
  return async (c, next) => {
    const existing = c.get("actor");
    if (!existing) {
      const now = Math.floor(Date.now() / 1000);
      c.set("actor", {
        sub: "anonymous",
        authenticated: false,
        caller: "direct",
        reqId: c.get("requestId") ?? "",
        iat: now,
        exp: now + 60,
      });
    }
    await next();
  };
}

export function requireAuth(): MiddlewareHandler<{ Variables: ServiceVariables }> {
  return async (c, next) => {
    const actor = c.get("actor");
    if (!actor) {
      throw PandError.unauthorized("Missing internal token");
    }
    if (!actor.authenticated && !actor.caller.startsWith("service:")) {
      throw PandError.unauthorized("Authentication required");
    }
    await next();
  };
}

export function requireAdmin(): MiddlewareHandler<{ Variables: ServiceVariables }> {
  return async (c, next) => {
    const actor = c.get("actor");
    if (!actor || (!actor.authenticated && !actor.caller.startsWith("service:"))) {
      throw PandError.unauthorized("Authentication required");
    }
    if (actor.role !== "admin" && !actor.caller.startsWith("service:")) {
      throw PandError.forbidden("Admin role required");
    }
    await next();
  };
}
