# @pands/gateway

> Reverse proxy gateway, OpenAPI specification merger, rate limiting, and internal JWT signer for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/gateway.svg)](https://www.npmjs.com/package/@pands/gateway)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/gateway` sits in front of all microservices, routing incoming requests, managing public-to-private API namespaces, enforcing rate limits, validating session authentication, and injecting verified internal identity JWTs.

---

## Installation

```bash
pnpm add @pands/gateway
# or with npm:
npm install @pands/gateway
```

---

## Usage

### Create Gateway App

```typescript
import { createGatewayApp } from "@pands/gateway";

const app = createGatewayApp({
  title: "Acme API Gateway",
  version: "0.1.0",
  services: {
    core: { target: "http://localhost:3010", prefix: "/api/v1/core" },
    billing: { target: "http://localhost:3011", prefix: "/api/v1/billing" },
  },
  authServiceTarget: "http://localhost:3010",
  internalSecret: process.env.PAND_INTERNAL_SECRET || "dev-internal-secret",
});

export default app;
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
