import { trace } from "@opentelemetry/api";
import pino, { type DestinationStream, type Logger as PinoLogger } from "pino";

export type Logger = PinoLogger;

export interface CreateLoggerOptions {
  service: string;
  project?: string;
  env?: string;
  level?: string;
  destination?: DestinationStream;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const level = options.level ?? process.env.LOG_LEVEL ?? "info";
  const project = options.project ?? process.env.PAND_PROJECT ?? "pand";
  const env = options.env ?? process.env.PAND_ENV ?? "dev";

  const pinoOptions: pino.LoggerOptions = {
    level,
    base: {
      service: options.service,
      project,
      env,
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        'req.headers["x-pand-internal-token"]',
        "password",
        "secret",
      ],
      censor: "[REDACTED]",
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    mixin() {
      const span = trace.getActiveSpan();
      if (!span) {
        return {};
      }
      const ctx = span.spanContext();
      if (!ctx || !ctx.traceId || ctx.traceId === "00000000000000000000000000000000") {
        return {};
      }
      return {
        trace_id: ctx.traceId,
        span_id: ctx.spanId,
      };
    },
  };

  if (options.destination) {
    return pino(pinoOptions, options.destination);
  }
  return pino(pinoOptions);
}
