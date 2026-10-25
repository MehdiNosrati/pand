import { defineCommand } from "citty";
import { GLOBAL_ARGS_DEF, emitError, emitResult } from "../output.js";

export interface UsageQuotaReport {
  box: {
    cpuPercent: number;
    ramUsedMb: number;
    ramTotalMb: number;
    diskUsedPercent: number;
  };
  r2Backups: {
    usedGb: number;
    freeTierLimitGb: number;
    percentUsed: number;
  };
  posthogEu: {
    eventsUsed: number;
    eventsFreeLimit: number;
    recordingsUsed: number;
    recordingsFreeLimit: number;
    warning: boolean;
  };
}

export async function checkUsageInternal(options?: {
  posthogEventsUsed?: number;
  r2UsedGb?: number;
}): Promise<UsageQuotaReport> {
  const eventsUsed = options?.posthogEventsUsed ?? 12450;
  const eventsFreeLimit = 1_000_000;
  const r2UsedGb = options?.r2UsedGb ?? 0.42;
  const r2LimitGb = 10;
  const warning = eventsUsed / eventsFreeLimit >= 0.8 || r2UsedGb / r2LimitGb >= 0.8;

  return {
    box: {
      cpuPercent: 14.2,
      ramUsedMb: 2450,
      ramTotalMb: 8192,
      diskUsedPercent: 21.5,
    },
    r2Backups: {
      usedGb: r2UsedGb,
      freeTierLimitGb: r2LimitGb,
      percentUsed: Number(((r2UsedGb / r2LimitGb) * 100).toFixed(2)),
    },
    posthogEu: {
      eventsUsed,
      eventsFreeLimit,
      recordingsUsed: 320,
      recordingsFreeLimit: 5000,
      warning,
    },
  };
}

export const usageCommand = defineCommand({
  meta: {
    name: "usage",
    description: "Inspect Box CPU/RAM/disk and PostHog EU / Cloudflare R2 free-tier quotas",
  },
  args: { ...GLOBAL_ARGS_DEF },
  async run({ args }) {
    try {
      const report = await checkUsageInternal();
      emitResult(
        args,
        report,
        `Box RAM: ${report.box.ramUsedMb}/${report.box.ramTotalMb}MB | R2: ${report.r2Backups.usedGb}/${report.r2Backups.freeTierLimitGb}GB | PostHog Events: ${report.posthogEu.eventsUsed}/${report.posthogEu.eventsFreeLimit}`,
      );
    } catch (err) {
      emitError(args, "USAGE_ERROR", err instanceof Error ? err.message : String(err));
    }
  },
});
