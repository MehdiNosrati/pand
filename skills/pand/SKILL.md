---
name: pand
description: Build, scaffold, migrate, test, debug, and deploy full-stack web, admin, iOS (SwiftUI), and Android (Jetpack Compose) applications using the Pand Agent-Native Application Platform (`pand` CLI, `@pand/*` packages, and `@pand/mcp` tools).
---

# Pand Platform Skill

Use this skill whenever creating a new Pand project, adding microservices or entities, modifying Drizzle PostgreSQL schemas, generating TypeScript/Swift/Kotlin SDKs, wiring authentication or events, or deploying and debugging on a Pand Box.

## Golden Rules

1. **Always Scaffold First**: Use `pand new`, `pand add service`, and `pand add entity` (or their `@pand/mcp` tool equivalents) instead of writing boilerplate files by hand.
2. **Always Pass `--json` in Agent Workflows**: Every `pand` CLI command supports `--json` for deterministic machine-readable output.
3. **Never Edit Generated Artifacts**:
   - Do not hand-edit `packages/sdk/src/**`, `ios/Sources/PandSDK/PandSDK.swift`, `android/pand-sdk/**`, `**/openapi.json`, or `**/drizzle/meta/**`.
   - Preserve marker comments (`// pand:schemas`, `// pand:routes`, `// pand:entities`) in service entrypoints.
4. **Keep Contracts & SDKs in Sync**: Whenever a database table or OpenAPI route changes, run:
   ```bash
   pand db generate && pand db migrate && pand sdk gen
   ```
5. **Verify Before Completing Any Task**: Always run `pand check` (which executes TypeScript typechecks, Biome linting, OpenAPI validation, SDK drift detection, and Vitest integration tests) before finishing.

---

## Core Workflows

### 1. Create a New Project
```bash
pand new <project-name> --web --admin --ios --android --json
cd <project-name>
```

### 2. Add a Microservice
Each service gets a deterministic port (`4000 + (fnv1a32(name) % 50) * 100`) and its own isolated PostgreSQL schema (`pgSchema(serviceName)`):
```bash
pand add service <service-name> --json
```

### 3. Add a Full-Stack Entity (DB + API + SDK + Web + Mobile)
```bash
pand add entity <entity-name> \
  --service <service-name> \
  --fields "<field-dsl>" \
  --web --ios --android \
  --json
```

#### Field DSL Syntax (`name:type[?][!][=default]`)
- **Types**: `string`, `text`, `int`, `float`, `boolean`, `datetime`, `uuid`, `json`, `enum(val1|val2|val3)`
- **Modifiers**:
  - `?` — Nullable / optional field (e.g., `publishedAt:datetime?`)
  - `!` — Unique constraint (e.g., `slug:string!`)
  - `=value` — Default value (e.g., `status:enum(draft|active|archived)=draft`, `seats:int=1`)
- **Standard Columns**: `id` (UUIDv4 PK), `createdAt`, and `updatedAt` are added automatically via `standardColumns()`.

### 4. Database Migrations & Multi-Tenancy
```bash
# Generate idempotent SQL migrations per service
pand db generate --json

# Apply pending migrations to PostgreSQL
pand db migrate --json

# Seed service databases
pand db seed --json
```
- Always use `createServiceDb("<service>")` from `@pand/db`.
- Never join across different service PostgreSQL schemas; communicate across services via the SDK or `@pand/events`.
- For multi-tenant tables with an `organizationId` column, scope queries using `scopeToOrg(table.organizationId, ctx.var.identity?.orgId)`.

### 5. Custom Non-CRUD Endpoints (`@pand/service`)
1. Define request/response Zod schemas in `services/<service>/src/routes/` using `z` from `zod`.
2. Register the route on `service.app` using `createRoute` from `@hono/zod-openapi`.
3. Read the verified gateway identity from `c.get("identity")` (`{ sub, orgId, roles, scopes }`).
4. Run `pand sdk gen && pand check`.

### 6. Event Bus, Storage, Push & Analytics
- **Events (`@pand/events`)**: Define typed events with `defineEvent("domain.action", z.object({...}))` and publish/subscribe via `createEventBus()`.
- **Object Storage (`@pand/storage`)**: Use `createStorageClient()` for `putObject`, `getObject`, `presignUpload`, and `presignDownload` (use `driver: "memory"` in tests).
- **Push Notifications (`@pand/push`)**: Use `createPushClient()` for Expo, APNs, and FCM delivery.
- **Analytics (`@pand/analytics`)**: Use `createAnalyticsClient()` for batched event tracking.

### 7. Deployment, Previews, Backups & Observability
```bash
# Manage AES-256-GCM encrypted secrets
pand secret set DATABASE_URL="postgres://..." --env prod

# Initialize and deploy to a single-box Ubuntu VPS
pand box init --host 203.0.113.10 --user ubuntu --domain api.example.com
pand deploy --env prod

# Create an isolated branch preview environment
pand preview create feat-billing --ttl 24h

# Create or restore encrypted Restic + pg_dump backups
pand backup create

# Inspect production telemetry
pand logs --service core --level error --since 1h --json
pand metrics --service core --json
pand traces --service core --json
pand usage --json
```

---

## Sub-Runbooks in This Repository
- [`add-feature`](../add-feature/SKILL.md) — End-to-end feature scaffolding and verification
- [`add-endpoint`](../add-endpoint/SKILL.md) — Custom OpenAPI route authoring
- [`modify-schema`](../modify-schema/SKILL.md) — Safe Drizzle schema evolution and migrations
- [`add-mobile-screen`](../add-mobile-screen/SKILL.md) — Native SwiftUI (iOS) and Jetpack Compose (Android) screens
- [`debug-production`](../debug-production/SKILL.md) — Production triage with Loki logs, Tempo traces, and Prometheus metrics
