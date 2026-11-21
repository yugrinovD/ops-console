import { ConsoleShell } from "@/components/layout/console-shell";
import { requireSession } from "@/lib/server/session";

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  return <ConsoleShell role={session.role}>{children}</ConsoleShell>;
}
