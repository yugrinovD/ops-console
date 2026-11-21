import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { Markdown } from "@/components/common/markdown";
import { CopyButton } from "@/components/common/copy-button";
import { Progress } from "@/components/ui/progress";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("shared UI", () => {
  it("renders a metric card", () => {
    render(
      <StatCard
        label="Requests / sec"
        value="12,5"
        hint="текущий RPS"
        icon={Activity}
        tone="success"
      />,
    );
    expect(screen.getByText("Requests / sec")).toBeInTheDocument();
    expect(screen.getByText("12,5")).toBeInTheDocument();
    expect(screen.getByText("текущий RPS")).toBeInTheDocument();
  });

  it("renders progress accessibility attributes", () => {
    render(<Progress value={42} />);
    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "42");
  });

  it("renders empty states with an action", () => {
    render(
      <EmptyState
        icon={Activity}
        title="Пока пусто"
        description="Загрузите данные"
        action={<button>Действие</button>}
      />,
    );
    expect(screen.getByText("Пока пусто")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Действие" })).toBeInTheDocument();
  });

  it("sanitises model output before rendering markdown", () => {
    const { container } = render(
      <Markdown>{"# Заголовок\n\n<script>window.__xss = true</script>"}</Markdown>,
    );
    expect(screen.getByRole("heading", { name: "Заголовок" })).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });

  it("copies values through the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(
      <TooltipProvider>
        <CopyButton value="request-123" label="Копировать" />
      </TooltipProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Копировать" }));
    expect(writeText).toHaveBeenCalledWith("request-123");
  });
});
