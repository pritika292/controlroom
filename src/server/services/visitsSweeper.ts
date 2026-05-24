import { sweepOldVisits } from "./visits.js";

// Daily retention sweep for site_visits (#87). 90-day window is enough to
// show "this week vs last week" trend deltas and a 30-day per-project chart
// without unbounded table growth. Runs once on boot (catch-up) and then
// every 24 hours.

const INTERVAL_MS = 24 * 60 * 60 * 1_000;
const MAX_AGE_DAYS = 90;

let handle: ReturnType<typeof setTimeout> | null = null;

async function tick(): Promise<void> {
  try {
    const n = await sweepOldVisits(MAX_AGE_DAYS);
    if (n > 0) console.log(`[visits-sweep] deleted ${n} rows older than ${MAX_AGE_DAYS}d`);
  } catch (err) {
    console.error("[visits-sweep] failed", err);
  }
}

export function startVisitsSweeper(): void {
  if (handle !== null) return;
  void tick();
  handle = setInterval(() => {
    void tick();
  }, INTERVAL_MS);
  handle.unref();
}

export async function stopVisitsSweeper(): Promise<void> {
  if (handle !== null) {
    clearInterval(handle);
    handle = null;
  }
}
