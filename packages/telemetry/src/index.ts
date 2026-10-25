import { SpanStatusCode, context, metrics, trace } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { Resource } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";

export interface InitTelemetryOptions {
  serviceName: string;
  projectName: string;
  environment: string;
  otlpEndpoint?: string;
}

export interface TelemetryHandle {
  shutdown: () => Promise<void>;
}

export function initTelemetry(options: InitTelemetryOptions): TelemetryHandle {
  const endpoint = options.otlpEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (process.env.NODE_ENV === "test" && !endpoint) {
    return {
      shutdown: async () => {},
    };
  }

  const normalizedEndpoint = (endpoint ?? "http://localhost:4018").replace(/\/$/, "");
  const resource = new Resource({
    "service.name": `${options.projectName}-${options.serviceName}`,
    "deployment.environment": options.environment,
    "pand.project": options.projectName,
    "pand.service": options.serviceName,
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${normalizedEndpoint}/v1/traces`,
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${normalizedEndpoint}/v1/metrics`,
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 15_000,
    }),
    instrumentations: [new HttpInstrumentation(), new PgInstrumentation()],
  });

  sdk.start();

  return {
    shutdown: async () => {
      await sdk.shutdown();
    },
  };
}

export { context, metrics, SpanStatusCode, trace };
