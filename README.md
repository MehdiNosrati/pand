# Pand — Agent-Native Application Platform

[![Documentation](https://img.shields.io/badge/docs-mahdins.dev%2Fpand-6366f1?style=flat-square)](https://mahdins.dev/pand/)
[![License: MIT](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](https://github.com/MehdiNosrati/pand)

**Pand** is an opinionated, agent-native full-stack and multi-platform application framework. Define your domain once—via CLI, TypeScript contracts, or the built-in Model Context Protocol (MCP) server—and Pand generates and wires your **PostgreSQL schema (Drizzle)**, **OpenAPIHono microservice**, **API Gateway**, **typed Web/Admin/iOS/Android SDKs**, **Next.js UI views**, **SwiftUI views**, **Jetpack Compose screens**, and **Single-Box production deployment**.

👉 **[Read the Full Documentation & API Reference →](https://mahdins.dev/pand/)**

---

## ⚡ 60-Second Quickstart

```bash
# 1. Scaffold a new Pand monorepo
pand new my-saas --web --admin --ios --android
cd my-saas

# 2. Add a microservice (deterministic port assigned automatically)
pand add service billing

# 3. Scaffold a full-stack entity across DB, API, SDK, Web, iOS, and Android
pand add entity invoice \
  --service billing \
  --fields "customerId:uuid,amountCents:int,currency:string=USD,status:enum(draft|open|paid|void)=draft,paidAt:datetime?" \
  --web --ios --android

# 4. Generate & apply per-service SQL migrations
pand db generate && pand db migrate

# 5. Regenerate typed TypeScript, Swift, and Kotlin SDKs
pand sdk gen

# 6. Start local infrastructure + services + gateway + web
pand dev

# 7. Run the 5-stage verification gate (types, lint, OpenAPI, SDK drift, tests)
pand check
```

Every CLI command supports `--json` for structured machine-readable output designed for autonomous coding agents.

---

## 🌟 Reference & Showcase Applications

Explore real-world applications built with the Pand platform:

- **[Todo Pand (`todo-pand`)](https://github.com/MehdiNosrati/todo-pand)** — The official full-stack reference showcase application.
  - **Full-Stack Monorepo**: PostgreSQL (Drizzle) + Hono OpenAPI 3.1 microservice + API Gateway + generated typed client SDK (`@todo-pand/sdk`) + React 19 / Tailwind CSS v4 consumer web app + reactive Admin console.
  - **Multi-Tenant Scoping**: Complete user-level row isolation via `ownerId` and short-lived internal identity JWTs (`c.get("actor")!.sub`).
  - **Guest-to-Account Sync**: Instant zero-login productivity with browser `localStorage` workspace fallback, automatic migration (`POST /todos/import-guest`), and "account wins" conflict resolution.
  - **Dual View Modes & UI**: Kanban boards, list tables, custom keyboard-accessible dropdown select controls, priority tracking (`Urgent`, `High`, `Medium`, `Low`), search, and due date filters.
  - **Admin Operations**: Dynamic CRUD tables and Better Auth administrative user management (roles, bans, and audits) powered by `@pand/admin-ui`.

---

## 🏗️ Architecture at a Glance

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   Web (Next.js)  │  │  Admin Console   │  │   iOS (SwiftUI)  │  │ Android (Compose)│
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         └─────────────────────┴──────────┬──────────┴─────────────────────┘
                                          ▼
                               ┌────────────────────┐
                               │    @pand/sdk       │  (Generated TS / Swift / Kotlin)
                               └──────────┬─────────┘
                                          ▼
                         ┌──────────────────────────────────┐
                         │   @pand/gateway (Port 3000)      │
                         │  CORS • Rate Limit • Auth • SSE  │
                         └─────┬──────────────────────┬─────┘
        x-pand-identity (JWT)  │                      │  /api/v1/<service>/*
               ┌───────────────▼──────┐        ┌──────▼───────────────┐
               │  services/core       │        │  services/billing    │
               │  (@pand/service)     │        │  (@pand/service)     │
               └───────┬──────────────┘        └──────┬───────────────┘
                       │ pgSchema("core")             │ pgSchema("billing")
                       └───────────────┬──────────────┘
                                       ▼
                     ┌──────────────────────────────────┐
                     │ PostgreSQL 16 • Redis 7 • MinIO  │
                     └──────────────────────────────────┘
```

### Core Invariants
1. **Deterministic Port Hashing**: Each service receives a collision-free port in `4000..8900` (`4000 + (fnv1a32(name) % 50) * 100`) and never hardcodes ports.
2. **Per-Service Database Isolation**: Every service owns its own PostgreSQL schema (`pgSchema(serviceName)`) and migration table (`__drizzle_migrations_<service>`).
3. **Gateway Identity Propagation**: `@pand/gateway` validates sessions/API keys and injects a short-lived (`60s` TTL) HS256-signed `x-pand-identity` JWT that `@pand/service` verifies on every request.
4. **Zero-Drift Multi-Platform SDKs**: `pand sdk gen` compiles merged OpenAPI 3.1 specs into typed TypeScript (`packages/sdk`), Swift (`ios/Sources/PandSDK`), and Kotlin (`android/pand-sdk`) clients.

---

## 📦 Workspace Packages

| Package | Description |
| :--- | :--- |
| `@pand/config` | `defineConfig` schema, `pand.config.ts` loader, and deterministic FNV-1a port allocator |
| `@pand/cli` | `pand` CLI (`new`, `add`, `db`, `sdk`, `check`, `dev`, `secret`, `box`, `deploy`, `backup`, `logs`, `metrics`, `traces`, `usage`, `preview`, `upgrade`) |
| `@pand/service` | `createService`, `defineEntity`, `registerCrudRoutes` on `@hono/zod-openapi` |
| `@pand/gateway` | `createGateway` reverse proxy, sliding-window rate limiter, SSE event stream, internal JWT signer |
| `@pand/db` | `createServiceDb`, `standardColumns`, `scopeToOrg` multi-tenant helper, cursor pagination |
| `@pand/auth` | `createPandAuth` server & client, session & bearer tokens, OAuth, RBAC, password hashing |
| `@pand/sdk-gen` | OpenAPI 3.1 merger and TypeScript, Swift (`PandSDK.swift`), & Kotlin (`PandSDK.kt`) generators |
| `@pand/ui` | Accessible React primitives (`Button`, `Input`, `Select`, `Badge`, `Card`, `Dialog`, `DataTable`, `AutoForm`, `Toast`) |
| `@pand/admin-ui` | Auto-generated CRUD Admin Console powered by `/api/v1/_meta` |
| `@pand/events` | BullMQ + Redis event bus & background jobs (`createEventBus`, `defineEvent`, `defineCron`) + in-memory test bus |
| `@pand/storage` | S3 / MinIO / R2 storage client (`putObject`, `getObject`, `presignUpload`, `presignDownload`) + memory adapter |
| `@pand/push` | Expo, APNs, and FCM push dispatcher (`createPushClient`) + memory adapter |
| `@pand/analytics` | Batched product analytics client & server ingestor (`track`, `identify`, `flush`) |
| `@pand/mcp` | Model Context Protocol (MCP) server exposing 13 structured tools + safety guardrails for AI agents |
| `@pand/logger` | Structured Pino JSON logger with automatic secret redaction |
| `@pand/telemetry` | OpenTelemetry OTLP initialization + Prometheus metrics registry & middleware |
| `@pand/testing` | `createTestContext`, `testService`, and factory builders for isolated integration tests |

---

## 🤖 Agent Skills & MCP Integration

Pand ships with 6 ready-to-use agent skills in [`skills/`](./skills) (also mirrored in [`.agents/skills/`](./.agents/skills) and scaffolded into every new project via `pand new`):

| Skill | Path | Purpose |
| :--- | :--- | :--- |
| **`pand`** | [`skills/pand/SKILL.md`](./skills/pand/SKILL.md) | Master skill covering Pand CLI, Field DSL, `@pand/*` APIs, migrations, SDK generation, and Box deployment |
| **`add-feature`** | [`skills/add-feature/SKILL.md`](./skills/add-feature/SKILL.md) | End-to-end runbook for scaffolding an entity across DB, Service, SDK, Web, iOS, and Android |
| **`add-endpoint`** | [`skills/add-endpoint/SKILL.md`](./skills/add-endpoint/SKILL.md) | Runbook for adding custom non-CRUD OpenAPI routes with Zod validation and integration tests |
| **`modify-schema`** | [`skills/modify-schema/SKILL.md`](./skills/modify-schema/SKILL.md) | Runbook for safely evolving Drizzle PostgreSQL schemas and generating forward migrations |
| **`add-mobile-screen`** | [`skills/add-mobile-screen/SKILL.md`](./skills/add-mobile-screen/SKILL.md) | Runbook for building SwiftUI (iOS) and Jetpack Compose (Android) screens backed by `PandSDK` |
| **`debug-production`** | [`skills/debug-production/SKILL.md`](./skills/debug-production/SKILL.md) | Runbook for triaging errors with Loki logs, Tempo traces (`trace_id`), Prometheus metrics, and read-only SQL |

---

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Build all packages and reference apps
pnpm build

# Run Biome lint & formatting checks
pnpm lint

# Run TypeScript typechecks across all 22 workspace packages
pnpm typecheck

# Run the Vitest test suite
pnpm test
```

## 📚 Documentation

Full documentation—including Getting Started, CLI Reference, Field DSL, Package API Reference, Native Mobile SDKs, Box Deployment, and MCP Agent Integration—is hosted on GitHub Pages:

🔗 **[https://mahdins.dev/pand/](https://mahdins.dev/pand/)** (or `https://mehdinosrati.github.io/pand/`)
