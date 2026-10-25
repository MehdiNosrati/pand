import { defineCommand, runMain } from "citty";
import { addEntityCommand } from "./commands/add-entity.js";
import { addServiceCommand } from "./commands/add-service.js";
import { backupCommand } from "./commands/backup.js";
import { boxCommand } from "./commands/box.js";
import { checkCommand } from "./commands/check.js";
import { dbCommand } from "./commands/db.js";
import { deployCommand, pauseCommand, resumeCommand } from "./commands/deploy.js";
import { devCommand } from "./commands/dev.js";
import { logsCommand } from "./commands/logs.js";
import { metricsCommand } from "./commands/metrics.js";
import { addAppCommand, newCommand } from "./commands/new.js";
import { previewCommand } from "./commands/preview.js";
import { sdkCommand } from "./commands/sdk-gen.js";
import { secretCommand } from "./commands/secret.js";
import { tracesCommand } from "./commands/traces.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { usageCommand } from "./commands/usage.js";

export const addCommand = defineCommand({
  meta: {
    name: "add",
    description: "Add a service, entity, or client app to the current Pand project",
  },
  subCommands: {
    service: addServiceCommand,
    entity: addEntityCommand,
    app: addAppCommand,
  },
});

export const mainCommand = defineCommand({
  meta: {
    name: "pand",
    version: "0.1.0",
    description: "Pand — Agent-Native Full-Stack Application Platform CLI",
  },
  subCommands: {
    new: newCommand,
    add: addCommand,
    db: dbCommand,
    sdk: sdkCommand,
    check: checkCommand,
    dev: devCommand,
    secret: secretCommand,
    box: boxCommand,
    deploy: deployCommand,
    pause: pauseCommand,
    resume: resumeCommand,
    backup: backupCommand,
    logs: logsCommand,
    metrics: metricsCommand,
    traces: tracesCommand,
    usage: usageCommand,
    preview: previewCommand,
    upgrade: upgradeCommand,
  },
});

export async function runCli(rawArgs: string[] = process.argv.slice(2)) {
  await runMain(mainCommand, { rawArgs });
}

export {
  addEntityInternal,
  type AddEntityOptions,
} from "./commands/add-entity.js";
export {
  addServiceInternal,
  type AddServiceInternalOptions,
} from "./commands/add-service.js";
export { checkProjectInternal } from "./commands/check.js";
export {
  dbGenerateInternal,
  dbMigrateInternal,
  dbSeedInternal,
  resolveDevDatabaseUrl,
} from "./commands/db.js";
export {
  buildAppDevSpawns,
  writeDevArtifacts,
  type AppSpawnSpec,
} from "./commands/dev.js";
export {
  newProjectInternal,
  scaffoldClientApp,
  type NewProjectOptions,
} from "./commands/new.js";
export { sdkGenInternal } from "./commands/sdk-gen.js";
export {
  secretExportInternal,
  secretGetInternal,
  secretInitInternal,
  secretListInternal,
  secretSetInternal,
} from "./commands/secret.js";
export {
  boxCreateInternal,
  boxStatusInternal,
  generateBoxSetupScript,
  readBoxMetadata,
} from "./commands/box.js";
export {
  deployInternal,
  generateAppDeployCompose,
  pauseResumeInternal,
} from "./commands/deploy.js";
export {
  backupListInternal,
  backupRestoreInternal,
  backupRunInternal,
  backupVerifyInternal,
} from "./commands/backup.js";
export { buildLogQlQuery, queryLogsInternal } from "./commands/logs.js";
export { queryMetricsInternal } from "./commands/metrics.js";
export { queryTracesInternal } from "./commands/traces.js";
export { checkUsageInternal } from "./commands/usage.js";
export { previewDownInternal, previewUpInternal } from "./commands/preview.js";
export { upgradeProjectInternal } from "./commands/upgrade.js";
export {
  parseFieldDsl,
  type FieldBaseType,
  type ParsedField,
} from "./generators/field-dsl.js";
export {
  insertBeforeMarker,
  pluralize,
  renderTemplateDir,
  renderTemplateString,
  toCamelCase,
  toHumanTitle,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
} from "./generators/template.js";
export {
  emitError,
  emitResult,
  getPlatformRootDir,
  GLOBAL_ARGS_DEF,
  resolveCwd,
} from "./output.js";
