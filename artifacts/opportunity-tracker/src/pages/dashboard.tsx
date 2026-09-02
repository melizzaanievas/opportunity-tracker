import { useState } from "react";
import { Link } from "wouter";
import { differenceInCalendarDays, format } from "date-fns";
import {
  getGetDashboardStatsQueryKey,
  getListOpportunitiesQueryKey,
  useListOpportunities,
  useGetDashboardStats,
  useTestTelegramAlert,
  useUpdateOpportunity,
  type Opportunity,
  ListOpportunitiesStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowUpRight,
  Banknote,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Circle,
  Code,
  Columns3,
  ExternalLink,
  FileQuestion,
  Grid2X2,
  Loader2,
  Plus,
  Send,
} from "lucide-react";

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
  { value: "interviewing", label: "Interviewing" },
  { value: "completed", label: "Done"     },
];

type DashboardView = "grid" | "kanban" | "calendar";

const VIEW_MODES: {
  value: DashboardView;
  label: string;
  icon: typeof Grid2X2;
}[] = [
  { value: "grid", label: "Grid View", icon: Grid2X2 },
  { value: "kanban", label: "Kanban View", icon: Columns3 },
  { value: "calendar", label: "Calendar View", icon: CalendarDays },
];

const KANBAN_COLUMNS: {
  value: ListOpportunitiesStatus;
  label: string;
  accent: string;
}[] = [
  { value: "to-apply", label: "To Apply", accent: "kanban-lane-amber" },
  { value: "applied", label: "Applied", accent: "kanban-lane-blue" },
  { value: "interviewing", label: "Interviewing", accent: "kanban-lane-emerald" },
  { value: "completed", label: "Done", accent: "kanban-lane-slate" },
];

function formatDisplayDate(deadline: string) {
  const [year, month, day] = deadline.split("-").map(Number);
  return format(new Date(year, month - 1, day), "MMM d, yyyy");
}

