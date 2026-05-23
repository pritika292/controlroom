import "dotenv/config";
import { createApp } from "./app.js";

const PORT = process.env["PORT"] ?? "3012";

const app = createApp();

const server = app.listen(Number(PORT), () => {
  console.log(`[server] listening on :${PORT}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}; shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
