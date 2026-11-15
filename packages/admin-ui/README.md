# @pands/admin-ui

> Auto-generated admin console and CRUD interface for the **Pand Application Platform**, powered by **Methane UI** (`@methane-ui/*`).

[![npm version](https://img.shields.io/npm/v/@pands/admin-ui.svg)](https://www.npmjs.com/package/@pands/admin-ui)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/admin-ui` introspects Pand microservice endpoints and metadata to render a full administrative control panel with dynamic CRUD tables, search, modals, and user access management using Methane UI web components and tokens.

---

## Installation

```bash
pnpm add @pands/admin-ui @methane-ui/tokens @methane-ui/css @methane-ui/ui @methane-ui/core @methane-ui/react
# or with npm:
npm install @pands/admin-ui @methane-ui/tokens @methane-ui/css @methane-ui/ui @methane-ui/core @methane-ui/react
```

---

## Usage

```tsx
import { AdminApp } from "@pands/admin-ui";
import "@methane-ui/tokens/tokens.css";
import "@methane-ui/css/index.css";
import "@pands/admin-ui/styles.css";
import "@methane-ui/react";

export default function Admin() {
  return <AdminApp />;
}
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
