import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addEntityInternal } from "../src/commands/add-entity.js";
import { newProjectInternal } from "../src/commands/new.js";

describe("pand web template & --web entity page generator (Methane UI)", () => {
  it("scaffolds apps/web with @methane-ui/* and generates Methane UI CRUD routes on --web", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "pand-web-test-"));
    try {
      const created = await newProjectInternal({
        cwd: tmpBase,
        name: "web-demo",
        minimal: false,
      });

      const webDir = path.join(created.projectDir, "apps", "web");
      const pkg = JSON.parse(fs.readFileSync(path.join(webDir, "package.json"), "utf8"));
      expect(pkg.dependencies["@methane-ui/core"]).toBe("^0.1.0");
      expect(pkg.dependencies["@methane-ui/css"]).toBe("^0.1.0");
      expect(pkg.dependencies["@methane-ui/react"]).toBe("^0.1.0");
      expect(pkg.dependencies["@methane-ui/tokens"]).toBe("^0.1.0");
      expect(pkg.dependencies["@methane-ui/ui"]).toBe("^0.1.0");
      expect(pkg.dependencies["@pands/ui"]).toBeUndefined();
      expect(pkg.dependencies["lucide-react"]).toBeUndefined();
      expect(pkg.devDependencies.tailwindcss).toBeUndefined();
      expect(pkg.devDependencies["@tailwindcss/vite"]).toBeUndefined();

      const viteConfig = fs.readFileSync(path.join(webDir, "vite.config.ts"), "utf8");
      expect(viteConfig).not.toContain("@tailwindcss/vite");
      expect(viteConfig).toContain("plugins: [react()]");

      const mainTsx = fs.readFileSync(path.join(webDir, "src", "main.tsx"), "utf8");
      expect(mainTsx).toContain("@methane-ui/tokens/tokens.css");
      expect(mainTsx).toContain("@methane-ui/css/index.css");
      expect(mainTsx).toContain('import "@methane-ui/react"');
      expect(mainTsx).not.toContain("@pands/ui");

      const rootTsx = fs.readFileSync(path.join(webDir, "src", "routes", "__root.tsx"), "utf8");
      expect(rootTsx).toContain("mth-app-shell");
      expect(rootTsx).toContain("<mth-sidebar-nav");
      expect(rootTsx).not.toContain("@pands/ui");

      const entityRes = await addEntityInternal({
        rootDir: created.projectDir,
        service: "core",
        entity: "Task",
        fieldsDsl:
          "title:string,done:boolean=false,points:int=1,weight:float=1.5,priority:enum(low|high)=low",
        web: true,
      });

      const taskRoute = path.join(webDir, "src", "routes", "tasks.tsx");
      expect(entityRes.files).toContain(taskRoute);
      const taskCode = fs.readFileSync(taskRoute, "utf8");
      expect(taskCode).toContain("@methane-ui/ui/dialog");
      expect(taskCode).toContain("<mth-dialog");
      expect(taskCode).toContain("<mth-number-input");
      expect(taskCode).toContain("<mth-select");
      expect(taskCode).toContain("<mth-checkbox");
      expect(taskCode).toContain("<mth-toast");
      expect(taskCode).not.toContain("@pands/ui");

      const navTs = fs.readFileSync(path.join(webDir, "src", "nav.ts"), "utf8");
      expect(navTs).toContain('{ label: "Tasks", to: "/tasks" }');
      expect(navTs).not.toContain("@pands/ui");
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  }, 60_000);
});
