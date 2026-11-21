import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeProvider, type Theme } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { AppToaster } from "@/components/providers/app-toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Ops Console",
    template: "%s · Ops Console",
  },
  description:
    "Операционная консоль для gogate и lmlog: метрики, playground, ключи, квоты и анализ логов.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#121316" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const store = await cookies();
  const raw = store.get("console_theme")?.value;
  const theme: Theme =
    raw === "light" || raw === "system" || raw === "dark" ? raw : "dark";
  return (
    <html
      lang="ru"
      className={theme === "light" ? "" : "dark"}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <ThemeProvider initialTheme={theme}>
          <QueryProvider>
            <TooltipProvider delayDuration={200}>
              {children}
              <AppToaster />
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
