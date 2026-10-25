# @pands/mcp

> Model Context Protocol (MCP) server providing 13 structured tools and safety guardrails for AI coding agents on the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/mcp.svg)](https://www.npmjs.com/package/@pands/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/mcp` connects AI agents (such as Antigravity, Claude Code, Cursor, and Windsurf) directly to the Pand platform, exposing declarative tools for project scaffolding, entity generation, database migrations, and OpenAPI verification.

---

## Installation

```bash
pnpm add @pands/mcp
# or run directly:
npx @pands/mcp
```

---

## MCP Configuration

Add `@pands/mcp` to your agent's MCP configuration (e.g. `claude_desktop_config.json` or `.gemini/antigravity/mcp/`):

```json
{
  "mcpServers": {
    "pand": {
      "command": "npx",
      "args": ["@pands/mcp"]
    }
  }
}
```

---

## Tools Exposed

- `pand_new` — Scaffold a complete Pand project.
- `pand_add_service` — Add a backend microservice.
- `pand_add_entity` — Add an entity with schema and optional web/mobile UI.
- `pand_db_generate` — Generate incremental Drizzle migrations.
- `pand_db_migrate` — Execute migrations against PostgreSQL.
- `pand_sdk_gen` — Merge OpenAPI specs and generate typed client SDKs.
- `pand_check` — Run linter, typecheck, and migration drift analysis.

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
