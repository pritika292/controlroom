import { Router } from "express";
import { subscribe } from "../services/sseHub.js";

export const sseRouter = Router();

sseRouter.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  // Flush headers immediately so the client sees 200 + SSE headers.
  res.flushHeaders();

  // Send initial hello event.
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const unsubscribe = subscribe({
    id: clientId,
    send(event, data) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
  });

  // Heartbeat every 15s keeps proxies from closing idle connections.
  const heartbeat = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 15_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
