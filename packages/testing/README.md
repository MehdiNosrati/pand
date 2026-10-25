# @pands/testing

> Test context, in-memory adapters, ephemeral PostgreSQL database provisioning, and token minting for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/testing.svg)](https://www.npmjs.com/package/@pands/testing)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/testing` provides isolated test harnesses for integration testing microservices, creating ephemeral PostgreSQL databases with automatic teardown, and minting internal test JWTs.

---

## Installation

```bash
pnpm add -D @pands/testing
# or with npm:
npm install -D @pands/testing
```

---

## Usage

```typescript
import { createTestDatabase, mintTestInternalToken } from "@pands/testing";
import { describe, expect, it } from "vitest";

describe("Billing Service", () => {
  it("processes invoice in isolated database", async () => {
    // Creates a unique ephemeral PostgreSQL database (e.g. test_a1b2c3)
    const testDb = await createTestDatabase();

    try {
      // Mint internal identity token
      const token = mintTestInternalToken({
        userId: "user_test",
        role: "admin",
      });

      expect(testDb.databaseUrl).toContain("test_");
    } finally {
      // Drops the ephemeral database cleanly
      await testDb.cleanup();
    }
  });
});
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
