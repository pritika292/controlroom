import "dotenv/config";
import { config } from "./config.js";
import { createApp } from "./app.js";
import { startHealthPoller, stopHealthPoller } from "./services/healthPoller.js";
import { startGithubSync, stopGithubSync } from "./services/githubSync.js";
import { startVisitsSweeper, stopVisitsSweeper } from "./services/visitsSweeper.js";
import { loadIncidents } from "./services/incidentsLoader.js";
import { closeRedis } from "./services/redis.js";

const PORT = config.PORT;

// Load incidents from content/incidents/*.md once at boot. Container restart
// on deploy is the reload mechanism in production.
const incidents = loadIncidents();
console.log(`[incidents] loaded ${incidents.length} from disk`);

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[server] listening on :${config.PORT} (env=${config.NODE_ENV})`);
  if (config.NODE_ENV !== "test") {
    startHealthPoller();
    startGithubSync();
    startVisitsSweeper();
  }
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}; shutting down`);
  void stopHealthPoller()
    .then(() => stopGithubSync())
    .then(() => stopVisitsSweeper())
    .then(() => closeRedis())
    .then(() => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 5_000).unref();
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
