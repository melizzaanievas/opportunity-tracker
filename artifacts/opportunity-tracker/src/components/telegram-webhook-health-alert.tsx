import {
  getHealthCheckQueryKey,
  useRegisterTelegramWebhook,
  useHealthCheck,
} from "@workspace/api-client-react";
import { AlertTriangle, Check, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

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

function getAction(status: string, registrationFailed: boolean): string {
  if (registrationFailed) {
    return "The last registration attempt failed. Restore the configured Telegram webhook and review the result below.";
  }

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
  const [dismissed, setDismissed] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const { toast } = useToast();
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
  const registerWebhook = useRegisterTelegramWebhook();

  const liveStatus = data?.telegramWebhook.liveStatus;
  const registrationFailed = data?.telegramWebhook.status === "failed";
  if (
    dismissed ||
    isError ||
    !liveStatus ||
    (!DRIFT_STATUSES.has(liveStatus) && !registrationFailed)
  ) {
    return null;
  }

  const description =
    data.telegramWebhook.liveDescription ?? data.telegramWebhook.description;

  const handleRestore = async () => {
    setRecoveryMessage(null);

    try {
      await registerWebhook.mutateAsync();
      const refreshed = await refetch();
      const refreshedStatus = refreshed.data?.telegramWebhook.liveStatus;

      if (refreshedStatus === "matching") {
        toast({
          title: "Telegram webhook restored",
          description: "Telegram is using the configured webhook again.",
        });
        return;
      }

      setRecoveryMessage(
        "The webhook was re-registered, but Telegram's live status still needs attention.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.replace(/^HTTP \d+ [^:]+:\s*/, "")
          : "Telegram webhook registration failed.";
      setRecoveryMessage(message);
      toast({
        title: "Webhook restore failed",
        description: message,
        variant: "destructive",
      });
      await refetch();
    }
  };

  return (
    <Alert
      className="dashboard-webhook-alert"
      data-testid="alert-telegram-webhook-drift"
    >
      <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      <div>
        <AlertTitle>
          {registrationFailed
            ? "Telegram webhook registration failed"
            : `Telegram webhook is ${getStatusLabel(liveStatus)}`}
        </AlertTitle>
        <AlertDescription>
          <p>{getAction(liveStatus, registrationFailed)}</p>
          {description ? (
            <p className="dashboard-webhook-alert-details">
              {description}
            </p>
          ) : null}
          {recoveryMessage ? (
            <p
              className="dashboard-webhook-alert-recovery-message"
              data-testid="telegram-webhook-recovery-message"
              role="status"
            >
              {recoveryMessage}
            </p>
          ) : null}
          <div className="dashboard-webhook-alert-actions">
            <button
              type="button"
              className="dashboard-webhook-alert-refresh dashboard-webhook-alert-restore"
              onClick={() => void handleRestore()}
              disabled={registerWebhook.isPending || isFetching}
              data-testid="button-restore-telegram-webhook"
            >
              {registerWebhook.isPending ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {registerWebhook.isPending ? "Restoring…" : "Restore webhook"}
            </button>
            <button
              type="button"
              className="dashboard-webhook-alert-refresh"
              onClick={() => {
                setRecoveryMessage(null);
                void refetch();
              }}
              disabled={isFetching || registerWebhook.isPending}
              data-testid="button-refresh-telegram-webhook-health"
            >
              {isFetching ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {isFetching ? "Refreshing…" : "Refresh status"}
            </button>
          </div>
        </AlertDescription>
      </div>
      <button
        type="button"
        className="dashboard-webhook-alert-close"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss Telegram webhook alert"
        title="Dismiss alert"
        data-testid="button-dismiss-telegram-webhook-health"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </Alert>
  );
}