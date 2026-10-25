import { describe, expect, it } from "vitest";
import { buildPosthogWebInitOptions, createServerAnalytics } from "../src/index.js";

describe("@pands/analytics", () => {
  it("configures PostHog EU web options with /ingest proxy and 25% replay sampling, and server local flag polling at 300s", async () => {
    const webOpts = buildPosthogWebInitOptions({
      project: "acme",
      env: "prod",
      analytics: {
        enabled: true,
        publicKey: "phc_test_123",
        ingestPath: "/ingest",
      },
    });
    expect(webOpts.api_host).toBe("/ingest");
    expect(webOpts.ui_host).toBe("https://eu.posthog.com");
    expect(webOpts.session_recording.sampleRate).toBe(0.25);
    expect(webOpts.superProperties).toEqual({
      pand_project: "acme",
      pand_env: "prod",
    });

    const serverAnalytics = createServerAnalytics({
      project: "acme",
      env: "prod",
    });
    expect(serverAnalytics.flagsPollingInterval).toBe(300_000);
    expect(serverAnalytics.host).toBe("https://eu.i.posthog.com");
    await serverAnalytics.shutdown();
  });
});
