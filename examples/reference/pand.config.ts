import { defineConfig } from "@pands/config";

export default defineConfig({
  name: "reference",
  displayName: "Reference App",
  basePort: 4000,
  services: {
    core: { portOffset: 10, db: true },
  },
});
