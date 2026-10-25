import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addEntityInternal } from "../src/commands/add-entity.js";
import { newProjectInternal } from "../src/commands/new.js";
import { sdkGenInternal } from "../src/commands/sdk-gen.js";

describe("pand iOS template & --ios entity screen generator", () => {
  it("scaffolds apps/ios, generates SwiftUI view + tab entry on --ios, and emits Swift SDK", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "pand-ios-test-"));
    try {
      const created = await newProjectInternal({
        cwd: tmpBase,
        name: "ios-demo",
        minimal: true,
        ios: true,
      });

      const projectYml = path.join(created.projectDir, "apps", "ios", "project.yml");
      expect(fs.existsSync(projectYml)).toBe(true);
      expect(fs.readFileSync(projectYml, "utf8")).toContain("dev.mahdins.ios-demo");

      const entityRes = await addEntityInternal({
        rootDir: created.projectDir,
        service: "core",
        entity: "Habit",
        fieldsDsl: "title:string,streak:int=0",
        ios: true,
      });

      const swiftViewPath = path.join(
        created.projectDir,
        "apps",
        "ios",
        "Sources",
        "App",
        "Features",
        "Habit",
        "HabitListView.swift",
      );
      expect(entityRes.files).toContain(swiftViewPath);
      expect(fs.readFileSync(swiftViewPath, "utf8")).toContain("struct HabitListView: View");

      const appTabPath = path.join(
        created.projectDir,
        "apps",
        "ios",
        "Sources",
        "App",
        "Navigation",
        "AppTab.swift",
      );
      expect(fs.readFileSync(appTabPath, "utf8")).toContain('case habits = "Habits"');

      await sdkGenInternal({ rootDir: created.projectDir });
      const swiftClientPath = path.join(
        created.projectDir,
        "apps",
        "ios",
        "Packages",
        "PandSDK",
        "Sources",
        "PandSDK",
        "PandAPIClient.swift",
      );
      expect(fs.existsSync(swiftClientPath)).toBe(true);
      expect(fs.readFileSync(swiftClientPath, "utf8")).toContain("public struct Habit: Codable");
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  }, 60_000);
});
