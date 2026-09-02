import { useState } from "react";
import { Link } from "wouter";
import { differenceInCalendarDays } from "date-fns";
import {
  useListOpportunities,
  useGetDashboardStats,
  useTestTelegramAlert,
  ListOpportunitiesStatus,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  ArrowUpRight,
  Banknote,
  Briefcase,
  CheckCircle2,
  Circle,
  Code,
  ExternalLink,
  FileQuestion,
  Loader2,
  Plus,
  Send,
} from "lucide-react";

const serif = "'Cormorant Garamond', Georgia, serif";
const sans = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

const TYPE_ICONS = {
  job: Briefcase,
  grant: Banknote,
  hackathon: Code,
  other: FileQuestion,
};

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; badgeClass: string }
> = {
  "to-apply": {
    label: "To Apply",
    dot: "#d97706",
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200",
  },
  applied: {
    label: "Applied",
    dot: "#059669",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200",
  },
  interviewing: {
    label: "Interviewing",
    dot: "#4f46e5",
    badgeClass:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-200",
  },
  completed: {
    label: "Completed",
    dot: "#0f766e",
    badgeClass:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-200",
  },
};

const FILTERS: { value: ListOpportunitiesStatus | "all"; label: string }[] = [
  { value: "all",       label: "All"      },
  { value: "to-apply",  label: "To Apply" },
  { value: "applied",   label: "Applied"  },
  { value: "completed", label: "Done"     },
];

