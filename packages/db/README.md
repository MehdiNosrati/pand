# @pands/db

> PostgreSQL connection management, Drizzle ORM helpers, multi-tenant isolation, and cursor pagination for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/db.svg)](https://www.npmjs.com/package/@pands/db)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/db` simplifies working with isolated PostgreSQL schemas per microservice, standardized column definitions, cursor-based pagination, and schema migrations.

---

## Installation

```bash
pnpm add @pands/db drizzle-orm pg
# or with npm:
npm install @pands/db drizzle-orm pg
```

---

## Usage

### Create a Service Database Instance

```typescript
import { createServiceDb, standardColumns } from "@pands/db";
import { pgTable, text } from "drizzle-orm/pg-core";

export const invoicesTable = pgTable("invoices", {
  ...standardColumns(),
  description: text("description").notNull(),
});

export const { db, close } = createServiceDb("billing", {
  schema: { invoicesTable },
});
```

### Cursor-Based Pagination

```typescript
import { paginateWithCursor } from "@pands/db";

const { items, nextCursor } = await paginateWithCursor(db, invoicesTable, {
  cursor: "018f...uuid",
  limit: 20,
  orderBy: "createdAt",
  direction: "desc",
});
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
