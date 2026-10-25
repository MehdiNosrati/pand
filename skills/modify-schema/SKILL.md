---
name: modify-schema
description: Safely add or alter columns in a Pand service database schema.
---

# Modify Schema Runbook

1. Edit the Drizzle table definition in `services/<service>/src/db/schema/<table-kebab>.ts`.
2. Update the corresponding Zod schemas and route handlers in `services/<service>/src/routes/<table-kebab>.ts`.
3. Run `pand db generate` to emit a forward SQL migration in `services/<service>/drizzle/`.
4. Run `pand db migrate` to apply the migration against the local dev database.
5. Run `pand sdk gen && pand check` to verify zero contract drift and passing tests.
