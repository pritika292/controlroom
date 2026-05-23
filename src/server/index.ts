import "dotenv/config";
import { config } from "./config.js";
import { createApp } from "./app.js";
import { startHealthPoller, stopHealthPoller } from "./services/healthPoller.js";
import { closeRedis } from "./services/redis.js";

const PORT = config.PORT;

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[server] listening on :${config.PORT} (env=${config.NODE_ENV})`);
  if (config.NODE_ENV !== "test") {
    startHealthPoller();
  }
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}; shutting down`);
  void stopHealthPoller()
    .then(() => closeRedis())
    .then(() => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 5_000).unref();
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
