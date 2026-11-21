import "server-only";
import { getEnv } from "./env";
import { getHealth } from "./gogate";
import { jaegerHealthy } from "./jaeger";
import { lmlogHealth } from "./lmlog";
import { prometheusHealthy } from "./prometheus";

export type ServiceState = "ok" | "down" | "not_configured";

export interface ServiceHealth {
  name: string;
  label: string;
  state: ServiceState;
  detail?: string;
}

export interface HealthSnapshot {
  status: "ok" | "degraded";
  checkedAt: string;
  services: ServiceHealth[];
}

const CACHE_TTL_MS = 5_000;
let cached: { at: number; value: HealthSnapshot } | null = null;
let inFlight: Promise<HealthSnapshot> | null = null;

async function collectHealth(requestId?: string): Promise<HealthSnapshot> {
  const env = getEnv();

  const gogateService = (async (): Promise<ServiceHealth> => {
    if (!env.GOGATE_ADMIN_URL || !env.GOGATE_ADMIN_TOKEN) {
      return {
        name: "gogate",
        label: "gogate",
        state: "not_configured",
        detail: "admin API не настроен",
      };
    }
    try {
      const health = await getHealth(requestId);
      return {
        name: "gogate",
        label: "gogate",
        state: "ok",
        detail: health.version ? `v${health.version}` : undefined,
      };
    } catch {
      return {
        name: "gogate",
        label: "gogate",
        state: "down",
        detail: "admin API недоступен",
      };
    }
  })();

  const lmlogService = (async (): Promise<ServiceHealth> => {
    if (!env.LMLOG_API_URL || !env.LMLOG_API_TOKEN) {
      return {
        name: "lmlog",
        label: "lmlog",
        state: "not_configured",
        detail: "API не настроен",
      };
    }
    const health = await lmlogHealth();
    const aiDegraded =
      health.ok && health.llmEnabled !== false && health.llmAvailable === false;
    return {
      name: "lmlog",
      label: "lmlog",
      state: health.ok ? "ok" : "down",
      detail: health.ok
        ? aiDegraded
          ? "AI: heuristic (gateway unavailable)"
          : undefined
        : "API недоступен",
    };
  })();

  const prometheusService = (async (): Promise<ServiceHealth> => {
    if (!env.PROMETHEUS_URL) {
      return {
        name: "prometheus",
        label: "Prometheus",
        state: "not_configured",
        detail: "URL не задан",
      };
    }
    const ok = await prometheusHealthy();
    return {
      name: "prometheus",
      label: "Prometheus",
      state: ok ? "ok" : "down",
      detail: ok ? undefined : "недоступен",
    };
  })();

  const jaegerService = (async (): Promise<ServiceHealth> => {
    if (!env.GOGATE_JAEGER_URL) {
      return {
        name: "jaeger",
        label: "Jaeger",
        state: "not_configured",
        detail: "URL не задан",
      };
    }
    const ok = await jaegerHealthy();
    return {
      name: "jaeger",
      label: "Jaeger",
      state: ok ? "ok" : "down",
      detail: ok ? undefined : "недоступен",
    };
  })();

  const services = await Promise.all([
    gogateService,
    lmlogService,
    prometheusService,
    jaegerService,
  ]);

  return {
    status: services.some((service) => service.state === "down")
      ? "degraded"
      : "ok",
    checkedAt: new Date().toISOString(),
    services,
  };
}

export async function getHealthSnapshot(
  requestId?: string,
): Promise<HealthSnapshot> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }
  if (inFlight) return inFlight;
  inFlight = collectHealth(requestId).finally(() => {
    inFlight = null;
  });
  const value = await inFlight;
  cached = { at: Date.now(), value };
  return value;
}

export function resetHealthCacheForTests() {
  cached = null;
  inFlight = null;
}
