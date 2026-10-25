# pands

> Standalone CLI binary for the **Pand Agent-Native Application Platform**.

[![npm version](https://img.shields.io/npm/v/pands.svg)](https://www.npmjs.com/package/pands)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Pand is an agent-native full-stack development platform designed for pairing autonomous AI coding agents with human developers. It provides modular TypeScript backend microservices, auto-generated OpenAPI contracts, typed client SDKs, a shared Tailwind CSS UI library, and instant local and cloud infrastructure.

---

## Installation

### Run without installing (Recommended)
```bash
npx pands new my-project
```

### Install globally
```bash
npm install -g pands
# or with pnpm:
pnpm add -g pands
```

This makes both the `pand` and `pands` commands available in your shell:

```bash
pand --help
```

---

## Quickstart

### 1. Scaffold a new full-stack project
```bash
pand new my-project
cd my-project
```

### 2. Add a backend microservice
```bash
pand add service billing
```

### 3. Add an entity with CRUD, schema, and web UI
```bash
pand add entity billing Invoice --fields "amount:number,status:enum(draft|paid|overdue)=draft,dueDate:datetime" --web
```

### 4. Generate database migrations & client SDK
```bash
pand db generate
pand sdk gen
```

### 5. Start the full development stack
```bash
pand dev
```

Spawns the API gateway, all microservices, and Vite frontends with hot-reload and deterministic port assignment.

---

## Documentation

Full documentation, guides, and package references are available at [github.com/MehdiNosrati/pand](https://github.com/MehdiNosrati/pand).

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
