import { createGatewayApp } from "@pands/gateway";
import config from "../../../pand.config.js";

export const app = createGatewayApp({
  config,
});

export default app;
