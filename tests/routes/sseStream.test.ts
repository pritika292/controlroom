import { describe, it, expect } from "vitest";
import http from "node:http";
import { createApp } from "../../src/server/app.js";
import { subscriberCount } from "../../src/server/services/sseHub.js";

// Helper: start an ephemeral server, open an SSE connection, collect the first
// chunk, then destroy the socket and shut the server down.
function readFirstChunk(server: http.Server, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const req = http.get({ host: "127.0.0.1", port: addr.port, path }, (res) => {
      res.once("data", (chunk: Buffer) => {
        resolve(chunk.toString());
        req.destroy();
      });
      res.once("error", reject);
    });
    req.once("error", (err) => {
      // Destroyed socket emits ECONNRESET — that's expected after we call
      // req.destroy(), so only reject on other errors.
      if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") reject(err);
    });
  });
}

function listen(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}

describe("GET /api/stream", () => {
  it("returns 200 with content-type text/event-stream", async () => {
    const server = http.createServer(createApp());
    await listen(server);

    const statusAndType = await new Promise<{ status: number; ct: string }>((resolve, reject) => {
      const addr = server.address() as { port: number };
      const req = http.get({ host: "127.0.0.1", port: addr.port, path: "/api/stream" }, (res) => {
        resolve({
          status: res.statusCode ?? 0,
          ct: res.headers["content-type"] ?? "",
        });
        req.destroy();
      });
      req.once("error", (err) => {
        if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") reject(err);
      });
    });

    await close(server);
    expect(statusAndType.status).toBe(200);
    expect(statusAndType.ct).toMatch(/text\/event-stream/);
  });

  it("sends the hello event as the first chunk", async () => {
    const server = http.createServer(createApp());
    await listen(server);

    const body = await readFirstChunk(server, "/api/stream");
    await close(server);

    expect(body).toContain("event: hello");
    expect(body).toContain('"ok":true');
  });

  it("decrements subscriberCount when the request closes", async () => {
    const server = http.createServer(createApp());
    await listen(server);

    const before = subscriberCount();

    // Wait until the subscriber has been added (hello chunk arrives), then
    // destroy the socket to trigger req 'close' on the server side.
    await readFirstChunk(server, "/api/stream");

    // Give the server event loop a tick to process the close event.
    await new Promise((r) => setImmediate(r));

    const after = subscriberCount();
    await close(server);

    expect(after).toBe(before);
  });
});
