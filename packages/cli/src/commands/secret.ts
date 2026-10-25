import fs from "node:fs";
import path from "node:path";
import { getGlobalConfigDir } from "@pands/config";
import { Decrypter, Encrypter, armor, generateIdentity, identityToRecipient } from "age-encryption";
import { defineCommand } from "citty";
import { GLOBAL_ARGS_DEF, emitError, emitResult, resolveCwd } from "../output.js";

export function getAgeKeyPath(customConfigDir?: string): string {
  const dir = customConfigDir ?? getGlobalConfigDir();
  return path.join(dir, "age.key");
}

export async function ensureAgeIdentity(customConfigDir?: string): Promise<{
  identity: string;
  recipient: string;
  keyPath: string;
}> {
  const keyPath = getAgeKeyPath(customConfigDir);
  if (fs.existsSync(keyPath)) {
    const raw = fs.readFileSync(keyPath, "utf8");
    const line = raw
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("AGE-SECRET-KEY-"));
    if (!line) {
      throw new Error(`Invalid age key file at ${keyPath}`);
    }
    const recipient = await identityToRecipient(line);
    return { identity: line, recipient, keyPath };
  }

  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  const identity = await generateIdentity();
  const recipient = await identityToRecipient(identity);
  const content = `# created: ${new Date().toISOString()}\n# public key: ${recipient}\n${identity}\n`;
  fs.writeFileSync(keyPath, content, { mode: 0o600 });
  return { identity, recipient, keyPath };
}

export async function encryptSecretsMap(
  secrets: Record<string, string>,
  recipient: string,
): Promise<string> {
  const sortedKeys = Object.keys(secrets).sort();
  const sortedObj: Record<string, string> = {};
  for (const k of sortedKeys) {
    sortedObj[k] = secrets[k]!;
  }
  const plaintext = JSON.stringify(sortedObj, null, 2);
  const encrypter = new Encrypter();
  encrypter.addRecipient(recipient);
  const encryptedBytes = await encrypter.encrypt(plaintext);
  return armor.encode(encryptedBytes);
}

export async function decryptSecretsFile(
  filePath: string,
  identity: string,
): Promise<Record<string, string>> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const armored = fs.readFileSync(filePath, "utf8").trim();
  if (!armored) {
    return {};
  }
  const decrypter = new Decrypter();
  decrypter.addIdentity(identity);
  const cipherBytes = armor.decode(armored);
  const plaintext = await decrypter.decrypt(cipherBytes, "text");
  return JSON.parse(plaintext) as Record<string, string>;
}

export async function secretInitInternal(options: {
  rootDir: string;
  configDir?: string;
}) {
  const { recipient, keyPath } = await ensureAgeIdentity(options.configDir);
  const secretsDir = path.join(options.rootDir, "secrets");
  fs.mkdirSync(secretsDir, { recursive: true });

  for (const env of ["dev", "prod"]) {
    const envPath = path.join(secretsDir, `${env}.age`);
    if (!fs.existsSync(envPath)) {
      const armored = await encryptSecretsMap({}, recipient);
      fs.writeFileSync(envPath, `${armored}\n`, "utf8");
    }
  }

  return {
    publicKey: recipient,
    keyPath,
    files: [path.join(secretsDir, "dev.age"), path.join(secretsDir, "prod.age")],
  };
}

export async function secretSetInternal(options: {
  rootDir: string;
  env?: string;
  pair: string;
  configDir?: string;
}) {
  const env = options.env ?? "prod";
  const eqIdx = options.pair.indexOf("=");
  if (eqIdx <= 0) {
    throw new Error(`Invalid KEY=VALUE format: "${options.pair}"`);
  }
  const key = options.pair.slice(0, eqIdx).trim();
  const value = options.pair.slice(eqIdx + 1);

  const { identity, recipient } = await ensureAgeIdentity(options.configDir);
  const secretsDir = path.join(options.rootDir, "secrets");
  fs.mkdirSync(secretsDir, { recursive: true });
  const envFile = path.join(secretsDir, `${env}.age`);

  const existing = await decryptSecretsFile(envFile, identity);
  existing[key] = value;
  const armored = await encryptSecretsMap(existing, recipient);
  fs.writeFileSync(envFile, `${armored}\n`, "utf8");

  return { env, key, file: envFile };
}

export async function secretGetInternal(options: {
  rootDir: string;
  env?: string;
  key: string;
  configDir?: string;
}): Promise<string | undefined> {
  const env = options.env ?? "prod";
  const { identity } = await ensureAgeIdentity(options.configDir);
  const envFile = path.join(options.rootDir, "secrets", `${env}.age`);
  const existing = await decryptSecretsFile(envFile, identity);
  return existing[options.key];
}

