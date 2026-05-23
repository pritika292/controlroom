import { describe, it, expect, beforeEach } from "vitest";
import { subscribe, publish, subscriberCount } from "../../src/server/services/sseHub.js";

// Reset hub state between tests by unsubscribing all clients in each test.
describe("sseHub", () => {
  it("delivers event + data to a subscribed client", () => {
    const received: Array<{ event: string; data: unknown }> = [];
    const unsub = subscribe({
      id: "test-1",
      send(event, data) {
        received.push({ event, data });
      },
    });

    publish("status", { healthy: true });
    unsub();

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ event: "status", data: { healthy: true } });
  });

  it("fans out to multiple subscribers", () => {
    const log: string[] = [];
    const unsub1 = subscribe({ id: "fan-1", send: (e) => log.push(`a:${e}`) });
    const unsub2 = subscribe({ id: "fan-2", send: (e) => log.push(`b:${e}`) });

    publish("ping", {});
    unsub1();
    unsub2();

    expect(log).toContain("a:ping");
    expect(log).toContain("b:ping");
  });

  it("stops delivering after unsubscribe", () => {
    const received: unknown[] = [];
    const unsub = subscribe({
      id: "gone-1",
      send(_e, data) {
        received.push(data);
      },
    });

    unsub();
    publish("after", { x: 1 });

    expect(received).toHaveLength(0);
  });

  it("tracks subscriber count correctly", () => {
    const before = subscriberCount();

    const unsub1 = subscribe({ id: "cnt-1", send: () => {} });
    const unsub2 = subscribe({ id: "cnt-2", send: () => {} });
    expect(subscriberCount()).toBe(before + 2);

    unsub1();
    expect(subscriberCount()).toBe(before + 1);

    unsub2();
    expect(subscriberCount()).toBe(before);
  });
});
