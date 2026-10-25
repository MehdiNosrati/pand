import fs from "node:fs";
import path from "node:path";
import { EntityNameRegex, loadPandConfig } from "@pand/config";
import { defineCommand } from "citty";
import { execa } from "execa";
import { parseFieldDsl } from "../generators/field-dsl.js";
import {
  insertBeforeMarker,
  pluralize,
  renderTemplateString,
  toCamelCase,
  toHumanTitle,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
} from "../generators/template.js";
import {
  GLOBAL_ARGS_DEF,
  emitError,
  emitResult,
  getPlatformRootDir,
  resolveCwd,
} from "../output.js";

export interface AddEntityOptions {
  rootDir: string;
  service: string;
  entity: string;
  fieldsDsl: string;
  web?: boolean;
  ios?: boolean;
  android?: boolean;
}

export async function addEntityInternal(options: AddEntityOptions) {
  const { rootDir, service, entity, fieldsDsl } = options;
  if (!EntityNameRegex.test(entity)) {
    throw new Error(
      `Invalid entity name "${entity}". Must be PascalCase matching ${EntityNameRegex.toString()}`,
    );
  }

  const { config } = await loadPandConfig(rootDir);
  if (!config.services[service]) {
    throw new Error(`Service "${service}" is not defined in pand.config.ts`);
  }

  const serviceDir = path.join(rootDir, "services", service);
  if (!fs.existsSync(serviceDir)) {
    throw new Error(`Service directory not found: ${serviceDir}`);
  }

  const parsedFields = parseFieldDsl(fieldsDsl);
  const camelEntity = toCamelCase(entity);
  const pluralPascal = pluralize(entity);
  const pluralCamel = toCamelCase(pluralPascal);
  const pluralKebab = toKebabCase(pluralPascal);
  const tableName = toSnakeCase(pluralPascal);
  const pluralTitle = toHumanTitle(pluralPascal);

  const drizzleImportsSet = new Set<string>();
  for (const f of parsedFields) {
    if (f.drizzleImport !== "uuid" && f.drizzleImport !== "timestamp") {
      drizzleImportsSet.add(f.drizzleImport);
    }
  }
  const drizzleImports = Array.from(drizzleImportsSet).sort().join(", ");

  const firstStringField =
    parsedFields.find((f) => f.type === "string" || f.type === "text")?.name ?? null;
  const displayField = firstStringField ?? "id";

  const templateFields = parsedFields.map((f) => ({
    ...f,
    isDatetime: f.type === "datetime",
    isBoolean: f.type === "boolean",
    isInt: f.type === "int",
    isFloat: f.type === "float",
    isEnum: f.type === "enum",
    isStringLike: f.type === "string" || f.type === "text" || f.type === "uuid",
    enumValuesJson: f.enumValues ? JSON.stringify(f.enumValues) : null,
    hasDefaultValue: f.defaultValue !== undefined,
    defaultValueJson: f.defaultValue !== undefined ? JSON.stringify(f.defaultValue) : null,
  }));

  const templateContext = {
    project: config.name,
    snakeProject: toSnakeCase(config.name),
    pascalProject: toPascalCase(config.name),
    service,
    camelService: toCamelCase(service),
    pascalService: toPascalCase(service),
    entity,
    camelEntity,
    lowerEntity: entity.toLowerCase(),
    pluralPascal,
    pluralCamel,
    pluralKebab,
    tableName,
    pluralTitle,
    drizzleImports,
    firstStringField,
    displayField,
    fields: templateFields,
  };

  const platformRoot = getPlatformRootDir();
  const entityTemplatesDir = path.join(platformRoot, "templates", "entity");

  const schemaTemplate = fs.readFileSync(path.join(entityTemplatesDir, "schema.ts.hbs"), "utf8");
  const routesTemplate = fs.readFileSync(path.join(entityTemplatesDir, "routes.ts.hbs"), "utf8");
  const testTemplate = fs.readFileSync(path.join(entityTemplatesDir, "test.ts.hbs"), "utf8");

  const schemaPath = path.join(serviceDir, "src", "db", "schema", `${pluralKebab}.ts`);
  const routesPath = path.join(serviceDir, "src", "routes", `${pluralKebab}.ts`);
  const testPath = path.join(serviceDir, "test", `${pluralKebab}.test.ts`);

  fs.mkdirSync(path.dirname(schemaPath), { recursive: true });
  fs.mkdirSync(path.dirname(routesPath), { recursive: true });
  fs.mkdirSync(path.dirname(testPath), { recursive: true });

  fs.writeFileSync(schemaPath, renderTemplateString(schemaTemplate, templateContext), "utf8");
  fs.writeFileSync(routesPath, renderTemplateString(routesTemplate, templateContext), "utf8");
  fs.writeFileSync(testPath, renderTemplateString(testTemplate, templateContext), "utf8");

  // Insert deterministic code markers
  const schemaIndexFile = path.join(serviceDir, "src", "db", "schema", "index.ts");
  insertBeforeMarker(
    schemaIndexFile,
    "// pand:schema-exports",
    `export { ${pluralCamel} } from "./${pluralKebab}.js";`,
  );

  const routesIndexFile = path.join(serviceDir, "src", "routes", "index.ts");
  insertBeforeMarker(
    routesIndexFile,
    "// pand:route-imports",
    `import { create${pluralPascal}Router } from "./${pluralKebab}.js";`,
  );
  insertBeforeMarker(
    routesIndexFile,
    "// pand:route-mounts",
    `app.route("/", create${pluralPascal}Router(getDb));`,
  );

  const appFile = path.join(serviceDir, "src", "app.ts");
  if (fs.readFileSync(appFile, "utf8").includes("// pand:admin-meta-imports")) {
    insertBeforeMarker(
      appFile,
      "// pand:admin-meta-imports",
      `import { ${camelEntity}AdminMeta } from "./routes/${pluralKebab}.js";`,
    );
  } else {
    insertBeforeMarker(appFile, "// pand:admin-meta", `// meta: ${camelEntity}AdminMeta`);
  }
  insertBeforeMarker(
    appFile,
    "// pand:admin-meta",
    `app.registerAdminEntity(${camelEntity}AdminMeta);`,
  );

  const generatedFiles = [schemaPath, routesPath, testPath];

  // Optional Web Page generation (--web)
  const webTemplatePath = path.join(entityTemplatesDir, "web-page.tsx.hbs");
  if (options.web && fs.existsSync(webTemplatePath)) {
    const webRoutesDir = path.join(rootDir, "apps", "web", "src", "routes");
    fs.mkdirSync(webRoutesDir, { recursive: true });
    const webPagePath = path.join(webRoutesDir, `${pluralKebab}.tsx`);
    const webSource = renderTemplateString(
      fs.readFileSync(webTemplatePath, "utf8"),
      templateContext,
    );
    fs.writeFileSync(webPagePath, webSource, "utf8");
    generatedFiles.push(webPagePath);

    const navFilePath = path.join(rootDir, "apps", "web", "src", "nav.ts");
    if (fs.existsSync(navFilePath)) {
      insertBeforeMarker(
        navFilePath,
        "// pand:web-nav",
        `{ label: "${pluralTitle}", to: "/${pluralKebab}" },`,
      );
    }
  }

  // Optional iOS Screen generation (--ios)
  const iosTemplatePath = path.join(entityTemplatesDir, "ios-view.swift.hbs");
  if (options.ios && fs.existsSync(iosTemplatePath)) {
    const iosFeatureDir = path.join(rootDir, "apps", "ios", "Sources", "App", "Features", entity);
    fs.mkdirSync(iosFeatureDir, { recursive: true });
    const iosViewPath = path.join(iosFeatureDir, `${entity}ListView.swift`);
    const iosSource = renderTemplateString(
      fs.readFileSync(iosTemplatePath, "utf8"),
      templateContext,
    );
    fs.writeFileSync(iosViewPath, iosSource, "utf8");
    generatedFiles.push(iosViewPath);

    const iosTabPath = path.join(
      rootDir,
      "apps",
      "ios",
      "Sources",
      "App",
      "Navigation",
      "AppTab.swift",
    );
    if (fs.existsSync(iosTabPath)) {
      insertBeforeMarker(iosTabPath, "// pand:ios-tabs", `case ${pluralCamel} = "${pluralTitle}"`);
    }
  }

  // Optional Android Screen generation (--android)
  const androidTemplatePath = path.join(entityTemplatesDir, "android-screen.kt.hbs");
  if (options.android && fs.existsSync(androidTemplatePath)) {
    const snakeProj = toSnakeCase(config.name);
    const androidFeatureDir = path.join(
      rootDir,
      "apps",
      "android",
      "app",
      "src",
      "main",
      "java",
      "dev",
      "mahdins",
      snakeProj,
      "features",
      entity.toLowerCase(),
    );
    fs.mkdirSync(androidFeatureDir, { recursive: true });
    const androidScreenPath = path.join(androidFeatureDir, `${entity}Screen.kt`);
    const androidSource = renderTemplateString(
      fs.readFileSync(androidTemplatePath, "utf8"),
      templateContext,
    );
    fs.writeFileSync(androidScreenPath, androidSource, "utf8");
    generatedFiles.push(androidScreenPath);

    const androidDestPath = path.join(
      rootDir,
      "apps",
      "android",
      "app",
      "src",
      "main",
      "java",
      "dev",
      "mahdins",
      snakeProj,
      "navigation",
      "AppDestinations.kt",
    );
    if (fs.existsSync(androidDestPath)) {
      insertBeforeMarker(
        androidDestPath,
        "// pand:android-tabs",
        `AppDestination(route = "${pluralKebab}", label = "${pluralTitle}"),`,
      );
    }
  }

  await execa("pnpm", ["biome", "check", "--write", "."], { cwd: rootDir }).catch(() => {});

  return {
    service,
    entity,
    table: tableName,
    basePath: `/api/v1/${service}/${pluralKebab}`,
    files: generatedFiles,
  };
}

