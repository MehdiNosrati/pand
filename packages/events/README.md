# @pands/events

> Durable event bus, background job queues, and cron scheduling using `pg-boss` for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/events.svg)](https://www.npmjs.com/package/@pands/events)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/events` enables asynchronous message publishing, durable background job execution, retries, and scheduled cron jobs backed by PostgreSQL (`pg-boss`) or an in-memory test driver.

---

## Installation

```bash
pnpm add @pands/events
# or with npm:
npm install @pands/events
```

---

## Usage

### Define Typed Events

```typescript
import { createEventBus, defineEvent, defineCron } from "@pands/events";
import { z } from "zod";

const bus = createEventBus({
  driver: "pg-boss",
  connectionString: process.env.DATABASE_URL,
});

const UserSignedUp = defineEvent("user.signed_up", z.object({
  userId: z.string(),
  email: z.string().email(),
}));

// Subscribe to event
bus.subscribe(UserSignedUp, async (payload) => {
  console.log(`Sending welcome email to ${payload.email}`);
});

// Publish event
await bus.publish(UserSignedUp, {
  userId: "user_123",
  email: "alice@example.com",
});

// Schedule Cron Job
defineCron(bus, {
  name: "daily-report",
  cron: "0 0 * * *",
  handler: async () => {
    console.log("Generating daily report...");
  },
});
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
