import { toHumanTitle, toSnakeCase } from "./template.js";

export type FieldBaseType =
  | "string"
  | "text"
  | "int"
  | "float"
  | "boolean"
  | "datetime"
  | "uuid"
  | "enum";

export interface ParsedField {
  name: string;
  columnName: string;
  label: string;
  type: FieldBaseType;
  nullable: boolean;
  required: boolean;
  enumValues?: string[];
  defaultValue?: string | number | boolean;
  drizzleImport: string;
  drizzleColumnCode: string;
  zodBaseCode: string;
  zodEntityCode: string;
  zodCreateCode: string;
  zodUpdateCode: string;
  sampleValueJson: string;
  swiftType: string;
  kotlinType: string;
}

const FIELD_NAME_REGEX = /^[a-z][a-zA-Z0-9]*$/;

export function parseFieldDsl(dsl: string): ParsedField[] {
  const trimmed = dsl.trim();
  if (!trimmed) {
    throw new Error("Field DSL cannot be empty");
  }

  const rawTokens = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawTokens.length === 0) {
    throw new Error("Field DSL must define at least one field");
  }

  return rawTokens.map((token) => {
    const colonIdx = token.indexOf(":");
    if (colonIdx === -1) {
      throw new Error(
        `Invalid field specification "${token}": expected <name>:<type>[?][=<default>]`,
      );
    }

    const name = token.slice(0, colonIdx).trim();
    if (!FIELD_NAME_REGEX.test(name)) {
      throw new Error(
        `Invalid field name "${name}": must be camelCase starting with a lowercase letter`,
      );
    }
    if (name === "id" || name === "createdAt" || name === "updatedAt") {
      throw new Error(`Field "${name}" is automatically generated and cannot be re-declared`);
    }

    let rhs = token.slice(colonIdx + 1).trim();
    let defaultValueRaw: string | undefined;
    const eqIdx = rhs.indexOf("=");
    if (eqIdx !== -1) {
      defaultValueRaw = rhs.slice(eqIdx + 1).trim();
      rhs = rhs.slice(0, eqIdx).trim();
    }

    let nullable = false;
    if (rhs.endsWith("?")) {
      nullable = true;
      rhs = rhs.slice(0, -1).trim();
    }

    let type: FieldBaseType;
    let enumValues: string[] | undefined;

    if (rhs.startsWith("enum(") && rhs.endsWith(")")) {
      type = "enum";
      const inner = rhs.slice(5, -1).trim();
      enumValues = inner
        .split("|")
        .map((v) => v.trim())
        .filter(Boolean);
      if (enumValues.length === 0) {
        throw new Error(`Enum field "${name}" must specify at least one value, e.g. enum(a|b)`);
      }
    } else if (
      rhs === "string" ||
      rhs === "text" ||
      rhs === "int" ||
      rhs === "float" ||
      rhs === "boolean" ||
      rhs === "datetime" ||
      rhs === "uuid"
    ) {
      type = rhs;
    } else {
      throw new Error(`Unsupported field type "${rhs}" for field "${name}"`);
    }

    let defaultValue: string | number | boolean | undefined;
    if (defaultValueRaw !== undefined) {
      if (type === "boolean") {
        if (defaultValueRaw !== "true" && defaultValueRaw !== "false") {
          throw new Error(`Invalid boolean default "${defaultValueRaw}" for field "${name}"`);
        }
        defaultValue = defaultValueRaw === "true";
      } else if (type === "int") {
        const parsed = Number.parseInt(defaultValueRaw, 10);
        if (Number.isNaN(parsed)) {
          throw new Error(`Invalid int default "${defaultValueRaw}" for field "${name}"`);
        }
        defaultValue = parsed;
      } else if (type === "float") {
        const parsed = Number.parseFloat(defaultValueRaw);
        if (Number.isNaN(parsed)) {
          throw new Error(`Invalid float default "${defaultValueRaw}" for field "${name}"`);
        }
        defaultValue = parsed;
      } else if (type === "enum") {
        if (!enumValues?.includes(defaultValueRaw)) {
          throw new Error(
            `Default value "${defaultValueRaw}" for enum field "${name}" is not in [${enumValues?.join(", ")}]`,
          );
        }
        defaultValue = defaultValueRaw;
      } else {
        defaultValue = defaultValueRaw.replace(/^["']|["']$/g, "");
      }
    }

    const columnName = toSnakeCase(name);
    const label = toHumanTitle(name);
    const required = !nullable && defaultValue === undefined;

    let drizzleImport = "varchar";
    let drizzleBase = "";
    let zodBaseCode = "";
    let sampleValueJson = '"sample"';
    let swiftType = "String";
    let kotlinType = "String";

    switch (type) {
      case "string":
        drizzleImport = "varchar";
        drizzleBase = `varchar("${columnName}", { length: 255 })`;
        zodBaseCode = "z.string().min(1).max(255)";
        sampleValueJson = JSON.stringify(defaultValue ?? `Sample ${label}`);
        swiftType = "String";
        kotlinType = "String";
        break;
      case "text":
        drizzleImport = "text";
        drizzleBase = `text("${columnName}")`;
        zodBaseCode = "z.string()";
        sampleValueJson = JSON.stringify(defaultValue ?? `Sample ${label} text`);
        swiftType = "String";
        kotlinType = "String";
        break;
      case "int":
        drizzleImport = "integer";
        drizzleBase = `integer("${columnName}")`;
        zodBaseCode = "z.number().int()";
        sampleValueJson = JSON.stringify(defaultValue ?? 42);
        swiftType = "Int";
        kotlinType = "Int";
        break;
      case "float":
        drizzleImport = "doublePrecision";
        drizzleBase = `doublePrecision("${columnName}")`;
        zodBaseCode = "z.number()";
        sampleValueJson = JSON.stringify(defaultValue ?? 3.14);
        swiftType = "Double";
        kotlinType = "Double";
        break;
      case "boolean":
        drizzleImport = "boolean";
        drizzleBase = `boolean("${columnName}")`;
        zodBaseCode = "z.boolean()";
        sampleValueJson = JSON.stringify(defaultValue ?? true);
        swiftType = "Bool";
        kotlinType = "Boolean";
        break;
      case "datetime":
        drizzleImport = "timestamp";
        drizzleBase = `timestamp("${columnName}", { withTimezone: true })`;
        zodBaseCode = "z.string()";
        sampleValueJson = JSON.stringify("2026-01-01T00:00:00.000Z");
        swiftType = "String";
        kotlinType = "String";
        break;
      case "uuid":
        drizzleImport = "uuid";
        drizzleBase = `uuid("${columnName}")`;
        zodBaseCode = "z.string().uuid()";
        sampleValueJson = JSON.stringify("00000000-0000-4000-8000-000000000001");
        swiftType = "String";
        kotlinType = "String";
        break;
      case "enum": {
        drizzleImport = "varchar";
        drizzleBase = `varchar("${columnName}", { length: 64 })`;
        const enumLiterals = (enumValues ?? []).map((v) => JSON.stringify(v)).join(", ");
        zodBaseCode = `z.enum([${enumLiterals}])`;
        sampleValueJson = JSON.stringify(defaultValue ?? enumValues?.[0] ?? "default");
        swiftType = "String";
        kotlinType = "String";
        break;
      }
    }

    let drizzleColumnCode = drizzleBase;
    if (!nullable) {
      drizzleColumnCode += ".notNull()";
    }
    if (defaultValue !== undefined) {
      drizzleColumnCode += `.default(${JSON.stringify(defaultValue)})`;
    }

    const zodEntityCode = nullable ? `${zodBaseCode}.nullable()` : zodBaseCode;
    let zodCreateCode = zodBaseCode;
    if (nullable) {
      zodCreateCode = `${zodBaseCode}.nullable().optional()`;
    } else if (defaultValue !== undefined) {
      zodCreateCode = `${zodBaseCode}.optional().default(${JSON.stringify(defaultValue)})`;
    }
    const zodUpdateCode = nullable
      ? `${zodBaseCode}.nullable().optional()`
      : `${zodBaseCode}.optional()`;

    return {
      name,
      columnName,
      label,
      type,
      nullable,
      required,
      enumValues,
      defaultValue,
      drizzleImport,
      drizzleColumnCode,
      zodBaseCode,
      zodEntityCode,
      zodCreateCode,
      zodUpdateCode,
      sampleValueJson,
      swiftType: nullable ? `${swiftType}?` : swiftType,
      kotlinType: nullable ? `${kotlinType}?` : kotlinType,
    };
  });
}
