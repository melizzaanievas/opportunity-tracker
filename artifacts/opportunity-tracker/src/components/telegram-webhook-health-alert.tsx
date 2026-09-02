import {
  getHealthCheckQueryKey,
  useHealthCheck,
} from "@workspace/api-client-react";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

const DRIFT_STATUSES = new Set([
  "out_of_band",
  "stale",
  "unavailable",
]);

function getStatusLabel(status: string): string {
  switch (status) {
    case "out_of_band":
      return "out of band";
    case "stale":
      return "stale";
    case "unavailable":
      return "unavailable";
    default:
      return status;
  }
}

function getAction(status: string): string {
  switch (status) {
    case "out_of_band":
      return "Review the Telegram webhook URL and allowed updates, then re-register the app webhook.";
    case "stale":
      return "Re-register the Telegram webhook and confirm that Telegram is delivering updates again.";
    case "unavailable":
      return "Check Telegram API availability and the app's Telegram configuration, then refresh this check.";
    default:
      return "Refresh this check after reviewing the Telegram configuration.";
  }
}

export function TelegramWebhookHealthAlert() {
  const { data, isError, isFetching, refetch } = useHealthCheck(
    { refresh: true },
    {
      query: {
        queryKey: getHealthCheckQueryKey({ refresh: true }),
        refetchInterval: 5 * 60 * 1000,
        staleTime: 60 * 1000,
        retry: 1,
      },
    },
  );

  const liveStatus = data?.telegramWebhook.liveStatus;
  if (isError || !liveStatus || !DRIFT_STATUSES.has(liveStatus)) {
    return null;
  }

  const description = data.telegramWebhook.liveDescription;

  return (
    <Alert
      className="dashboard-webhook-alert"
      data-testid="alert-telegram-webhook-drift"
    >
      <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      <div>
        <AlertTitle>
          Telegram webhook is {getStatusLabel(liveStatus)}
        </AlertTitle>
        <AlertDescription>
          <p>{getAction(liveStatus)}</p>
          {description ? (
            <p className="dashboard-webhook-alert-details">
              {description}
            </p>
          ) : null}
          <button
            type="button"
            className="dashboard-webhook-alert-refresh"
            onClick={() => void refetch()}
            disabled={isFetching}
            data-testid="button-refresh-telegram-webhook-health"
          >
            {isFetching ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {isFetching ? "Refreshing…" : "Refresh status"}
          </button>
        </AlertDescription>
      </div>
    </Alert>
  );
}