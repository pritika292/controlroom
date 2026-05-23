import { DefaultAzureCredential } from "@azure/identity";
import { MonitorClient } from "@azure/arm-monitor";
import { config } from "../config.js";

export interface VmMetrics {
  available: boolean; // false when AZURE_VM_RESOURCE_ID is unset or the call failed
  cpuPercent: number | null;
  memUsedPercent: number | null; // estimated; Azure exposes available bytes only
  region: string | null;
  sampledAt: string | null;
  reason: string | null; // why we couldn't read metrics, if available=false
}

// One MonitorClient instance reused across calls. Constructed lazily so
// dev environments without Azure credentials don't blow up at module load.
let clientPromise: Promise<MonitorClient | null> | null = null;

// VM total memory in MiB. Azure Monitor exposes "Available Memory Bytes"
// only, so we compute used% as (1 - available/total). B2as_v2 ships with
// 8 GiB; if Pritika resizes the VM, update this constant or read it from
// Azure Compute on the fly.
const VM_TOTAL_MEMORY_MIB = 8 * 1024;

function regionFromResourceId(resourceId: string): string {
  // Resource id is /subscriptions/<sub>/resourceGroups/<rg>/providers/...
  // Azure Monitor doesn't include the region in the metric response, so
  // we hard-pin the project's region instead of doing a Compute lookup.
  if (resourceId === "") return "unknown";
  return "northcentralus";
}

async function getClient(): Promise<MonitorClient | null> {
  if (config.AZURE_SUBSCRIPTION_ID === "" || config.AZURE_VM_RESOURCE_ID === "") return null;
  if (clientPromise === null) {
    clientPromise = (async (): Promise<MonitorClient | null> => {
      try {
        const credential = new DefaultAzureCredential();
        return new MonitorClient(credential, config.AZURE_SUBSCRIPTION_ID);
      } catch (err) {
        console.warn("[vmMetrics] could not initialize Azure credential:", err);
        return null;
      }
    })();
  }
  return clientPromise;
}

// Pull a single average sample for a metric over the last 5 minutes.
async function readMetric(
  client: MonitorClient,
  resourceId: string,
  metricName: string,
): Promise<number | null> {
  const now = new Date();
  const fiveAgo = new Date(now.getTime() - 5 * 60 * 1000);
  // timespan format is ISO8601/ISO8601
  const timespan = `${fiveAgo.toISOString()}/${now.toISOString()}`;
  try {
    const res = await client.metrics.list(resourceId, {
      timespan,
      interval: "PT1M",
      metricnames: metricName,
      aggregation: "Average",
    });
    const series = res.value?.[0]?.timeseries?.[0]?.data ?? [];
    // Walk newest-to-oldest, take the first sample that actually has a value.
    for (let i = series.length - 1; i >= 0; i--) {
      const v = series[i]?.average;
      if (typeof v === "number") return v;
    }
    return null;
  } catch (err) {
    console.warn(`[vmMetrics] metric ${metricName} read failed:`, err);
    return null;
  }
}

export async function vmMetrics(): Promise<VmMetrics> {
  const client = await getClient();
  if (!client) {
    return {
      available: false,
      cpuPercent: null,
      memUsedPercent: null,
      region: null,
      sampledAt: null,
      reason: "AZURE_VM_RESOURCE_ID or AZURE_SUBSCRIPTION_ID not configured",
    };
  }

  const resourceId = config.AZURE_VM_RESOURCE_ID;
  const [cpu, availableMemBytes] = await Promise.all([
    readMetric(client, resourceId, "Percentage CPU"),
    readMetric(client, resourceId, "Available Memory Bytes"),
  ]);

  const memUsedPercent =
    availableMemBytes === null
      ? null
      : Math.max(
          0,
          Math.min(100, 100 * (1 - availableMemBytes / 1024 / 1024 / VM_TOTAL_MEMORY_MIB)),
        );

  return {
    available: cpu !== null || memUsedPercent !== null,
    cpuPercent: cpu,
    memUsedPercent,
    region: regionFromResourceId(resourceId),
    sampledAt: new Date().toISOString(),
    reason: cpu === null && memUsedPercent === null ? "Azure Monitor returned no samples" : null,
  };
}
