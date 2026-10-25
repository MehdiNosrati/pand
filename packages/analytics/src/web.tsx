import posthog from "posthog-js";
import type React from "react";
import { createContext, useContext, useEffect } from "react";

export interface PandClientAnalyticsConfig {
  project: string;
  env: "dev" | "staging" | "prod";
  analytics?: {
    enabled: boolean;
    publicKey: string | null;
    ingestPath: string;
  };
}

export interface PandAnalyticsContextValue {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  isFeatureEnabled: (key: string) => boolean;
}

const AnalyticsContext = createContext<PandAnalyticsContextValue>({
  capture: () => {},
  identify: () => {},
  isFeatureEnabled: () => false,
});

export function buildPosthogWebInitOptions(config: PandClientAnalyticsConfig) {
  return {
    api_host: config.analytics?.ingestPath ?? "/ingest",
    ui_host: "https://eu.posthog.com",
    capture_pageview: true,
    capture_exceptions: true,
    session_recording: {
      sampleRate: 0.25,
    },
    superProperties: {
      pand_project: config.project,
      pand_env: config.env,
    },
  };
}

export function PandAnalyticsProvider({
  config,
  children,
}: {
  config: PandClientAnalyticsConfig;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const publicKey = config.analytics?.publicKey;
    if (!config.analytics?.enabled || !publicKey) return;
    const opts = buildPosthogWebInitOptions(config);
    posthog.init(publicKey, {
      api_host: opts.api_host,
      ui_host: opts.ui_host,
      capture_pageview: opts.capture_pageview,
      capture_exceptions: opts.capture_exceptions,
      loaded: (ph) => {
        ph.register(opts.superProperties);
      },
    });
  }, [config]);

  const value: PandAnalyticsContextValue = {
    capture: (event, properties) => {
      if (config.analytics?.enabled && config.analytics?.publicKey) {
        posthog.capture(event, properties);
      }
    },
    identify: (userId, traits) => {
      if (config.analytics?.enabled && config.analytics?.publicKey) {
        posthog.identify(userId, traits);
      }
    },
    isFeatureEnabled: (key) => {
      if (config.analytics?.enabled && config.analytics?.publicKey) {
        return Boolean(posthog.isFeatureEnabled(key));
      }
      return false;
    },
  };

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): PandAnalyticsContextValue {
  return useContext(AnalyticsContext);
}

export function useFeatureFlag(key: string): boolean {
  const ctx = useContext(AnalyticsContext);
  return ctx.isFeatureEnabled(key);
}
