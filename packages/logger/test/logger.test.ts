import { Writable } from "node:stream";
import { trace } from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";
import { createLogger } from "../src/index.js";

describe("@pand/logger", () => {
  it("writes structured JSON logs and redacts sensitive fields", () => {
    const lines: string[] = [];
    const dest = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });

    const logger = createLogger({
      service: "core",
      project: "todo",
      env: "test",
      level: "info",
      destination: dest,
    });

    logger.info(
      {
        password: "super-secret-password",
        req: {
          headers: {
            authorization: "Bearer token123",
            "x-pand-internal-token": "internal-jwt",
          },
        },
      },
      "request handled",
    );

    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0] ?? "{}");
    expect(parsed.service).toBe("core");
    expect(parsed.project).toBe("todo");
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("request handled");
    expect(parsed.password).toBe("[REDACTED]");
    expect(parsed.req.headers.authorization).toBe("[REDACTED]");
    expect(parsed.req.headers["x-pand-internal-token"]).toBe("[REDACTED]");
  });

  it("injects trace_id and span_id when an OpenTelemetry span is active", () => {
    const lines: string[] = [];
    const dest = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });

    const logger = createLogger({
      service: "gateway",
      project: "todo",
      destination: dest,
    });

    const fakeSpan = trace.wrapSpanContext({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      traceFlags: 1,
    });

    const spy = vi.spyOn(trace, "getActiveSpan").mockReturnValue(fakeSpan);
    try {
      logger.info("inside span");
    } finally {
      spy.mockRestore();
    }

    const parsed = JSON.parse(lines[0] ?? "{}");
    expect(parsed.trace_id).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(parsed.span_id).toBe("00f067aa0ba902b7");
  });
});
