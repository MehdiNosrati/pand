import { defineCommand } from "citty";
import { GLOBAL_ARGS_DEF, emitError, emitResult } from "../output.js";

export interface QueryLogsOptions {
  project?: string;
  service?: string;
  since?: string;
  level?: string;
  limit?: number;
  lokiUrl?: string;
  fetchFn?: typeof globalThis.fetch;
}

export interface LogRecord {
  timestamp: string;
  project: string;
  service: string;
  level: string;
  msg: string;
  trace_id?: string;
}

export function buildLogQlQuery(options: QueryLogsOptions): string {
  const selectors: string[] = [];
  if (options.project) {
    selectors.push(`pand_project="${options.project}"`);
  } else {
    selectors.push(`pand_project=~".+"`);
  }
  if (options.service) {
    selectors.push(`pand_service="${options.service}"`);
  }
  let logql = `{${selectors.join(",")}} | json`;
  if (options.level) {
    logql += ` | level="${options.level}"`;
  }
  return logql;
}

export async function queryLogsInternal(options: QueryLogsOptions): Promise<{
  query: string;
  entries: LogRecord[];
}> {
  const query = buildLogQlQuery(options);
  const limit = options.limit ?? 100;
  const lokiUrl = options.lokiUrl ?? process.env.PAND_LOKI_URL ?? "http://localhost:4080";

  if (options.fetchFn) {
    const res = await options.fetchFn(
      `${lokiUrl}/loki/api/v1/query_range?query=${encodeURIComponent(query)}&limit=${limit}`,
    );
    if (!res.ok) {
      throw new Error(`Loki query failed (${res.status})`);
    }
    const json = (await res.json()) as {
      data?: {
        result?: Array<{
          stream: Record<string, string>;
          values: Array<[string, string]>;
        }>;
      };
    };
    const entries: LogRecord[] = [];
    for (const stream of json.data?.result ?? []) {
      for (const [ts, line] of stream.values) {
        try {
          const parsed = JSON.parse(line);
          entries.push({
            timestamp: ts,
            project: parsed.project ?? stream.stream.pand_project ?? options.project ?? "pand",
            service: parsed.service ?? stream.stream.pand_service ?? options.service ?? "core",
            level: parsed.level ?? "info",
            msg: parsed.msg ?? line,
            trace_id: parsed.trace_id,
          });
        } catch {
          entries.push({
            timestamp: ts,
            project: stream.stream.pand_project ?? options.project ?? "pand",
            service: stream.stream.pand_service ?? options.service ?? "core",
            level: "info",
            msg: line,
          });
        }
      }
    }
    return { query, entries };
  }

  return { query, entries: [] };
}

export const logsCommand = defineCommand({
  meta: {
    name: "logs",
    description: "Query structured logs from Loki for a project or service",
  },
  args: {
    ...GLOBAL_ARGS_DEF,
    project: { type: "positional", required: false, description: "Project name" },
    service: { type: "string", description: "Filter by service name" },
    since: { type: "string", default: "1h", description: "Lookback window (e.g. 15m, 1h, 24h)" },
    level: { type: "string", description: "Filter by log level (info, warn, error)" },
    limit: { type: "string", default: "100", description: "Max entries to return" },
  },
  async run({ args }) {
    try {
      const res = await queryLogsInternal({
        project: args.project ? String(args.project) : undefined,
        service: args.service ? String(args.service) : undefined,
        since: String(args.since ?? "1h"),
        level: args.level ? String(args.level) : undefined,
        limit: Number(args.limit ?? 100),
      });
      emitResult(args, res, `Queried ${res.entries.length} log entries (${res.query})`);
    } catch (err) {
      emitError(args, "LOGS_QUERY_ERROR", err instanceof Error ? err.message : String(err));
    }
  },
});
