import crypto from "node:crypto";
import { SignJWT } from "jose";

export interface InternalTokenClaims {
  sub: string;
  authenticated: boolean;
  email?: string;
  role?: "user" | "admin";
  caller: string;
  reqId: string;
  iat: number;
  exp: number;
}

export const DEFAULT_TEST_INTERNAL_SECRET = "test-internal-secret-must-be-at-least-32-bytes";

export async function mintTestInternalToken(
  claims: Partial<InternalTokenClaims> = {},
  secret: string = DEFAULT_TEST_INTERNAL_SECRET,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullClaims: InternalTokenClaims = {
    sub: claims.sub ?? "user-test-1",
    authenticated: claims.authenticated ?? true,
    email: claims.email ?? "test@mahdins.dev",
    role: claims.role ?? "user",
    caller: claims.caller ?? "gateway",
    reqId: claims.reqId ?? crypto.randomUUID(),
    iat: claims.iat ?? now,
    exp: claims.exp ?? now + 60,
  };

  const key = new TextEncoder().encode(secret);
  return await new SignJWT({
    authenticated: fullClaims.authenticated,
    email: fullClaims.email,
    role: fullClaims.role,
    caller: fullClaims.caller,
    reqId: fullClaims.reqId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(fullClaims.sub)
    .setIssuedAt(fullClaims.iat)
    .setExpirationTime(fullClaims.exp)
    .sign(key);
}