export default function Dashboard() {
  const [statusFilter, setStatusFilter] = useState<ListOpportunitiesStatus | "all">("all");
  const [viewMode, setViewMode] = useState<DashboardView>("grid");
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<Opportunity | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: opportunities, isLoading: opsLoading } = useListOpportunities(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );
  const testTelegram = useTestTelegramAlert();
  const updateOpportunity = useUpdateOpportunity();

  const handleTestAlert = () => {
    testTelegram.mutate(undefined, {
      onSuccess: (data) => toast({ title: "Telegram Alert Sent", description: data.message || "Test message sent successfully." }),
      onError: ()       => toast({ title: "Failed to send",      description: "Please check your Telegram configuration.", variant: "destructive" }),
    });
  };

  const activeOpportunityCount = stats
    ? Math.max(0, stats.total - stats.byStatus.completed)
    : 0;

  const handleSetDeadline = (opportunityId: number, deadline: string) => {
    updateOpportunity.mutate(
      { id: opportunityId, data: { deadline } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListOpportunitiesQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetDashboardStatsQueryKey(),
          });
          toast({
            title: "Deadline added",
            description: "The opportunity is now on your calendar.",
          });
        },
        onError: () => {
          toast({
            title: "Could not save deadline",
            description: "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

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

  const renderOpportunityCard = (opp: Opportunity) => {
    const Icon = TYPE_ICONS[opp.type] || TYPE_ICONS.other;
    const statusConf = STATUS_CONFIG[opp.status] ?? STATUS_CONFIG["to-apply"];

    return (
      <article
        key={opp.id}
        className="dashboard-opportunity-card group relative flex min-h-64 flex-col overflow-hidden rounded-2xl"
        data-testid={`card-opportunity-${opp.id}`}
      >
        <Link
          href={`/opportunity/${opp.id}`}
          className="absolute inset-0 z-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          aria-label={`View details for ${opp.title}`}
          data-testid={`link-opportunity-${opp.id}`}
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
            <div className="pointer-events-auto">{renderDeadlineBadge(opp.deadline)}</div>
          </div>

          <Link
            href={`/opportunity/${opp.id}`}
            className="dashboard-card-title pointer-events-auto mt-6 line-clamp-2 hover:underline"
            data-testid={`link-opportunity-title-${opp.id}`}
          >
            {opp.title}
          </Link>

          {opp.summary && (
            <p className="dashboard-card-copy mt-3 line-clamp-2">{opp.summary}</p>
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
                data-testid={`link-external-opportunity-${opp.id}`}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </article>
    );
  };

  const renderKanbanView = () => (
    <div className="dashboard-kanban-grid">
      {KANBAN_COLUMNS.map((column) => {
        const laneOpportunities = opportunities?.filter(
          (opportunity) => opportunity.status === column.value,
        ) ?? [];

        return (
          <section
            className={`dashboard-kanban-lane ${column.accent}`}
            key={column.value}
            aria-label={`${column.label} opportunities`}
          >
            <div className="dashboard-kanban-lane-header">
              <div>
                <p className="dashboard-kanban-lane-label">{column.label}</p>
                <span className="dashboard-kanban-lane-count">
                  {laneOpportunities.length} {laneOpportunities.length === 1 ? "item" : "items"}
                </span>
              </div>
              <span className="dashboard-kanban-lane-dot" aria-hidden="true" />
            </div>
            <div className="dashboard-kanban-lane-content">
              {laneOpportunities.length > 0 ? (
                laneOpportunities.map(renderOpportunityCard)
              ) : (
                <div className="dashboard-kanban-empty">No opportunities here</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );

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
            <h1 className="m-0 font-sans text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Melizza&apos;s Workspace
            </h1>
            <p className="mt-2 text-sm font-medium tracking-wide text-slate-200 sm:text-base">
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

        <div className="flex justify-end">
          <div
            className="dashboard-view-toggle"
            role="tablist"
            aria-label="Choose dashboard view"
          >
            {VIEW_MODES.map(({ value, label, icon: Icon }) => {
              const active = viewMode === value;

              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`dashboard-view-${value}`}
                  className={`dashboard-view-button ${active ? "is-active" : ""}`}
                  onClick={() => setViewMode(value)}
                  data-testid={`button-view-${value}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

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
            <div className={`dashboard-stat-card dashboard-stat-card-warm ${stats.closingSoon > 0 ? "is-alert" : "is-zero"}`}>
              <div className="dashboard-stat-heading">
                <span className="dashboard-stat-label">Closing soon</span>
                {stats.closingSoon > 0 && (
                  <span className="dashboard-stat-accent-badge dashboard-stat-accent-badge-amber">Attention</span>
                )}
              </div>
              <strong className="dashboard-stat-value">{stats.closingSoon}</strong>
              <span className="dashboard-stat-note">Needs attention this week</span>
            </div>
            <div className="dashboard-stat-card dashboard-stat-card-indigo">
              <div className="dashboard-stat-heading">
                <span className="dashboard-stat-label">To apply</span>
                <span className="dashboard-stat-accent-badge dashboard-stat-accent-badge-indigo">Focus</span>
              </div>
              <strong className="dashboard-stat-value">{stats.byStatus["to-apply"]}</strong>
              <span className="dashboard-stat-note">Ready for your next move</span>
            </div>
            <div className="dashboard-stat-card dashboard-stat-card-emerald">
              <div className="dashboard-stat-heading">
                <span className="dashboard-stat-label">Interviewing</span>
                <span className="dashboard-stat-accent-badge dashboard-stat-accent-badge-emerald">In motion</span>
              </div>
              <strong className="dashboard-stat-value">{stats.byStatus.interviewing}</strong>
              <span className="dashboard-stat-note">Keep the momentum going</span>
            </div>
          </div>
        ) : null}

        <section className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="dashboard-section-kicker">Your pipeline</p>
              <h2 className="dashboard-section-title">
                {viewMode === "calendar"
                  ? "Deadlines in view"
                  : viewMode === "kanban"
                    ? "Pipeline by stage"
                    : "Opportunities in motion"}
              </h2>
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
                    data-testid={`button-filter-${value}`}
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
          ) : viewMode === "calendar" ? (
            <div id="dashboard-view-calendar">
              <DashboardCalendar
                opportunities={opportunities ?? []}
                onOpenOpportunity={setSelectedOpportunity}
                onSetDeadline={handleSetDeadline}
                isSavingDeadline={updateOpportunity.isPending}
              />
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
          ) : viewMode === "kanban" ? (
            <div id="dashboard-view-kanban">{renderKanbanView()}</div>
          ) : (
            <div id="dashboard-view-grid" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {opportunities?.map(renderOpportunityCard)}
            </div>
          )}
        </section>
      </div>

      <Dialog
        open={!!selectedOpportunity}
        onOpenChange={(open) => {
          if (!open) setSelectedOpportunity(null);
        }}
      >
        <DialogContent className="dashboard-opportunity-dialog sm:max-w-[480px]">
          {selectedOpportunity ? (
            <>
              <DialogHeader>
                <p className="dashboard-section-kicker">
                  {selectedOpportunity.type}
                </p>
                <DialogTitle className="dashboard-dialog-title">
                  {selectedOpportunity.title}
                </DialogTitle>
                <DialogDescription className="dashboard-dialog-description">
                  {selectedOpportunity.company || "Saved opportunity"}
                </DialogDescription>
              </DialogHeader>

              <div className="dashboard-dialog-body">
                <div className="dashboard-dialog-meta">
                  <span className={`dashboard-status-badge ${STATUS_CONFIG[selectedOpportunity.status]?.badgeClass ?? ""}`}>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          STATUS_CONFIG[selectedOpportunity.status]?.dot ?? "#6366f1",
                      }}
                    />
                    {STATUS_CONFIG[selectedOpportunity.status]?.label ?? selectedOpportunity.status}
                  </span>
                  {selectedOpportunity.deadline ? (
                    <span className="dashboard-dialog-deadline">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDisplayDate(selectedOpportunity.deadline)}
                    </span>
                  ) : null}
                </div>
                {selectedOpportunity.summary ? (
                  <p className="dashboard-dialog-summary">{selectedOpportunity.summary}</p>
                ) : (
                  <p className="dashboard-dialog-summary is-muted">
                    No summary has been added for this opportunity yet.
                  </p>
                )}
              </div>

              <DialogFooter className="dashboard-dialog-footer">
                <a
                  href={selectedOpportunity.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dashboard-secondary-button"
                  data-testid={`link-dialog-external-${selectedOpportunity.id}`}
                >
                  <ExternalLink className="h-4 w-4" />
                  View Posting
                </a>
                <Link
                  href={`/opportunity/${selectedOpportunity.id}`}
                  className="dashboard-add-button"
                  onClick={() => setSelectedOpportunity(null)}
                  data-testid={`link-dialog-details-${selectedOpportunity.id}`}
                >
                  Open Details
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
