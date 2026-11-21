export const SESSION_COOKIE = "console_session";
export const CSRF_COOKIE = "console_csrf";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export type Role = "admin" | "viewer";

export interface SessionPayload {
  role: Role;
  iat: number;
  exp: number;
  v: 1;
}
