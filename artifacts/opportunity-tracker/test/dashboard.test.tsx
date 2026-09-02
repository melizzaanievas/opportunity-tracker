import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/pages/dashboard";

const BOT_TOKEN = "123456789:dashboard-test-bot-token";
const WEBHOOK_SECRET = "dashboard-test-webhook-secret";

const healthState = vi.hoisted(() => ({
  data: null as {
    telegramWebhook: {
      status: "pending" | "successful" | "failed";
      webhookUrl: string | null;
      description: string | null;
      liveStatus:
        | "unknown"
        | "matching"
        | "out_of_band"
        | "stale"
        | "unavailable";
      liveWebhookUrl: string | null;
      liveDescription: string | null;
      secretTokenConfigured: boolean;
    };
  } | null,
}));

vi.mock("@workspace/api-client-react", () => ({
  getHealthCheckQueryKey: vi.fn(() => ["health-check"]),
  useHealthCheck: vi.fn(() => ({
    data: healthState.data,
    isError: false,
    isFetching: false,
    refetch: vi.fn().mockResolvedValue({ data: healthState.data }),
  })),
  useRegisterTelegramWebhook: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn(),
  })),
  useGetAuthMe: vi.fn(() => ({
    data: { authenticated: true },
    isLoading: false,
  })),
  useLogout: vi.fn(() => ({
    isPending: false,
    mutate: vi.fn(),
  })),
  useGetDashboardStats: vi.fn(() => ({
    data: {
      total: 0,
      closingSoon: 0,
      byStatus: {
        "to-apply": 0,
        applied: 0,
        interviewing: 0,
        offered: 0,
        archived: 0,
      },
    },
    isLoading: false,
  })),
  useListOpportunities: vi.fn(() => ({
    data: [],
    isLoading: false,
  })),
  useTestTelegramAlert: vi.fn(() => ({
    isPending: false,
    mutate: vi.fn(),
  })),
  useUpdateOpportunity: vi.fn(() => ({
    isPending: false,
    mutate: vi.fn(),
  })),
}));

vi.mock("@/components/layout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

function healthResponse(
  liveStatus: "unknown" | "matching" | "out_of_band" | "stale" | "unavailable",
) {
  return {
    telegramWebhook: {
      status: "successful" as const,
      webhookUrl: "https://example.replit.app/api/integrations/telegram-webhook",
      description: null,
      liveStatus,
      liveWebhookUrl: "https://example.replit.app/api/integrations/telegram-webhook",
      liveDescription: "Telegram returned a safe status description.",
      secretTokenConfigured: true,
    },
  };
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>,
  );
}

describe("Dashboard Telegram webhook warning", () => {
  beforeEach(() => {
    healthState.data = null;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("quote disabled")));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each([
    {
      status: "out_of_band" as const,
      title: "Telegram webhook is out of band",
      action: "Review the Telegram webhook URL and allowed updates",
    },
    {
      status: "stale" as const,
      title: "Telegram webhook is stale",
      action: "Re-register the Telegram webhook and confirm",
    },
    {
      status: "unavailable" as const,
      title: "Telegram webhook is unavailable",
      action: "Check Telegram API availability and the app's Telegram configuration",
    },
  ])(
    "keeps the $status warning visible with actionable copy and no credentials",
    ({ status, title, action }) => {
      healthState.data = healthResponse(status);

      renderDashboard();

      const alert = screen.getByTestId("alert-telegram-webhook-drift");
      expect(alert).toBeVisible();
      expect(alert).toHaveTextContent(title);
      expect(alert).toHaveTextContent(action);
      expect(alert).toHaveTextContent("Restore webhook");
      expect(alert).toHaveTextContent("Refresh status");
      expect(document.body).not.toHaveTextContent(BOT_TOKEN);
      expect(document.body).not.toHaveTextContent(WEBHOOK_SECRET);
    },
  );

  it.each(["matching", "unknown"] as const)(
    "does not render a warning for a $status health state",
    (status) => {
      healthState.data = healthResponse(status);

      renderDashboard();

      expect(
        screen.queryByTestId("alert-telegram-webhook-drift"),
      ).not.toBeInTheDocument();
      expect(document.body).not.toHaveTextContent(BOT_TOKEN);
      expect(document.body).not.toHaveTextContent(WEBHOOK_SECRET);
    },
  );
});