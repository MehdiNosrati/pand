# @pands/telemetry

> OpenTelemetry tracing and Prometheus metrics middleware for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/telemetry.svg)](https://www.npmjs.com/package/@pands/telemetry)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/telemetry` provides instant observability with OTLP trace export (Tempo, Jaeger) and Prometheus metrics endpoints for Hono microservices.

---

## Installation

```bash
pnpm add @pands/telemetry
# or with npm:
npm install @pands/telemetry
```

---

## Usage

```typescript
import { initTelemetry, metricsMiddleware, getMetrics } from "@pands/telemetry";
import { Hono } from "hono";

// Initialize OTLP tracer
initTelemetry({
  serviceName: "billing",
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:3018",
});

const app = new Hono();

// Collect HTTP request metrics
app.use("*", metricsMiddleware());

// Expose Prometheus metrics endpoint
app.get("/metrics", async (c) => {
  return c.text(await getMetrics());
});
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