export async function secretListInternal(options: {
  rootDir: string;
  env?: string;
  reveal?: boolean;
  configDir?: string;
}): Promise<Record<string, string>> {
  const env = options.env ?? "prod";
  const { identity } = await ensureAgeIdentity(options.configDir);
  const envFile = path.join(options.rootDir, "secrets", `${env}.age`);
  const existing = await decryptSecretsFile(envFile, identity);
  if (options.reveal) {
    return existing;
  }
  const masked: Record<string, string> = {};
  for (const k of Object.keys(existing)) {
    masked[k] = "********";
  }
  return masked;
}

export async function secretExportInternal(options: {
  rootDir: string;
  env?: string;
  configDir?: string;
}): Promise<string> {
  const env = options.env ?? "prod";
  const { identity } = await ensureAgeIdentity(options.configDir);
  const envFile = path.join(options.rootDir, "secrets", `${env}.age`);
  const existing = await decryptSecretsFile(envFile, identity);
  return Object.entries(existing)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join("\n");
}

export const secretCommand = defineCommand({
  meta: {
    name: "secret",
    description: "Manage age-encrypted project secrets (init, set, get, list, export)",
  },
  subCommands: {
    init: defineCommand({
      meta: { name: "init", description: "Initialize age identity and secrets/*.age files" },
      args: { ...GLOBAL_ARGS_DEF },
      async run({ args }) {
        try {
          const res = await secretInitInternal({ rootDir: resolveCwd(args) });
          emitResult(args, res, `Initialized age public key ${res.publicKey}`);
        } catch (err) {
          emitError(args, "SECRET_INIT_ERROR", err instanceof Error ? err.message : String(err));
        }
      },
    }),
    set: defineCommand({
      meta: { name: "set", description: "Set KEY=VALUE in secrets/<env>.age" },
      args: {
        ...GLOBAL_ARGS_DEF,
        pair: { type: "positional", required: true, description: "KEY=VALUE" },
        env: { type: "string", default: "prod", description: "Target environment (dev|prod)" },
      },
      async run({ args }) {
        try {
          const res = await secretSetInternal({
            rootDir: resolveCwd(args),
            env: String(args.env ?? "prod"),
            pair: String(args.pair),
          });
          emitResult(args, res, `Set ${res.key} in secrets/${res.env}.age`);
        } catch (err) {
          emitError(args, "SECRET_SET_ERROR", err instanceof Error ? err.message : String(err));
        }
      },
    }),
    get: defineCommand({
      meta: { name: "get", description: "Get decrypted value of KEY" },
      args: {
        ...GLOBAL_ARGS_DEF,
        key: { type: "positional", required: true, description: "Secret key" },
        env: { type: "string", default: "prod", description: "Target environment (dev|prod)" },
      },
      async run({ args }) {
        try {
          const val = await secretGetInternal({
            rootDir: resolveCwd(args),
            env: String(args.env ?? "prod"),
            key: String(args.key),
          });
          if (val === undefined) {
            emitError(args, "SECRET_NOT_FOUND", `Secret "${args.key}" not found`);
          }
          emitResult(args, { key: args.key, value: val }, val);
        } catch (err) {
          emitError(args, "SECRET_GET_ERROR", err instanceof Error ? err.message : String(err));
        }
      },
    }),
    list: defineCommand({
      meta: { name: "list", description: "List secret keys in secrets/<env>.age" },
      args: {
        ...GLOBAL_ARGS_DEF,
        env: { type: "string", default: "prod", description: "Target environment (dev|prod)" },
        reveal: { type: "boolean", default: false, description: "Reveal secret values" },
      },
      async run({ args }) {
        try {
          const secrets = await secretListInternal({
            rootDir: resolveCwd(args),
            env: String(args.env ?? "prod"),
            reveal: Boolean(args.reveal),
          });
          emitResult(args, { secrets }, JSON.stringify(secrets, null, 2));
        } catch (err) {
          emitError(args, "SECRET_LIST_ERROR", err instanceof Error ? err.message : String(err));
        }
      },
    }),
    export: defineCommand({
      meta: { name: "export", description: 'Export secrets as KEY="VALUE" lines' },
      args: {
        ...GLOBAL_ARGS_DEF,
        env: { type: "string", default: "prod", description: "Target environment (dev|prod)" },
      },
      async run({ args }) {
        try {
          const dotenv = await secretExportInternal({
            rootDir: resolveCwd(args),
            env: String(args.env ?? "prod"),
          });
          emitResult(args, { dotenv }, dotenv);
        } catch (err) {
          emitError(args, "SECRET_EXPORT_ERROR", err instanceof Error ? err.message : String(err));
        }
      },
    }),
  },
});
