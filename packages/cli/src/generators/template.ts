import fs from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";

export function toWords(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

export function toCamelCase(input: string): string {
  const words = toWords(input);
  if (words.length === 0) return "";
  return (
    words[0]! +
    words
      .slice(1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("")
  );
}

export function toPascalCase(input: string): string {
  return toWords(input)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

export function toKebabCase(input: string): string {
  return toWords(input).join("-");
}

export function toSnakeCase(input: string): string {
  return toWords(input).join("_");
}

export function toHumanTitle(input: string): string {
  return toWords(input)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function pluralize(word: string): string {
  if (word.endsWith("y") && !/[aeiou]y$/i.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }
  if (/(s|x|z|ch|sh)$/i.test(word)) {
    return `${word}es`;
  }
  return `${word}s`;
}

export function renderTemplateString(
  templateSource: string,
  context: Record<string, unknown>,
): string {
  const compiled = Handlebars.compile(templateSource, { noEscape: true });
  return compiled(context);
}

export function renderTemplateDir(
  templateDir: string,
  targetDir: string,
  context: Record<string, unknown>,
): void {
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template directory not found: ${templateDir}`);
  }
  fs.mkdirSync(targetDir, { recursive: true });
  const entries = fs.readdirSync(templateDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(templateDir, entry.name);
    const renderedEntryName = renderTemplateString(
      entry.name.endsWith(".hbs") ? entry.name.slice(0, -4) : entry.name,
      context,
    );
    const destPath = path.join(targetDir, renderedEntryName);

    if (entry.isDirectory()) {
      renderTemplateDir(srcPath, destPath, context);
    } else {
      const raw = fs.readFileSync(srcPath, "utf8");
      const content = entry.name.endsWith(".hbs") ? renderTemplateString(raw, context) : raw;
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, content, "utf8");
    }
  }
}

export function insertBeforeMarker(filePath: string, marker: string, lineToInsert: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Cannot insert marker into missing file: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf8");
  if (content.includes(lineToInsert.trim())) {
    return;
  }
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^([ \\t]*)${escaped}[ \\t]*$`, "m");
  const match = regex.exec(content);
  if (!match || match.index === undefined) {
    throw new Error(`Marker "${marker}" not found in ${filePath}`);
  }
  const indent = match[1] ?? "";
  const formattedLine = `${indent}${lineToInsert.trim()}\n`;
  const updated = content.slice(0, match.index) + formattedLine + content.slice(match.index);
  fs.writeFileSync(filePath, updated, "utf8");
}
