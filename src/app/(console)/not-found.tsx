import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ConsoleNotFound() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-primary">404</div>
        <h1 className="mt-2 text-2xl font-semibold">Раздел не найден</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Возможно, ссылка устарела или объект был удалён.
        </p>
        <Button className="mt-5" asChild>
          <Link href="/dashboard">Вернуться в обзор</Link>
        </Button>
      </div>
    </div>
  );
}
