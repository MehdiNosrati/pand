import { serve } from "@hono/node-server";
import type { Logger } from "@pands/logger";
import { initTelemetry } from "@pands/telemetry";

export interface ServableApp {
  fetch: (request: Request, ...args: any[]) => Response | Promise<Response>;
  serviceName: string;
  logger: Logger;
}

export interface ServeServiceOptions {
  port?: number;
  serviceName?: string;
  projectName?: string;
  environment?: string;
  closeDb?: () => Promise<void>;
}

export function serveService(app: ServableApp, options: ServeServiceOptions = {}) {
  const serviceName = options.serviceName ?? app.serviceName;
  const projectName = options.projectName ?? process.env.PAND_PROJECT ?? "pand";
  const environment = options.environment ?? process.env.PAND_ENV ?? "dev";
  const port = options.port ?? Number(process.env.PORT ?? 4010);

  const telemetry = initTelemetry({
    serviceName,
    projectName,
    environment,
  });

  const server = serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      app.logger.info(
        { port: info.port, service: serviceName, project: projectName, env: environment },
        "service_listening",
      );
    },
  );

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    app.logger.info({ signal }, "service_shutting_down");
    server.close();
    if (options.closeDb) {
      await options.closeDb().catch((err) => app.logger.error({ err }, "db_close_error"));
    }
    await telemetry.shutdown().catch((err) => app.logger.error({ err }, "telemetry_close_error"));
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  return { server, shutdown };
}
