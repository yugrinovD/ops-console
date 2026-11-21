import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Вход",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const raw = params.next ?? "";
  const next =
    raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login")
      ? raw
      : "/dashboard";
  return <LoginForm next={next} />;
}
