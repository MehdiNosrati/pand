# @pands/service

> Microservice application framework built on Hono and OpenAPI for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/service.svg)](https://www.npmjs.com/package/@pands/service)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/service` provides route definition, automatic OpenAPI 3.1 schema generation, CRUD endpoint scaffolding, health checks, and identity verification for backend services.

---

## Installation

```bash
pnpm add @pands/service
# or with npm:
npm install @pands/service
```

---

## Usage

### Create a Service App

```typescript
import { createServiceApp, serveService } from "@pands/service";

const app = createServiceApp({
  name: "billing",
  dbHealth: async () => true,
});

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
```

### Auto-Generated CRUD Routes

```typescript
import { registerCrudRoutes } from "@pands/service";
import { z } from "zod";

registerCrudRoutes(app, {
  resource: "invoices",
  entityName: "Invoice",
  schema: z.object({
    id: z.string().uuid(),
    amount: z.number().positive(),
    status: z.enum(["draft", "paid", "overdue"]),
  }),
  getDb: () => db,
  table: invoicesTable,
});
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