export default function Dashboard() {
  const [statusFilter, setStatusFilter] = useState<ListOpportunitiesStatus | "all">("all");
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: opportunities, isLoading: opsLoading } = useListOpportunities(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );
  const testTelegram = useTestTelegramAlert();

  const handleTestAlert = () => {
    testTelegram.mutate(undefined, {
      onSuccess: (data) => toast({ title: "Telegram Alert Sent", description: data.message || "Test message sent successfully." }),
      onError: ()       => toast({ title: "Failed to send",      description: "Please check your Telegram configuration.", variant: "destructive" }),
    });
  };

  const activeOpportunityCount = stats
    ? Math.max(0, stats.total - stats.byStatus.completed)
    : 0;

  const renderDeadlineBadge = (deadline: string | null | undefined) => {
    if (!deadline) return null;
    const date = new Date(deadline);
    const days = differenceInCalendarDays(date, new Date());
    const baseClass =
      "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide";

    if (days < 0) {
      return (
        <span className={`${baseClass} border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200`}>
          Past due
        </span>
      );
    }

    if (days === 0) {
      return (
        <span className={`${baseClass} border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200`}>
          Due today
        </span>
      );
    }

    if (days <= 3) {
      return (
        <span className={`${baseClass} border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-200`}>
          {days}d left
        </span>
      );
    }

    if (days <= 7) {
      return (
        <span className={`${baseClass} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200`}>
          {days}d left
        </span>
      );
    }

    return (
      <span className={`${baseClass} border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300`}>
        {days}d left
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-8 pb-12">
        <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="dashboard-eyebrow">Opportunity Tracker</span>
              <span className="dashboard-active-pill">
                <Circle className="h-2.5 w-2.5 fill-current" />
                {statsLoading ? "Loading active total" : `${activeOpportunityCount} active`}
              </span>
            </div>
            <h1
              className="m-0 text-4xl font-bold tracking-tight sm:text-5xl"
              style={{ fontFamily: serif }}
            >
              Melizza&apos;s Workspace
            </h1>
            <p className="mt-2 text-sm font-medium tracking-wide text-slate-200/85 sm:text-base">
              Active Pipeline &amp; Opportunities
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/add" className="dashboard-add-button">
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add Opportunity
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <button
              onClick={handleTestAlert}
              disabled={testTelegram.isPending}
              className="dashboard-secondary-button"
            >
              {testTelegram.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Test Alert
            </button>
          </div>
        </section>

        {statsLoading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="dashboard-stat-card h-28 animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="dashboard-stat-card">
              <span className="dashboard-stat-label">Total tracked</span>
              <strong className="dashboard-stat-value">{stats.total}</strong>
              <span className="dashboard-stat-note">Across every stage</span>
            </div>
            <div className="dashboard-stat-card dashboard-stat-card-warm">
              <AlertCircle className="dashboard-stat-watermark" />
              <span className="dashboard-stat-label">Closing soon</span>
              <strong className="dashboard-stat-value">{stats.closingSoon}</strong>
              <span className="dashboard-stat-note">Needs attention this week</span>
            </div>
            <div className="dashboard-stat-card dashboard-stat-card-indigo">
              <span className="dashboard-stat-label">To apply</span>
              <strong className="dashboard-stat-value">{stats.byStatus["to-apply"]}</strong>
              <span className="dashboard-stat-note">Ready for your next move</span>
            </div>
            <div className="dashboard-stat-card dashboard-stat-card-green">
              <span className="dashboard-stat-label">Completed</span>
              <strong className="dashboard-stat-value">{stats.byStatus.completed}</strong>
              <span className="dashboard-stat-note">Closed out successfully</span>
            </div>
          </div>
        ) : null}

        <section className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="dashboard-section-kicker">Your pipeline</p>
              <h2 className="dashboard-section-title">Opportunities in motion</h2>
            </div>
            <div className="dashboard-filter-bar" role="tablist" aria-label="Filter opportunities by status">
              {FILTERS.map(({ value, label }) => {
                const active = statusFilter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setStatusFilter(value)}
                    className={`dashboard-filter-button ${active ? "is-active" : ""}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {opsLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="dashboard-opportunity-card h-64 animate-pulse" />
              ))}
            </div>
          ) : opportunities?.length === 0 ? (
            <div className="dashboard-empty-state">
              <div className="dashboard-empty-icon">
                <Briefcase className="h-8 w-8" />
              </div>
              <p className="dashboard-section-kicker">Nothing here yet</p>
              <h3 className="dashboard-section-title">No opportunities found</h3>
              <p className="dashboard-empty-copy">
                You haven&apos;t tracked anything in this category yet. Add the next possibility to your pipeline.
              </p>
              <Link href="/add" className="dashboard-add-button">
                <Plus className="h-4 w-4" />
                Add Opportunity
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {opportunities?.map((opp) => {
                const Icon = TYPE_ICONS[opp.type] || TYPE_ICONS.other;
                const statusConf = STATUS_CONFIG[opp.status] ?? STATUS_CONFIG["to-apply"];

                return (
                  <article key={opp.id} className="dashboard-opportunity-card group relative flex min-h-64 flex-col overflow-hidden rounded-2xl">
                    <Link
                      href={`/opportunity/${opp.id}`}
                      className="absolute inset-0 z-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                      aria-label={`View details for ${opp.title}`}
                    >
                      <span className="sr-only">View opportunity details</span>
                    </Link>

                    <div className="relative z-10 flex flex-1 flex-col p-5 pointer-events-none">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="dashboard-type-icon">
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="dashboard-type-label">{opp.type}</span>
                        </div>
                        <div className="pointer-events-auto">
                          {renderDeadlineBadge(opp.deadline)}
                        </div>
                      </div>

                      <Link
                        href={`/opportunity/${opp.id}`}
                        className="dashboard-card-title pointer-events-auto mt-6 line-clamp-2 hover:underline"
                      >
                        {opp.title}
                      </Link>

                      {opp.summary && (
                        <p className="dashboard-card-copy mt-3 line-clamp-2">
                          {opp.summary}
                        </p>
                      )}

                      <div className="mt-auto flex items-end justify-between gap-3 pt-6">
                        <span className={`dashboard-status-badge ${statusConf.badgeClass}`}>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusConf.dot }} />
                          {statusConf.label}
                        </span>

                        <div className="flex items-center gap-3">
                          {opp.taskCount !== undefined && opp.taskCount > 0 && (
                            <span className="dashboard-task-count">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {opp.completedTaskCount || 0}/{opp.taskCount}
                            </span>
                          )}
                          <a
                            href={opp.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dashboard-external-link pointer-events-auto"
                            aria-label={`Open saved link for ${opp.title}`}
                            title="Open saved link"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
