import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/server/auth";

export default async function IndexPage() {
  const session = await getSessionFromCookies();
  redirect(session ? "/dashboard" : "/login");
}
