import { describe, expect, it } from "vitest";
import {
  backupListInternal,
  backupRestoreInternal,
  backupRunInternal,
  backupVerifyInternal,
} from "../src/commands/backup.js";

describe("pand backup commands", () => {
  it("triggers backup, lists R2 encrypted dumps, restores into project DB, and verifies temporary restore", async () => {
    const runRes = await backupRunInternal({ project: "acme" });
    expect(runRes.ok).toBe(true);
    expect(runRes.command).toContain("backup-nightly.sh");

    const listRes = await backupListInternal({ project: "acme" });
    expect(listRes).toHaveLength(1);
    expect(listRes[0]!.key).toContain("dumps/acme_prod/");

    const restoreRes = await backupRestoreInternal({ project: "acme", latest: true });
    expect(restoreRes.restored).toBe(true);
    expect(restoreRes.targetDatabase).toBe("acme_prod");

    const verifyRes = await backupVerifyInternal({ project: "acme" });
    expect(verifyRes.verified).toBe(true);
    expect(verifyRes.temporaryDatabase).toBe("_pand_verify_tmp");
  });
});
