# @pands/analytics

> Product analytics and telemetry client for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/analytics.svg)](https://www.npmjs.com/package/@pands/analytics)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/analytics` provides client and server event tracking, automatic identity resolution, batched delivery, and PostHog integration.

---

## Installation

```bash
pnpm add @pands/analytics
# or with npm:
npm install @pands/analytics
```

---

## Usage

### Server-Side Tracking

```typescript
import { createAnalyticsClient } from "@pands/analytics/server";

const analytics = createAnalyticsClient({
  apiKey: process.env.POSTHOG_API_KEY,
  host: "https://eu.i.posthog.com",
});

await analytics.track({
  distinctId: "user_123",
  event: "invoice_created",
  properties: {
    amount: 1500,
    currency: "USD",
  },
});
```

### React Web Tracking

```tsx
import { AnalyticsProvider, useAnalytics } from "@pands/analytics/web";

function CheckoutButton() {
  const { track } = useAnalytics();

  return (
    <button onClick={() => track("checkout_clicked", { plan: "pro" })}>
      Upgrade to Pro
    </button>
  );
}
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
