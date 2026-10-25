export interface ServiceOpenApiInput {
  service: string;
  spec: Record<string, any>;
}

function toPascalCase(input: string): string {
  return input
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function rewriteSchemaRefs(obj: unknown, renameMap: Record<string, string>): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item) => rewriteSchemaRefs(item, renameMap));
  }
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === "$ref" && typeof v === "string" && v.startsWith("#/components/schemas/")) {
        const schemaName = v.slice("#/components/schemas/".length);
        const mapped = renameMap[schemaName] ?? schemaName;
        out[k] = `#/components/schemas/${mapped}`;
      } else {
        out[k] = rewriteSchemaRefs(v, renameMap);
      }
    }
    return out;
  }
  return obj;
}

export function mergeServiceOpenApiSpecs(
  serviceSpecs: ServiceOpenApiInput[],
  info: { title?: string; version?: string } = {},
): Record<string, any> {
  const mergedPaths: Record<string, any> = {};
  const mergedSchemas: Record<string, any> = {};
  const internalPaths = new Set(["/healthz", "/readyz", "/openapi.json", "/_pand/meta"]);

  for (const { service, spec } of serviceSpecs) {
    const pascalService = toPascalCase(service);
    const renameMap: Record<string, string> = {};

    const schemas = spec?.components?.schemas ?? {};
    for (const [schemaName, schemaDef] of Object.entries(schemas)) {
      if (mergedSchemas[schemaName]) {
        const prefixed = `${pascalService}_${schemaName}`;
        renameMap[schemaName] = prefixed;
        mergedSchemas[prefixed] = schemaDef;
      } else {
        mergedSchemas[schemaName] = schemaDef;
      }
    }

    const rewrittenSpec =
      Object.keys(renameMap).length > 0
        ? (rewriteSchemaRefs(spec, renameMap) as Record<string, any>)
        : spec;

    const rewrittenSchemas = rewrittenSpec?.components?.schemas ?? {};
    for (const [schemaName, schemaDef] of Object.entries(rewrittenSchemas)) {
      const targetName = renameMap[schemaName] ?? schemaName;
      mergedSchemas[targetName] = schemaDef;
    }

    const paths = rewrittenSpec?.paths ?? {};
    for (const [rawPath, pathItem] of Object.entries(paths)) {
      if (internalPaths.has(rawPath)) {
        continue;
      }
      const normalized = rawPath === "/" ? "" : rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
      const prefixedPath = `/api/v1/${service}${normalized}`;
      mergedPaths[prefixedPath] = pathItem;
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: info.title ?? "Pand API",
      version: info.version ?? "0.1.1",
    },
    paths: mergedPaths,
    components: {
      schemas: mergedSchemas,
    },
  };
}
