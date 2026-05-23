import type { ProjectPing } from "../hooks/useProjectPings.js";

interface Props {
  pings: ProjectPing[];
  width?: number;
  height?: number;
}

interface Bucket {
  loMs: number;
  hiMs: number;
  count: number;
}

// Pick a bucket size that gives roughly 12-16 columns over the observed
// range. Round to a "nice" multiple of 5/10/25/50/100 so the labels read
// well. For typical /health calls the range is single-digit ms; for slower
// targets it might be seconds. This keeps both cases legible.
function pickBucketSizeMs(maxMs: number): number {
  const target = 14;
  const raw = Math.max(1, maxMs / target);
  const candidates = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];
  for (const c of candidates) {
    if (c >= raw) return c;
  }
  return 2000;
}

function bucketize(pings: ProjectPing[]): { buckets: Bucket[]; total: number } {
  const measured = pings
    .map((p) => p.latencyMs)
    .filter((v): v is number => typeof v === "number" && v >= 0);

  if (measured.length === 0) return { buckets: [], total: 0 };

  const max = Math.max(...measured);
  const size = pickBucketSizeMs(max);
  const numBuckets = Math.max(1, Math.ceil((max + 1) / size));
  const buckets: Bucket[] = Array.from({ length: numBuckets }, (_, i) => ({
    loMs: i * size,
    hiMs: (i + 1) * size,
    count: 0,
  }));

  for (const v of measured) {
    const idx = Math.min(numBuckets - 1, Math.floor(v / size));
    const b = buckets[idx];
    if (b !== undefined) b.count += 1;
  }
  return { buckets, total: measured.length };
}

export function LatencyHistogram({ pings, width = 720, height = 120 }: Props): JSX.Element {
  const { buckets, total } = bucketize(pings);

  if (buckets.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Latency histogram: not enough data"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x={0}
          y={height - 1}
          width={width}
          height={1}
          className="fill-zinc-200 dark:fill-zinc-800"
        />
      </svg>
    );
  }

  const maxCount = Math.max(...buckets.map((b) => b.count));
  const padX = 2;
  const padY = 18;
  const usableW = width - 2 * padX;
  const usableH = height - 2 * padY;
  const colW = usableW / buckets.length;

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={`Latency histogram: ${total} measured pings across ${buckets.length} buckets`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x={0}
        y={height - 1}
        width={width}
        height={1}
        className="fill-zinc-200 dark:fill-zinc-800"
      />

      {buckets.map((b, i) => {
        const x = padX + i * colW;
        const h = (b.count / maxCount) * usableH;
        const y = padY + (usableH - h);
        const title = `${b.loMs}-${b.hiMs}ms: ${b.count} ping${b.count === 1 ? "" : "s"}`;
        return (
          <g key={i}>
            <rect
              x={x + 0.5}
              y={y}
              width={Math.max(1, colW - 1)}
              height={Math.max(0, h)}
              className={b.count > 0 ? "fill-accent" : "fill-zinc-200 dark:fill-zinc-800"}
            >
              <title>{title}</title>
            </rect>
          </g>
        );
      })}

      {/* Min + max bucket labels along the bottom */}
      <text
        x={padX}
        y={height - 4}
        className="fill-zinc-500 dark:fill-zinc-400 font-mono text-[10px]"
      >
        {buckets[0]?.loMs ?? 0}ms
      </text>
      <text
        x={width - padX - 2}
        y={height - 4}
        textAnchor="end"
        className="fill-zinc-500 dark:fill-zinc-400 font-mono text-[10px]"
      >
        {buckets[buckets.length - 1]?.hiMs ?? 0}ms
      </text>
    </svg>
  );
}
