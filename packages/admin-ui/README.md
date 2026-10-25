# @pands/admin-ui

> Auto-generated admin console and CRUD interface for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/admin-ui.svg)](https://www.npmjs.com/package/@pands/admin-ui)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/admin-ui` introspects Pand microservice endpoints and metadata to render an instant, full-featured administrative control panel with dynamic CRUD tables, filter bars, pagination, and user access management.

---

## Installation

```bash
pnpm add @pands/admin-ui @pands/ui
# or with npm:
npm install @pands/admin-ui @pands/ui
```

---

## Usage

```tsx
import { AdminApp } from "@pands/admin-ui";
import "@pands/ui/styles.css";

export default function Admin() {
  return (
    <AdminApp
      apiBaseUrl="http://localhost:3001"
      title="Acme Admin Console"
    />
  );
}
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
