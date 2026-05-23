import { useInfra, type ContainerEntry } from "../hooks/useInfra.js";

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}S`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}M`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}H ${m % 60}M`;
  const d = Math.floor(h / 24);
  return `${d}D ${h % 24}H`;
}

export function InfraPanel(): JSX.Element | null {
  const { infra } = useInfra();
  if (infra === null) return <div className="mt-8 h-40" aria-hidden />;

  return (
    <section className="mt-8">
      <p className="te-label">INFRASTRUCTURE</p>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        <VmCard infra={infra} />
        <ServicesCard infra={infra} />
        <CostCard infra={infra} />
      </div>

      <ContainerGrid containers={infra.containers} />
    </section>
  );
}

function VmCard({
  infra,
}: {
  infra: NonNullable<ReturnType<typeof useInfra>["infra"]>;
}): JSX.Element {
  const { vm } = infra;
  return (
    <article className="te-panel p-5">
      <p className="te-label">AZURE VM</p>
      <div className="mt-1 flex items-baseline justify-between">
        <h3 className="font-mono text-lg text-zinc-900 dark:text-white">B2as_v2</h3>
        <span className="te-code">{vm.region ?? "-"}</span>
      </div>

      <Gauge label="CPU" value={vm.cpuPercent} />
      <Gauge label="MEMORY" value={vm.memUsedPercent} />

      <p className="mt-3 te-code">UPTIME / {formatUptime(vm.uptimeSeconds)}</p>
      {!vm.available && (
        <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-600">
          {vm.reason ?? "metrics unavailable"}
        </p>
      )}
    </article>
  );
}

function Gauge({ label, value }: { label: string; value: number | null }): JSX.Element {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const text = value === null ? "-" : `${value.toFixed(1)}%`;
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between">
        <span className="te-label">{label}</span>
        <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{text}</span>
      </div>
      <div className="mt-1 h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

function ServicesCard({
  infra,
}: {
  infra: NonNullable<ReturnType<typeof useInfra>["infra"]>;
}): JSX.Element {
  return (
    <article className="te-panel p-5">
      <p className="te-label">SHARED SERVICES</p>
      <h3 className="mt-1 font-mono text-lg text-zinc-900 dark:text-white">postgres + redis</h3>

      <ServiceRow label="POSTGRES 16" up={infra.postgres.up} latencyMs={infra.postgres.latencyMs} />
      <ServiceRow label="REDIS 7 / DB12" up={infra.redis.up} latencyMs={infra.redis.latencyMs} />

      <p className="mt-4 te-code">SHARED ACROSS ALL 11 PROJECTS</p>
    </article>
  );
}

function ServiceRow({
  label,
  up,
  latencyMs,
}: {
  label: string;
  up: boolean;
  latencyMs: number | null;
}): JSX.Element {
  return (
    <div className="mt-3 flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={"inline-block h-2 w-2 transition-colors " + (up ? "bg-accent" : "bg-rose-500")}
        />
        <span className="te-label">{label}</span>
      </span>
      <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
        {up ? `${latencyMs ?? "-"}MS` : "DOWN"}
      </span>
    </div>
  );
}

function CostCard({
  infra,
}: {
  infra: NonNullable<ReturnType<typeof useInfra>["infra"]>;
}): JSX.Element {
  return (
    <article className="te-panel p-5">
      <p className="te-label">MONTHLY COST</p>
      <div className="mt-1 flex items-baseline gap-2">
        <h3 className="font-mono text-3xl text-zinc-900 dark:text-white">
          ${infra.cost.monthlyUsd}
        </h3>
        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">/MO</span>
      </div>
      <p className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {infra.cost.note}
      </p>

      <ul className="mt-4 space-y-1 text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
        <li className="flex justify-between">
          <span>VM B2AS_V2</span>
          <span>~$30</span>
        </li>
        <li className="flex justify-between">
          <span>STORAGE</span>
          <span>~$0</span>
        </li>
        <li className="flex justify-between">
          <span>KEY VAULT</span>
          <span>~$0</span>
        </li>
        <li className="flex justify-between text-zinc-500 dark:text-zinc-500">
          <span>VS ENTERPRISE</span>
          <span>CREDIT</span>
        </li>
      </ul>
    </article>
  );
}

function roleClass(c: ContainerEntry): string {
  if (!c.up && c.role === "planned")
    return "border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600";
  if (!c.up) return "border-rose-500 text-rose-600 dark:text-rose-400";
  if (c.role === "app") return "border-accent text-accent";
  if (c.role === "shared")
    return "border-zinc-700 dark:border-zinc-300 text-zinc-900 dark:text-white";
  return "border-zinc-400 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300";
}

function ContainerGrid({ containers }: { containers: ContainerEntry[] }): JSX.Element {
  return (
    <article className="te-panel mt-3 p-5">
      <div className="flex items-baseline justify-between">
        <p className="te-label">CONTAINERS ON VM</p>
        <p className="te-code">
          {containers.filter((c) => c.up).length}/{containers.length} UP
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {containers.map((c) => (
          <div
            key={c.code}
            className={
              "border p-2 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900 " + roleClass(c)
            }
            title={c.name}
          >
            <p className="font-mono text-[10px] leading-tight">{c.code}</p>
            <p className="mt-0.5 font-mono text-[10px] leading-tight truncate">{c.name}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <LegendDot className="bg-accent" label="App / live" />
        <LegendDot className="bg-zinc-900 dark:bg-white" label="Shared" />
        <LegendDot className="bg-zinc-400 dark:bg-zinc-600" label="Other" />
        <LegendDot
          className="border border-dashed border-zinc-400 dark:border-zinc-600"
          label="Planned"
        />
      </div>
    </article>
  );
}

function LegendDot({ className, label }: { className: string; label: string }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`inline-block h-2 w-2 ${className}`} />
      {label}
    </span>
  );
}
