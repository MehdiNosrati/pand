import { describe, expect, it } from "vitest";
import { createPushService } from "../src/index.js";

describe("@pands/push", () => {
  it("registers iOS APNs and Android FCM device tokens and dispatches push notifications", async () => {
    const sent: Array<{ platform: string; token: string; title: string }> = [];
    const push = createPushService({
      transport: async (dev, msg) => {
        sent.push({ platform: dev.platform, token: dev.token, title: msg.title });
      },
    });

    push.registerDevice({ userId: "u1", platform: "ios", token: "apns-token-1" });
    push.registerDevice({ userId: "u1", platform: "android", token: "fcm-token-2" });

    const res = await push.sendToUser("u1", {
      title: "Task Due",
      body: "Ship Pand v0.1.0",
    });

    expect(res.delivered).toBe(2);
    expect(sent).toEqual([
      { platform: "ios", token: "apns-token-1", title: "Task Due" },
      { platform: "android", token: "fcm-token-2", title: "Task Due" },
    ]);
  });
});
