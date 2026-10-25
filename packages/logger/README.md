# @pands/logger

> High-performance Pino structured logger with automatic secret redaction for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/logger.svg)](https://www.npmjs.com/package/@pands/logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/logger` standardizes JSON logging across microservices with automatic redaction of sensitive credentials, tokens, and authorization headers.

---

## Installation

```bash
pnpm add @pands/logger
# or with npm:
npm install @pands/logger
```

---

## Usage

```typescript
import { createLogger } from "@pands/logger";

const logger = createLogger({
  service: "billing",
  level: process.env.LOG_LEVEL || "info",
});

logger.info({ invoiceId: "inv_123", amount: 200 }, "Invoice processed successfully");
logger.error(new Error("Failed to charge card"), "Payment processing failed");
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
