---
name: add-endpoint
description: How to add a custom non-CRUD OpenAPI route to a Pand service.
---

# Add Custom Endpoint Runbook

1. Open `services/<service>/src/routes/` and define your input/output Zod schemas with `.openapi("<Name>")`.
2. Define the route using `createRoute` from `@pand/service` (`@hono/zod-openapi`), using `requireAuth()` or `requireAdmin()` middleware as needed.
3. Mount the route in `services/<service>/src/routes/index.ts`.
4. Run `pand sdk gen` so `@<project>/sdk` and `packages/contracts/openapi.json` include the new endpoint.
5. Add an integration test in `services/<service>/test/` and run `pand check`.
