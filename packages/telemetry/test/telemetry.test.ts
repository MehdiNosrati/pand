import { describe, expect, it } from "vitest";
import { initTelemetry } from "../src/index.js";

describe("@pands/telemetry", () => {
  it("no-ops cleanly in test environment when otlpEndpoint is not provided", async () => {
    const handle = initTelemetry({
      serviceName: "core",
      projectName: "todo",
      environment: "test",
    });
    await expect(handle.shutdown()).resolves.toBeUndefined();
  });

  it("initializes and shuts down NodeSDK when otlpEndpoint is provided", async () => {
    const handle = initTelemetry({
      serviceName: "core",
      projectName: "todo",
      environment: "dev",
      otlpEndpoint: "http://localhost:4018",
    });
    await expect(handle.shutdown()).resolves.toBeUndefined();
  });
});
