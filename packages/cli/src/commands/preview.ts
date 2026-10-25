import { loadPandConfig } from "@pand/config";
import { defineCommand } from "citty";
import { GLOBAL_ARGS_DEF, emitError, emitResult, resolveCwd } from "../output.js";
import { deployInternal } from "./deploy.js";

export async function previewUpInternal(options: {
  rootDir: string;
  prNumber: number;
  gitSha?: string;
  sshExecFn?: (cmd: string) => Promise<void>;
}) {
  const env = `pr-${options.prNumber}`;
  const { config } = await loadPandConfig(options.rootDir);
  const databaseName = `${config.name.replace(/-/g, "_")}_pr_${options.prNumber}`;

  const deployRes = await deployInternal({
    rootDir: options.rootDir,
    env,
    gitSha: options.gitSha ?? `pr-${options.prNumber}`,
    skipTests: true,
    sshExecFn: options.sshExecFn,
  });

  return {
    ...deployRes,
    prNumber: options.prNumber,
    databaseName,
  };
}

export async function previewDownInternal(options: {
  rootDir: string;
  prNumber: number;
  sshExecFn?: (cmd: string) => Promise<void>;
}) {
  const { config } = await loadPandConfig(options.rootDir);
  const env = `pr-${options.prNumber}`;
  const databaseName = `${config.name.replace(/-/g, "_")}_pr_${options.prNumber}`;
  const stopCmd = `docker compose -f /opt/pand/apps/${config.name}-${env}/docker-compose.yml down -v`;
  const dropDbCmd = `docker exec pand-postgres psql -U pand -c "DROP DATABASE IF EXISTS \\"${databaseName}\\";"`;

  if (options.sshExecFn) {
    await options.sshExecFn(stopCmd);
    await options.sshExecFn(dropDbCmd);
  }

  return {
    destroyed: true,
    project: config.name,
    prNumber: options.prNumber,
    databaseDropped: databaseName,
  };
}

export const previewCommand = defineCommand({
  meta: {
    name: "preview",
    description: "Manage isolated PR preview environments on the Box (up, down)",
  },
  subCommands: {
    up: defineCommand({
      meta: {
        name: "up",
        description: "Deploy PR preview environment https://<project>-pr-<n>.mahdins.dev",
      },
      args: {
        ...GLOBAL_ARGS_DEF,
        pr: { type: "string", required: true, description: "Pull Request number" },
      },
      async run({ args }) {
        try {
          const res = await previewUpInternal({
            rootDir: resolveCwd(args),
            prNumber: Number(args.pr),
          });
          emitResult(args, res, `Preview environment live at ${res.webUrl}`);
        } catch (err) {
          emitError(args, "PREVIEW_UP_ERROR", err instanceof Error ? err.message : String(err));
        }
      },
    }),
    down: defineCommand({
      meta: { name: "down", description: "Destroy PR preview containers and database" },
      args: {
        ...GLOBAL_ARGS_DEF,
        pr: { type: "string", required: true, description: "Pull Request number" },
      },
      async run({ args }) {
        try {
          const res = await previewDownInternal({
            rootDir: resolveCwd(args),
            prNumber: Number(args.pr),
          });
          emitResult(
            args,
            res,
            `Destroyed preview PR #${res.prNumber} and dropped database ${res.databaseDropped}`,
          );
        } catch (err) {
          emitError(args, "PREVIEW_DOWN_ERROR", err instanceof Error ? err.message : String(err));
        }
      },
    }),
  },
});
