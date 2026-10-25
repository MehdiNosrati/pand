# @pands/config

> Configuration schema, loader, and deterministic port allocator for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/config.svg)](https://www.npmjs.com/package/@pands/config)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/config` defines the standard `pand.config.ts` configuration file format and provides deterministic FNV-1a port hash allocation to avoid local port conflicts across microservices and parallel projects.

---

## Installation

```bash
pnpm add @pands/config
# or with npm:
npm install @pands/config
```

---

## Usage

### Define Configuration (`pand.config.ts`)

```typescript
import { defineConfig } from "@pands/config";

export default defineConfig({
  name: "acme-corp",
  displayName: "Acme Corporation",
  version: "0.1.0",
  apps: {
    web: true,
    admin: true,
    ios: false,
    android: false,
  },
  services: {
    core: { portOffset: 10, db: true },
    billing: { portOffset: 11, db: true },
  },
});
```

### Resolve Project Ports

```typescript
import { loadPandConfig, resolveProjectPorts } from "@pands/config";

const { config, rootDir } = await loadPandConfig();
const ports = resolveProjectPorts(config);

console.log(ports.gatewayPort); // e.g. 3001
console.log(ports.webPort);     // e.g. 3002
console.log(ports.adminPort);   // e.g. 3003
console.log(ports.services.billing); // e.g. 3011
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
