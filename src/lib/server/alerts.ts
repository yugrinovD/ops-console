import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  alertRuleInputSchema,
  alertRuleSchema,
  type AlertRule,
  type AlertRuleInput,
} from "@/lib/schemas/alerts";
import type { DashboardData, Incident } from "@/lib/schemas/dashboard";
import { AppError } from "./app-error";

interface AlertFile {
  version: 1;
  rules: AlertRule[];
}

function emptyFile(): AlertFile {
  return { version: 1, rules: [] };
}
let writeQueue: Promise<unknown> = Promise.resolve();

function filePath() {
  return path.join(process.env.CONSOLE_DATA_DIR ?? "./data", "alerts.json");
}

async function readFileSafe(): Promise<AlertFile> {
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "rules" in parsed &&
      Array.isArray((parsed as AlertFile).rules)
    ) {
      return {
        version: 1,
        rules: (parsed as AlertFile).rules
          .map((rule) => alertRuleSchema.safeParse(rule))
          .filter((result) => result.success)
          .map((result) => result.data),
      };
    }
    return emptyFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyFile();
    throw new AppError(
      500,
      "alerts_unavailable",
      "Не удалось прочитать файл правил алертов",
    );
  }
}

async function writeFileSafe(data: AlertFile) {
  const target = filePath();
  await mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${randomUUID()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(tmp, target);
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function listAlertRules(): Promise<AlertRule[]> {
  return (await readFileSafe()).rules;
}

export async function createAlertRule(input: AlertRuleInput): Promise<AlertRule> {
  const parsed = alertRuleInputSchema.parse(input);
  return enqueue(async () => {
    const data = await readFileSafe();
    const now = new Date().toISOString();
    const rule: AlertRule = {
      ...parsed,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    data.rules.push(rule);
    await writeFileSafe(data);
    return rule;
  });
}

export async function updateAlertRule(
  id: string,
  input: AlertRuleInput,
): Promise<AlertRule> {
  const parsed = alertRuleInputSchema.parse(input);
  return enqueue(async () => {
    const data = await readFileSafe();
    const index = data.rules.findIndex((rule) => rule.id === id);
    if (index < 0) throw new AppError(404, "alert_not_found", "Правило не найдено");
    const updated: AlertRule = {
      ...data.rules[index]!,
      ...parsed,
      id,
      updatedAt: new Date().toISOString(),
    };
    data.rules[index] = updated;
    await writeFileSafe(data);
    return updated;
  });
}

export async function deleteAlertRule(id: string): Promise<void> {
  await enqueue(async () => {
    const data = await readFileSafe();
    const next = data.rules.filter((rule) => rule.id !== id);
    if (next.length === data.rules.length) {
      throw new AppError(404, "alert_not_found", "Правило не найдено");
    }
    data.rules = next;
    await writeFileSafe(data);
  });
}

export function metricValue(rule: AlertRule, data: DashboardData): number | null {
  switch (rule.metric) {
    case "errorRate":
      return data.totals.errorRate === null ? null : data.totals.errorRate * 100;
    case "p95":
      return data.totals.p95 === null ? null : data.totals.p95 * 1000;
    case "p99":
      return data.totals.p99 === null ? null : data.totals.p99 * 1000;
    case "rps":
      return data.totals.rps;
    case "cacheHitShare":
      return data.totals.cacheHitShare === null
        ? null
        : data.totals.cacheHitShare * 100;
    case "rateLimited":
      return data.totals.rateLimited;
    default:
      return null;
  }
}

function matches(comparator: AlertRule["comparator"], value: number, threshold: number) {
  switch (comparator) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    default:
      return false;
  }
}

export async function evaluateAlertRules(data: DashboardData): Promise<Incident[]> {
  const rules = await listAlertRules();
  return rules
    .filter((rule) => rule.enabled)
    .flatMap((rule) => {
      const value = metricValue(rule, data);
      if (value === null || Number.isNaN(value)) return [];
      if (!matches(rule.comparator, value, rule.threshold)) return [];
      return [
        {
          id: rule.id,
          name: rule.name,
          severity: rule.severity,
          metric: rule.metric,
          value,
          threshold: rule.threshold,
          comparator: rule.comparator,
        } satisfies Incident,
      ];
    });
}
