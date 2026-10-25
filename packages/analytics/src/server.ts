import { PostHog } from "posthog-node";

export interface CreateServerAnalyticsOptions {
  project: string;
  env?: string;
  publicKey?: string;
  personalApiKey?: string;
  host?: string;
  flagsPollingInterval?: number;
}

export interface ServerAnalytics {
  enabled: boolean;
  flagsPollingInterval: number;
  host: string;
  capture: (distinctId: string, event: string, properties?: Record<string, unknown>) => void;
  captureServerException: (err: unknown, actor?: { userId?: string; email?: string }) => void;
  isFeatureEnabled: (key: string, distinctId: string) => Promise<boolean>;
  shutdown: () => Promise<void>;
}

export function createServerAnalytics(options: CreateServerAnalyticsOptions): ServerAnalytics {
  const publicKey = options.publicKey ?? process.env.POSTHOG_PUBLIC_KEY;
  const personalApiKey = options.personalApiKey ?? process.env.POSTHOG_PERSONAL_API_KEY;
  const host = options.host ?? process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com";
  const flagsPollingInterval = options.flagsPollingInterval ?? 300_000;
  const env = options.env ?? process.env.PAND_ENV ?? "dev";

  const client = publicKey
    ? new PostHog(publicKey, {
        host,
        personalApiKey,
        featureFlagsPollingInterval: flagsPollingInterval,
      })
    : null;

  return {
    enabled: Boolean(client),
    flagsPollingInterval,
    host,
    capture(distinctId, event, properties = {}) {
      if (!client) return;
      client.capture({
        distinctId,
        event,
        properties: {
          ...properties,
          pand_project: options.project,
          pand_env: env,
        },
      });
    },
    captureServerException(err, actor) {
      if (!client) return;
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      client.capture({
        distinctId: actor?.userId ?? "system",
        event: "$exception",
        properties: {
          $exception_message: message,
          $exception_stack_trace_raw: stack,
          actor_email: actor?.email,
          pand_project: options.project,
          pand_env: env,
        },
      });
    },
    async isFeatureEnabled(key, distinctId) {
      if (!client) return false;
      const res = await client.isFeatureEnabled(key, distinctId);
      return Boolean(res);
    },
    async shutdown() {
      if (client) {
        await client.shutdown();
      }
    },
  };
}