export const addEntityCommand = defineCommand({
  meta: {
    name: "entity",
    description:
      "Generate DB table, CRUD OpenAPI routes, admin metadata, tests, and optional UI screens",
  },
  args: {
    ...GLOBAL_ARGS_DEF,
    service: {
      type: "positional",
      description: "Target service name (e.g. core)",
      required: true,
    },
    entity: {
      type: "positional",
      description: "Entity PascalCase name (e.g. Task)",
      required: true,
    },
    fields: {
      type: "string",
      description: "Field DSL, e.g. title:string,done:boolean=false",
      required: true,
    },
    web: {
      type: "boolean",
      description: "Generate web CRUD page in apps/web",
      default: false,
    },
    ios: {
      type: "boolean",
      description: "Generate SwiftUI CRUD view in apps/ios",
      default: false,
    },
    android: {
      type: "boolean",
      description: "Generate Jetpack Compose CRUD screen in apps/android",
      default: false,
    },
  },
  async run({ args }) {
    try {
      const cwd = resolveCwd(args);
      const { rootDir } = await loadPandConfig(cwd);
      const result = await addEntityInternal({
        rootDir,
        service: String(args.service),
        entity: String(args.entity),
        fieldsDsl: String(args.fields),
        web: Boolean(args.web),
        ios: Boolean(args.ios),
        android: Boolean(args.android),
      });
      emitResult(
        args,
        result,
        `Generated entity "${result.entity}" in service "${result.service}" (${result.basePath})`,
      );
    } catch (err) {
      emitError(args, err);
    }
  },
});
