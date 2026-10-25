import { serveService } from "@pand/service";
import { buildCoreApp } from "./app.js";

const { app, closeDb } = buildCoreApp();

serveService(app, {
  serviceName: "core",
  projectName: "reference",
  port: Number(process.env.PORT ?? 4010),
  closeDb,
});
