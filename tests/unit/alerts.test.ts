import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvForTests } from "@/lib/server/env";
import {
  createAlertRule,
  deleteAlertRule,
  evaluateAlertRules,
  listAlertRules,
  updateAlertRule,
} from "@/lib/server/alerts";
import { dashboard } from "@/test/fixtures";

let directory = "";

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "ops-console-alerts-"));
  process.env.CONSOLE_AUTH_TOKEN = "test-admin-token";
  process.env.CONSOLE_DATA_DIR = directory;
  resetEnvForTests();
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("alert rules", () => {
  it("creates, updates and deletes rules atomically", async () => {
    const created = await createAlertRule({
      name: "5xx rate",
      metric: "errorRate",
      comparator: "gt",
      threshold: 0.5,
      severity: "warning",
      enabled: true,
    });
    expect(created.id).toBeTruthy();
    expect(await listAlertRules()).toHaveLength(1);

    const updated = await updateAlertRule(created.id, {
      name: "5xx rate high",
      metric: "errorRate",
      comparator: "gt",
      threshold: 10,
      severity: "critical",
      enabled: true,
    });
    expect(updated.name).toBe("5xx rate high");
    expect(updated.threshold).toBe(10);

    await deleteAlertRule(created.id);
    expect(await listAlertRules()).toHaveLength(0);
  });

  it("evaluates thresholds against dashboard metrics", async () => {
    const rule = await createAlertRule({
      name: "1% errors",
      metric: "errorRate",
      comparator: "gte",
      threshold: 0.5,
      severity: "warning",
      enabled: true,
    });
    const incidents = await evaluateAlertRules(dashboard);
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      id: rule.id,
      metric: "errorRate",
      severity: "warning",
    });
    expect(incidents[0]?.value).toBeCloseTo(1);

    await updateAlertRule(rule.id, {
      name: "1% errors",
      metric: "errorRate",
      comparator: "gte",
      threshold: 5,
      severity: "warning",
      enabled: true,
    });
    expect(await evaluateAlertRules(dashboard)).toHaveLength(0);
  });

  it("ignores disabled rules", async () => {
    await createAlertRule({
      name: "disabled",
      metric: "errorRate",
      comparator: "gt",
      threshold: 0,
      severity: "info",
      enabled: false,
    });
    expect(await evaluateAlertRules(dashboard)).toHaveLength(0);
  });
});
