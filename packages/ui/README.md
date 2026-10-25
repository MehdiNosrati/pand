# @pands/ui

> Accessible React component library with Tailwind CSS v4 for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/ui.svg)](https://www.npmjs.com/package/@pands/ui)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/ui` provides a unified set of modern, accessible UI components styled with Tailwind CSS v4, including forms, data tables, dialogs, cards, navigation bars, and application shells.

---

## Installation

```bash
pnpm add @pands/ui
# or with npm:
npm install @pands/ui
```

---

## Setup with Tailwind CSS v4

In your application's `styles.css`:

```css
@import "tailwindcss";
@source "../node_modules/@pands/ui";
```

And import styles in your entry point:
```typescript
import "@pands/ui/styles.css";
```

---

## Usage

```tsx
import { 
  Button, 
  Input, 
  Card, 
  Badge, 
  DataTable, 
  Dialog,
  AppShell 
} from "@pands/ui";

export function Dashboard() {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Active Invoices</h2>
        <Badge variant="success">Live</Badge>
      </div>
      
      <Input placeholder="Filter by invoice ID..." />
      <Button variant="primary">Create Invoice</Button>
    </Card>
  );
}
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
