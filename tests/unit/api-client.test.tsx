import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { modelCatalogSchema } from "@/lib/schemas/gogate";
import { ServiceStatus } from "@/components/layout/service-status";
import { server } from "@/test/msw/server";
import { health, modelCatalog } from "@/test/fixtures";

describe("API client", () => {
  it("parses a successful response with Zod", async () => {
    server.use(
      http.get("*/api/models", () =>
        HttpResponse.json(modelCatalog),
      ),
    );
    const data = await apiFetch(modelCatalogSchema, "/api/models");
    expect(data.models).toContain("mock");
  });

  it("maps an error envelope to ApiClientError", async () => {
    server.use(
      http.get("*/api/models", () =>
        HttpResponse.json(
          { error: { code: "upstream_down", message: "Нет соединения" } },
          { status: 502 },
        ),
      ),
    );
    await expect(apiFetch(modelCatalogSchema, "/api/models")).rejects.toMatchObject({
      name: "ApiClientError",
      status: 502,
      code: "upstream_down",
      message: "Нет соединения",
    } satisfies Partial<ApiClientError>);
  });

  it("renders service health through MSW and React Query", async () => {
    server.use(
      http.get("*/api/health", () => HttpResponse.json(health)),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <ServiceStatus />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Сервисы в норме")).toBeInTheDocument();
  });
});
