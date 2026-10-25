import { serveService } from "@pands/service";
import { app } from "./app.js";

serveService(app, {
  serviceName: "gateway",
  projectName: "reference",
  port: Number(process.env.PORT ?? 4001),
});
