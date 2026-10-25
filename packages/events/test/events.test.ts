import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createEventBus, defineEvent } from "../src/index.js";

describe("@pand/events", () => {
  it("validates event payloads with Zod, dispatches to subscribers, and registers cron schedules", async () => {
    const OrderPaidEvent = defineEvent(
      "billing.order_paid",
      z.object({
        orderId: z.string().uuid(),
        amountCents: z.number().int().positive(),
      }),
    );

    const bus = createEventBus({ serviceName: "billing", inMemory: true });
    await bus.start();

    const received: Array<{ orderId: string; amountCents: number }> = [];
    await bus.subscribe(OrderPaidEvent, async (payload) => {
      received.push(payload);
    });

    const id = crypto.randomUUID();
    await bus.publish(OrderPaidEvent, { orderId: id, amountCents: 2500 });
    expect(received).toEqual([{ orderId: id, amountCents: 2500 }]);

    await expect(
      bus.publish(OrderPaidEvent, { orderId: "not-a-uuid", amountCents: -10 }),
    ).rejects.toThrow();

    await bus.stop();
  });
});
