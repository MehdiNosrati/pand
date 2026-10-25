import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addEntityInternal } from "../src/commands/add-entity.js";
import { newProjectInternal } from "../src/commands/new.js";
import { sdkGenInternal } from "../src/commands/sdk-gen.js";

describe("pand Android template & --android entity screen generator", () => {
  it("scaffolds apps/android, generates Jetpack Compose screen + navigation tab on --android, and emits Kotlin SDK", async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "pand-android-test-"));
    try {
      const created = await newProjectInternal({
        cwd: tmpBase,
        name: "android-demo",
        minimal: true,
        android: true,
      });

      const appBuildGradle = path.join(
        created.projectDir,
        "apps",
        "android",
        "app",
        "build.gradle.kts",
      );
      expect(fs.existsSync(appBuildGradle)).toBe(true);
      expect(fs.readFileSync(appBuildGradle, "utf8")).toContain(
        'namespace = "dev.mahdins.android_demo"',
      );

      const entityRes = await addEntityInternal({
        rootDir: created.projectDir,
        service: "core",
        entity: "Workout",
        fieldsDsl: "title:string,durationMinutes:int=30",
        android: true,
      });

      const composeScreenPath = path.join(
        created.projectDir,
        "apps",
        "android",
        "app",
        "src",
        "main",
        "java",
        "dev",
        "mahdins",
        "android_demo",
        "features",
        "workout",
        "WorkoutScreen.kt",
      );
      expect(entityRes.files).toContain(composeScreenPath);
      expect(fs.readFileSync(composeScreenPath, "utf8")).toContain("fun WorkoutScreen(");

      const destPath = path.join(
        created.projectDir,
        "apps",
        "android",
        "app",
        "src",
        "main",
        "java",
        "dev",
        "mahdins",
        "android_demo",
        "navigation",
        "AppDestinations.kt",
      );
      expect(fs.readFileSync(destPath, "utf8")).toContain(
        'AppDestination(route = "workouts", label = "Workouts"),',
      );

      await sdkGenInternal({ rootDir: created.projectDir });
      const modelsKtPath = path.join(
        created.projectDir,
        "apps",
        "android",
        "app",
        "src",
        "main",
        "java",
        "dev",
        "mahdins",
        "android_demo",
        "sdk",
        "Models.kt",
      );
      expect(fs.existsSync(modelsKtPath)).toBe(true);
      expect(fs.readFileSync(modelsKtPath, "utf8")).toContain("data class Workout(");
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  }, 60_000);
});
