import "server-only";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "./auth";

export async function requireSession() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  return session;
}
