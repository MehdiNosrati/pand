# @pands/cli

> Command-line interface and code generation engine for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/cli.svg)](https://www.npmjs.com/package/@pands/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/cli` provides scaffolding, schema migrations, client SDK generation, drift detection, and local runtime management for Pand projects.

---

## Installation

```bash
npm install -g @pands/cli
# or execute directly with npx:
npx @pands/cli --help
```

---

## Commands

### Project Scaffolding
- `pand new <name>` — Scaffolds a complete Pand monorepo (API gateway, core microservice, web and admin apps).
- `pand add service <name>` — Adds a modular backend microservice with OpenAPI route definition and Drizzle database connection.
- `pand add entity <service> <Entity> --fields "<dsl>"` — Adds a typed entity with schema, CRUD endpoints, and optional `--web`, `--ios`, or `--android` screens.

### Database & Migrations
- `pand db generate` — Runs incremental schema diffing and emits deterministic PostgreSQL migrations with baseline snapshots.
- `pand db migrate` — Executes pending migrations against PostgreSQL.
- `pand db seed` — Populates local development data.

### SDK & Contracts
- `pand sdk gen` — Merges all microservice OpenAPI 3.1 specifications into `@<project>/contracts` and generates typed TypeScript, Swift, and Kotlin client SDKs.
- `pand sdk gen --check` — Verifies that client SDKs and OpenAPI contracts are free of drift.

### Development & Checks
- `pand dev` — Boots API gateway, all microservices, and Vite frontends with hot-reload and unified logging.
- `pand check` — Runs Biome linter, formatter, TypeScript typecheck, and migration drift analysis.

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
