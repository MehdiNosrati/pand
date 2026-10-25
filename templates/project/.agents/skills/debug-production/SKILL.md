---
name: debug-production
description: Triage production errors using structured logs, distributed traces, and read-only SQL.
---

# Debug Production Runbook

1. **Inspect Error Logs**:
   Run `pand logs --level error --since 1h --json` (or MCP tool `pand_logs_query`).
2. **Correlate via `trace_id`**:
   Copy the `trace_id` from the failing log entry and run `pand traces --trace-id <trace_id> --json` (or MCP tool `pand_traces_query`) to inspect the full span waterfall and SQL statements.
3. **Check RED Metrics**:
   Run `pand metrics --window 1h --json` to inspect request rate, 5xx error percentage, and p95 latency.
4. **Inspect Database State Safely**:
   Use MCP tool `pand_db_query_readonly` (runs inside `BEGIN READ ONLY ... ROLLBACK` with a 5s timeout).
