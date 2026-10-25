# @pands/auth

> Authentication server, client, Better Auth adapter, and RBAC middleware for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/auth.svg)](https://www.npmjs.com/package/@pands/auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/auth` integrates Better Auth with Drizzle ORM, multi-origin CORS verification (`trustedOrigins`), session cookie management, and authorization middleware for Hono microservices.

---

## Installation

```bash
pnpm add @pands/auth
# or with npm:
npm install @pands/auth
```

---

## Usage

### Server-Side Auth Setup

```typescript
import { createPandAuth } from "@pands/auth";
import { db } from "./db/index.js";

export const auth = createPandAuth({
  db,
  baseURL: process.env.PAND_PUBLIC_WEB_URL || "http://localhost:3002",
  secret: process.env.BETTER_AUTH_SECRET || "dev-secret-32-chars-long",
  trustedOrigins: [
    "http://localhost:3002",
    "http://localhost:3003",
  ],
});
```

### Route Protection Middleware

```typescript
import { requireAuth, requireRole } from "@pands/auth";

app.get("/api/v1/protected", requireAuth(), (c) => {
  const user = c.get("user");
  return c.json({ user });
});

app.post("/api/v1/admin-only", requireRole("admin"), (c) => {
  return c.json({ ok: true });
});
```

### Client-Side Auth Hook

```typescript
import { createPandAuthClient } from "@pands/auth/client";

export const authClient = createPandAuthClient({
  baseURL: "http://localhost:3001",
});

const { data: session, isPending } = authClient.useSession();
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
