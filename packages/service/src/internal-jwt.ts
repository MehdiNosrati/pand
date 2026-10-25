import { SignJWT, jwtVerify } from "jose";
import { PandError } from "./errors.js";

export interface InternalTokenClaims {
  /** Subject: user ID if authenticated, or "anonymous" if unauthenticated, or "service:<name>" for service-to-service calls */
  sub: string;
  /** True if a user session was authenticated */
  authenticated: boolean;
  /** User email if authenticated */
  email?: string;
  /** User role: "user" | "admin" */
  role?: "user" | "admin";
  /** Originating caller ("gateway" or service name) */
  caller: string;
  /** Request ID */
  reqId: string;
  iat: number;
  exp: number;
}

export const DEFAULT_DEV_INTERNAL_SECRET = "test-internal-secret-must-be-at-least-32-bytes";

export function getInternalSecret(explicitSecret?: string): string {
  const secret = explicitSecret ?? process.env.PAND_INTERNAL_SECRET;
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("PAND_INTERNAL_SECRET must be set in production");
  }
  return DEFAULT_DEV_INTERNAL_SECRET;
}

export async function signInternalToken(
  claims: Omit<InternalTokenClaims, "iat" | "exp">,
  secret?: string,
  ttlSeconds = 60,
): Promise<string> {
  const resolvedSecret = getInternalSecret(secret);
  const now = Math.floor(Date.now() / 1000);
  const key = new TextEncoder().encode(resolvedSecret);

  return await new SignJWT({
    authenticated: claims.authenticated,
    email: claims.email,
    role: claims.role,
    caller: claims.caller,
    reqId: claims.reqId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(key);
}

export async function verifyInternalToken(
  token: string,
  secret?: string,
): Promise<InternalTokenClaims> {
  const resolvedSecret = getInternalSecret(secret);
  const key = new TextEncoder().encode(resolvedSecret);
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    return {
      sub: typeof payload.sub === "string" ? payload.sub : "anonymous",
      authenticated: Boolean(payload.authenticated),
      email: typeof payload.email === "string" ? payload.email : undefined,
      role: payload.role === "admin" || payload.role === "user" ? payload.role : undefined,
      caller: typeof payload.caller === "string" ? payload.caller : "unknown",
      reqId: typeof payload.reqId === "string" ? payload.reqId : "",
      iat: typeof payload.iat === "number" ? payload.iat : 0,
      exp: typeof payload.exp === "number" ? payload.exp : 0,
    };
  } catch {
    throw PandError.unauthorized("Invalid or expired internal token");
  }
}
