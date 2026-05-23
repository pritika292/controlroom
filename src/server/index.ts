import "dotenv/config";
import { config } from "./config.js";
import { createApp } from "./app.js";

const PORT = config.PORT;

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[server] listening on :${config.PORT} (env=${config.NODE_ENV})`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}; shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
