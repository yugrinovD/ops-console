import { beforeEach, describe, expect, it } from "vitest";
import {
  createSession,
  randomToken,
  signSession,
  verifySession,
  type SessionPayload,
} from "@/lib/session";

beforeEach(() => {
  process.env.CONSOLE_AUTH_TOKEN = "test-admin-token";
  process.env.CONSOLE_SESSION_SECRET = "test-session-secret";
});

describe("session tokens", () => {
  it("signs and verifies a session", async () => {
    const { token, payload } = await createSession("admin");
    const verified = await verifySession(token);
    expect(verified?.role).toBe("admin");
    expect(verified?.exp).toBe(payload.exp);
    expect(verified?.v).toBe(1);
  });

  it("rejects tampered payloads and signatures", async () => {
    const { token } = await createSession("viewer");
    const [body, signature] = token.split(".");
    const tamperedBody = `${body?.slice(0, -2)}AA`;
    expect(await verifySession(`${tamperedBody}.${signature}`)).toBeNull();
    expect(await verifySession(`${body}.${signature?.slice(0, -2)}AA`)).toBeNull();
  });

  it("rejects expired sessions", async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = {
      role: "admin",
      iat: now - 100,
      exp: now - 1,
      v: 1,
    };
    expect(await verifySession(await signSession(payload))).toBeNull();
  });

  it("rejects sessions signed with another secret", async () => {
    const { token } = await createSession("admin");
    expect(await verifySession(token, "other-secret")).toBeNull();
  });

  it("rejects unknown roles", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signSession({
      role: "superadmin" as never,
      iat: now,
      exp: now + 60,
      v: 1,
    });
    expect(await verifySession(token)).toBeNull();
  });

  it("generates random-looking tokens", () => {
    const first = randomToken(16);
    const second = randomToken(16);
    expect(first).toHaveLength(32);
    expect(first).not.toBe(second);
  });
});
