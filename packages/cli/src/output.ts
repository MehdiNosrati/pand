import path from "node:path";
import { fileURLToPath } from "node:url";
import { consola } from "consola";

export interface GlobalCliArgs {
  cwd?: string;
  json?: boolean;
  yes?: boolean;
  [key: string]: unknown;
}

export const GLOBAL_ARGS_DEF = {
  cwd: {
    type: "string" as const,
    description: "Run as if inside <path>",
  },
  json: {
    type: "boolean" as const,
    description: "Emit machine-readable JSON output",
    default: false,
  },
  yes: {
    type: "boolean" as const,
    alias: "y",
    description: "Skip interactive confirmations",
    default: false,
  },
};

export function resolveCwd(args: GlobalCliArgs): string {
  return args.cwd ? path.resolve(args.cwd) : process.cwd();
}

export function getPlatformRootDir(): string {
  if (process.env.PAND_PLATFORM_ROOT) {
    return path.resolve(process.env.PAND_PLATFORM_ROOT);
  }
  const currentFile = fileURLToPath(import.meta.url);
  // packages/cli/dist/index.js or packages/cli/src/output.ts -> ../../../
  return path.resolve(path.dirname(currentFile), "../../..");
}

export function emitResult<T>(args: GlobalCliArgs, payload: T, humanMessage?: string): T {
  if (args.json) {
    process.stdout.write(`${JSON.stringify({ ok: true, data: payload })}\n`);
  } else if (humanMessage) {
    consola.success(humanMessage);
  }
  return payload;
}

export function emitError(
  args: GlobalCliArgs,
  errorOrCode: unknown,
  maybeMessage?: unknown,
): never {
  const errObj = maybeMessage !== undefined ? maybeMessage : errorOrCode;
  const message = errObj instanceof Error ? errObj.message : String(errObj);
  if (args.json) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  } else {
    consola.error(message);
  }
  process.exit(1);
}
