import type { PandServiceApp } from "@pands/service";
import type { CoreDbInstance } from "../db/index.js";
import { createNotesRouter } from "./notes.js";
// pand:route-imports

export function mountRoutes(app: PandServiceApp, getDb: () => CoreDbInstance["db"]) {
  app.route("/", createNotesRouter(getDb));
  // pand:route-mounts
}
