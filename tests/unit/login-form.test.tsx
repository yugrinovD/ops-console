import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";
import { server } from "@/test/msw/server";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
});

describe("login form", () => {
  it("submits a token and redirects", async () => {
    server.use(
      http.post("*/api/auth/login", () =>
        HttpResponse.json({ role: "admin" }),
      ),
    );
    const user = userEvent.setup();
    render(<LoginForm next="/dashboard" />);
    await user.type(screen.getByLabelText("Токен доступа"), "secret-token");
    await user.click(screen.getByRole("button", { name: /Войти/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a server error for an invalid token", async () => {
    server.use(
      http.post("*/api/auth/login", () =>
        HttpResponse.json(
          { error: { code: "invalid_token", message: "Неверный токен доступа" } },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<LoginForm next="/dashboard" />);
    await user.type(screen.getByLabelText("Токен доступа"), "wrong");
    await user.click(screen.getByRole("button", { name: /Войти/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Неверный токен доступа");
    expect(replace).not.toHaveBeenCalled();
  });
});
