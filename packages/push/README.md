# @pands/push

> Push notification dispatcher supporting APNs, FCM, Expo, and in-memory test drivers for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/push.svg)](https://www.npmjs.com/package/@pands/push)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/push` standardizes mobile and web push delivery with multi-provider fallback and deterministic payload validation.

---

## Installation

```bash
pnpm add @pands/push
# or with npm:
npm install @pands/push
```

---

## Usage

```typescript
import { createPushClient } from "@pands/push";

const push = createPushClient({
  driver: "expo", // or "apns" | "fcm" | "memory"
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

await push.send({
  to: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  title: "Invoice Paid",
  body: "Invoice #INV-2026 was successfully paid.",
  data: { invoiceId: "inv-2026" },
});
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
