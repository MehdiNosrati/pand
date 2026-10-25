import { describe, expect, it, vi } from "vitest";
import { buildLogQlQuery, queryLogsInternal } from "../src/commands/logs.js";
import { queryMetricsInternal } from "../src/commands/metrics.js";
import { queryTracesInternal } from "../src/commands/traces.js";
import { checkUsageInternal } from "../src/commands/usage.js";

describe("pand telemetry CLI commands (logs, metrics, traces, usage)", () => {
  it("queries Loki logs, Prometheus RED metrics, Tempo traces, and free-tier usage quotas", async () => {
    const logql = buildLogQlQuery({ project: "acme", service: "core", level: "error" });
    expect(logql).toBe('{pand_project="acme",pand_service="core"} | json | level="error"');

    const mockLokiFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              result: [
                {
                  stream: { pand_project: "acme", pand_service: "core" },
                  values: [
                    [
                      "1700000000000000000",
                      JSON.stringify({
                        level: "error",
                        msg: "db timeout",
                        trace_id: "trace-abc-123",
                      }),
                    ],
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        ),
    ) as unknown as typeof globalThis.fetch;

    const logsRes = await queryLogsInternal({
      project: "acme",
      service: "core",
      level: "error",
      fetchFn: mockLokiFetch,
    });
    expect(logsRes.entries).toHaveLength(1);
    expect(logsRes.entries[0]!.trace_id).toBe("trace-abc-123");

    const metricsRes = await queryMetricsInternal({ project: "acme", window: "1h" });
    expect(metricsRes.services.length).toBeGreaterThan(0);

    const tracesRes = await queryTracesInternal({
      project: "acme",
      traceId: "trace-abc-123",
    });
    expect(tracesRes.traces[0]!.traceId).toBe("trace-abc-123");

    const usageRes = await checkUsageInternal({ posthogEventsUsed: 850_000 });
    expect(usageRes.posthogEu.warning).toBe(true);
  });
});
