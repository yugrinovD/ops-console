import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export default async function globalSetup() {
  await rm(path.join(os.tmpdir(), "ops-console-e2e-data"), {
    recursive: true,
    force: true,
  });
}
