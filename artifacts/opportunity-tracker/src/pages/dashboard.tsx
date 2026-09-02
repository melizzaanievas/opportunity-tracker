import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { differenceInCalendarDays, format } from "date-fns";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
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
  BarChart3,
  Banknote,
  Briefcase,
  CalendarDays,
  Clapperboard,
  CheckCircle2,
  Circle,
  Columns3,
  ExternalLink,
  FileQuestion,
  Grid2X2,
  Loader2,
  MapPin,
  Mic2,
  Plus,
  Send,
  GraduationCap,
  Sparkles,
} from "lucide-react";

const TYPE_ICONS = {
  job: Briefcase,
  grant: Banknote,
  casting: Clapperboard,
  "singing-competition": Mic2,
  "grant-fellowship": GraduationCap,
  other: FileQuestion,
};

const CATEGORY_OPTIONS = [
  { value: "job", types: ["job"], label: "Jobs", singularLabel: "Job", icon: Briefcase },
  {
    value: "grants-and-fellowships",
    types: ["grant", "grant-fellowship"],
    label: "Grants & Fellowships",
    singularLabel: "Grant / Fellowship",
    icon: Banknote,
  },
  { value: "casting", types: ["casting"], label: "Casting", singularLabel: "Casting", icon: Clapperboard },
  {
    value: "singing-competition",
    types: ["singing-competition"],
    label: "Singing Competitions",
    singularLabel: "Singing Competition",
    icon: Mic2,
  },
  { value: "other", types: ["other"], label: "Other", singularLabel: "Other", icon: FileQuestion },
] as const;

const CATEGORY_LABELS = Object.fromEntries(
  CATEGORY_OPTIONS.flatMap((category) =>
    category.types.map((type) => [type, category.singularLabel]),
  ),
) as Record<Opportunity["type"], string>;

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
    label: "Applied / Pending Response",
    dot: "#2563eb",
    badgeClass:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-200",
  },
  interviewing: {
    label: "Interviewing",
    dot: "#4f46e5",
    badgeClass:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-200",
  },
  offered: {
    label: "Offered",
    dot: "#9333ea",
    badgeClass:
      "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-400/30 dark:bg-purple-400/10 dark:text-purple-200",
  },
  archived: {
    label: "Archived",
    dot: "#64748b",
    badgeClass:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/30 dark:bg-slate-400/10 dark:text-slate-200",
  },
};

const BREAKDOWN_STAGES = [
  { label: "To Apply", statuses: ["to-apply"] },
  { label: "Applied / Pending Response", statuses: ["applied"] },
  { label: "Interviewing / Shortlisted", statuses: ["interviewing"] },
  {
    label: "Completed",
    statuses: ["offered", "archived"],
    description: "Offered or archived",
  },
] as const;

const FILTERS: { value: ListOpportunitiesStatus | "all"; label: string }[] = [
  { value: "all",       label: "All"      },
  { value: "to-apply",  label: "To Apply" },
  { value: "applied",   label: "Applied / Pending Response" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offered", label: "Offered" },
  { value: "archived", label: "Archived" },
];

type DashboardView = "grid" | "kanban" | "calendar" | "analytics";
type DashboardCategoryFilter =
  | (typeof CATEGORY_OPTIONS)[number]["value"]
  | "all";
type DashboardSummaryFilter =
  | "total"
  | "closing-soon"
  | "to-apply"
  | "interviewing"
  | "none";

const VIEW_MODES: {
  value: DashboardView;
  label: string;
  icon: typeof Grid2X2;
}[] = [
  { value: "grid", label: "Grid", icon: Grid2X2 },
  { value: "kanban", label: "Kanban", icon: Columns3 },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
  { value: "analytics", label: "Analytics", icon: BarChart3 },
];

const KANBAN_COLUMNS: {
  value: ListOpportunitiesStatus;
  label: string;
  accent: string;
}[] = [
  { value: "to-apply", label: "To Apply", accent: "kanban-lane-amber" },
  { value: "applied", label: "Applied / Pending Response", accent: "kanban-lane-blue" },
  { value: "interviewing", label: "Interviewing", accent: "kanban-lane-emerald" },
  { value: "offered", label: "Offered", accent: "kanban-lane-purple" },
  { value: "archived", label: "Archived", accent: "kanban-lane-slate" },
];

function formatDisplayDate(deadline: string) {
  const [year, month, day] = deadline.split("-").map(Number);
  return format(new Date(year, month - 1, day), "MMM d, yyyy");
}

const DASHBOARD_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const FALLBACK_QUOTES = [
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
  },
  {
    text: "Success is where preparation and opportunity meet.",
    author: "Seneca",
  },
  {
    text: "Great things are done by a series of small things brought together.",
    author: "Vincent van Gogh",
  },
  {
    text: "Start where you are. Use what you have. Do what you can.",
    author: "Arthur Ashe",
  },
  {
    text: "It always seems impossible until it is done.",
    author: "Nelson Mandela",
  },
] as const;

type DashboardQuote = {
  text: string;
  author: string;
};

function getDailyFallbackQuote(date: Date): DashboardQuote {
  const dayNumber = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
      (24 * 60 * 60 * 1000),
  );
  return FALLBACK_QUOTES[Math.abs(dayNumber) % FALLBACK_QUOTES.length];
}

function getDashboardGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning, Melizza";
  if (hour < 18) return "Good afternoon, Melizza";
  return "Good evening, Melizza";
}

function getBreakdownNumberClass(count: number) {
  return count === 0
    ? "text-slate-600"
    : "text-indigo-300 font-semibold";
}

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [quote, setQuote] = useState<DashboardQuote>(() =>
    getDailyFallbackQuote(new Date()),
  );
  const [statusFilter, setStatusFilter] = useState<ListOpportunitiesStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] =
    useState<DashboardCategoryFilter>("all");
  const [summaryFilter, setSummaryFilter] =
    useState<DashboardSummaryFilter>("total");
  const [viewMode, setViewMode] = useState<DashboardView>("grid");
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<Opportunity | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: allOpportunities, isLoading: allOpportunitiesLoading } =
    useListOpportunities();
  const apiCategoryFilter =
    categoryFilter === "all" || categoryFilter === "grants-and-fellowships"
      ? undefined
      : categoryFilter;
  const { data: fetchedOpportunities, isLoading: opsLoading } = useListOpportunities(
    statusFilter === "all" && !apiCategoryFilter
      ? undefined
      : {
          ...(statusFilter === "all" ? {} : { status: statusFilter }),
          ...(apiCategoryFilter ? { type: apiCategoryFilter } : {}),
        },
  );
  const testTelegram = useTestTelegramAlert();
  const updateOpportunity = useUpdateOpportunity();

  useEffect(() => {
    const clock = window.setInterval(() => setCurrentDate(new Date()), 60_000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch("https://zenquotes.io/api/today", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Quote request failed");
        return response.json() as Promise<Array<{ q?: string; a?: string }>>;
      })
      .then((data) => {
        const todayQuote = data[0];
        if (todayQuote?.q?.trim() && todayQuote.a?.trim()) {
          setQuote({ text: todayQuote.q.trim(), author: todayQuote.a.trim() });
        }
      })
      .catch(() => {
        // The local quote is intentionally retained when the public API is unavailable.
      });

    return () => controller.abort();
  }, []);

  const opportunities = useMemo(() => {
    const source = fetchedOpportunities ?? [];
    const category = CATEGORY_OPTIONS.find(
      (option) => option.value === categoryFilter,
    );
    const categoryFiltered =
      categoryFilter === "all" || !category
        ? source
        : source.filter((opportunity) =>
            (category.types as readonly string[]).includes(opportunity.type),
          );

    if (summaryFilter !== "closing-soon") return categoryFiltered;
    return categoryFiltered.filter((opportunity) => {
      if (!opportunity.deadline) return false;
      const [year, month, day] = opportunity.deadline.split("-").map(Number);
      const deadlineDate = new Date(year, month - 1, day);
      return differenceInCalendarDays(deadlineDate, new Date()) <= 7;
    });
  }, [categoryFilter, fetchedOpportunities, summaryFilter]);

  const breakdownRows = useMemo(() => {
    const source = allOpportunities ?? [];
    return CATEGORY_OPTIONS.map((category) => ({
      ...category,
      counts: BREAKDOWN_STAGES.map((stage) =>
        source.filter(
          (opportunity) =>
            (category.types as readonly string[]).includes(opportunity.type) &&
            (stage.statuses as readonly string[]).includes(opportunity.status),
        ).length,
      ),
      total: source.filter((opportunity) =>
        (category.types as readonly string[]).includes(opportunity.type),
      ).length,
    }));
  }, [allOpportunities]);

  const analyticsRows = useMemo(() => {
    if (categoryFilter === "all") return breakdownRows;
    return breakdownRows.filter((row) => row.value === categoryFilter);
  }, [breakdownRows, categoryFilter]);

  const handleTestAlert = () => {
    testTelegram.mutate(undefined, {
      onSuccess: (data) => toast({ title: "Telegram Alert Sent", description: data.message || "Test message sent successfully." }),
      onError: ()       => toast({ title: "Failed to send",      description: "Please check your Telegram configuration.", variant: "destructive" }),
    });
  };

  const activeOpportunityCount = stats
    ? Math.max(0, stats.total - stats.byStatus.archived)
    : 0;

  const handleTakeTour = () => {
    const tourSteps = [
      {
        element: '[data-tour="add-btn"]',
        popover: {
          title: "Add an opportunity",
          description:
            "Save a job, grant, casting call, or competition here so it stays visible in your pipeline.",
          side: "bottom" as const,
          align: "end" as const,
        },
      },
      {
        element: '[data-tour="metrics"]',
        popover: {
          title: "Your quick metrics",
          description:
            "Use these totals as shortcuts. Select a metric to filter the pipeline by deadlines or stage.",
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: '[data-tour="view-switcher"]',
        popover: {
          title: "Switch views",
          description:
            "Move between Grid, Kanban, Calendar, and Analytics to see your opportunities in the format that fits the task.",
          side: "bottom" as const,
          align: "end" as const,
        },
      },
      {
        element: '[data-tour="filters"]',
        popover: {
          title: "Filter by stage",
          description:
            "Narrow the pipeline to All, To Apply, Applied, Interviewing, Offered, or Archived opportunities.",
          side: "bottom" as const,
          align: "start" as const,
        },
      },
      {
        element: '[data-tour="card"]',
        popover: {
          title: "Your opportunity cards",
          description:
            "Review each opportunity's deadline and status, track Action Plan items, and open the saved posting or full details.",
          side: "top" as const,
          align: "start" as const,
        },
      },
    ].filter(({ element }) => document.querySelector(element));

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      popoverClass: "dashboard-tour-popover",
      steps: tourSteps,
    });

    driverObj.drive();
  };

  const handleSummaryFilter = (
    filter: Exclude<DashboardSummaryFilter, "none">,
  ) => {
    if (filter === "total") {
      setStatusFilter("all");
      setCategoryFilter("all");
      setSummaryFilter("total");
      return;
    }

    if (filter === "closing-soon") {
      setStatusFilter("all");
      setCategoryFilter("all");
      setSummaryFilter("closing-soon");
      return;
    }

    setStatusFilter(filter);
    setSummaryFilter(filter);
  };

  const handleStatusFilter = (filter: ListOpportunitiesStatus | "all") => {
    setStatusFilter(filter);
    setSummaryFilter(filter === "all" ? "total" : "none");
  };

  const handleCategoryFilter = (filter: DashboardCategoryFilter) => {
    setCategoryFilter(filter);
    setSummaryFilter("none");
  };

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

  const renderOpportunityCard = (opp: Opportunity) => {
    const Icon = TYPE_ICONS[opp.type] || TYPE_ICONS.other;
    const statusConf = STATUS_CONFIG[opp.status] ?? STATUS_CONFIG["to-apply"];

    return (
      <article
        key={opp.id}
        className="dashboard-opportunity-card group relative flex min-h-64 flex-col overflow-hidden rounded-2xl"
        data-testid={`card-opportunity-${opp.id}`}
        data-tour={opp.id === opportunities?.[0]?.id ? "card" : undefined}
      >
        <Link
          href={`/opportunity/${opp.id}`}
          className="absolute inset-0 z-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          aria-label={`View details for ${opp.title}`}
          data-testid={`link-opportunity-${opp.id}`}
        >
          <span className="sr-only">View opportunity details</span>
        </Link>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-3 p-5 pointer-events-none">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="dashboard-primary-category-badge">
              <Icon className="h-4 w-4" />
              <span>{CATEGORY_LABELS[opp.type]}</span>
            </div>
          </div>

          <Link
            href={`/opportunity/${opp.id}`}
            className="dashboard-card-title pointer-events-auto line-clamp-2 text-base font-semibold text-slate-100 hover:underline"
            data-testid={`link-opportunity-title-${opp.id}`}
          >
            {opp.title}
          </Link>

          <div className="dashboard-card-meta">
            <span className="dashboard-card-meta-pill text-xs text-slate-400 flex items-center gap-2 mt-2">
              <MapPin className="h-3.5 w-3.5" />
              Remote
            </span>
            {opp.deadline ? (
              <span className="dashboard-card-meta-pill text-xs text-slate-400 flex items-center gap-2 mt-2">
                <CalendarDays className="h-3.5 w-3.5" />
                Deadline: {formatDisplayDate(opp.deadline)}
              </span>
            ) : null}
          </div>

          <p className="dashboard-card-copy line-clamp-2">
            {opp.summary || ""}
          </p>

          <div className="dashboard-card-footer mt-auto flex items-end justify-between gap-3">
            <span className={`dashboard-status-badge ${statusConf.badgeClass}`}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusConf.dot }} />
              {statusConf.label}
            </span>

            <div className="dashboard-card-actions flex items-center gap-3">
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
                title="View Posting"
                data-testid={`link-external-opportunity-${opp.id}`}
              >
                <ExternalLink className="h-4 w-4" />
                <span>View Posting</span>
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

  const renderViewSwitcher = () => (
    <div
      className="dashboard-view-toggle"
      role="tablist"
      aria-label="Choose dashboard view"
      data-tour="view-switcher"
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
            className={`dashboard-view-button ${
              active
                ? "is-active bg-indigo-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => setViewMode(value)}
            data-testid={`button-view-${value}`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <AppLayout
      showAddOpportunity
      onTakeTour={handleTakeTour}
      headerActions={
        <button
          onClick={handleTestAlert}
          disabled={testTelegram.isPending}
          className="dashboard-ghost-icon-button"
          aria-label="Send test Telegram alert"
          title="Send test Telegram alert"
        >
          {testTelegram.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      }
    >
      <div className="space-y-8 pb-12">
        <section
          className="dashboard-date-quote-banner mb-4 flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/40 p-4"
          aria-labelledby="dashboard-welcome-title"
          data-testid="dashboard-date-quote-banner"
        >
          <div className="dashboard-date-quote-layout">
            <div className="dashboard-hero-left">
              <div className="dashboard-welcome-heading">
                <Sparkles className="h-5 w-5 shrink-0 text-indigo-300" aria-hidden="true" />
                <div className="min-w-0">
                  <h2
                    id="dashboard-welcome-title"
                    className="dashboard-hero-greeting text-xl font-semibold tracking-tight text-white"
                  >
                    {getDashboardGreeting(currentDate)}
                  </h2>
                  <time
                    className="dashboard-hero-date"
                    dateTime={currentDate.toISOString().slice(0, 10)}
                  >
                    {DASHBOARD_DATE_FORMATTER.format(currentDate)}
                  </time>
                  <div className="dashboard-hero-meta">
                    <span className="dashboard-active-pill">
                      <Circle className="h-2.5 w-2.5 fill-current" />
                      {statsLoading
                        ? "Loading active total"
                        : `${activeOpportunityCount} active`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="dashboard-quote-block">
              <p className="dashboard-quote-label">Today&apos;s motivation</p>
              <blockquote className="dashboard-quote-text text-sm font-medium text-slate-300 italic">
                “{quote.text}”
              </blockquote>
              <cite className="dashboard-quote-author text-indigo-400 font-medium">
                — {quote.author}
              </cite>
            </div>
          </div>
        </section>

        <div className="dashboard-main-view" key={viewMode}>
          <div className="dashboard-toolbar my-4">
            <div
              className="dashboard-stage-filters"
              role="tablist"
              aria-label="Filter opportunities by status"
              data-tour="filters"
            >
              {FILTERS.map(({ value, label }) => {
                const active = statusFilter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleStatusFilter(value)}
                    className={`dashboard-filter-button ${active ? "is-active" : ""}`}
                    data-testid={`button-filter-${value}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {renderViewSwitcher()}
          </div>

          {viewMode === "analytics" && (
            <>
              <div className="dashboard-analytics-heading">
                <div>
                  <h2
                    id="pipeline-analytics-title"
                    className="dashboard-pipeline-title text-xl font-semibold tracking-tight text-white"
                  >
                    Pipeline Analytics
                  </h2>
                  <p className="dashboard-pipeline-subtitle text-xs font-normal text-slate-400">
                    Category breakdown across stage pipelines.
                  </p>
                </div>
              </div>
              <section
                id="dashboard-view-analytics"
                className="dashboard-breakdown-section rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl"
                aria-labelledby="pipeline-analytics-title"
              >
                <div
                  className="dashboard-category-filter-row flex flex-wrap items-center gap-2"
                  role="toolbar"
                  aria-label="Filter analytics by category"
                >
                  <button
                    type="button"
                    className={`dashboard-category-filter ${
                      categoryFilter === "all"
                        ? "is-active bg-indigo-600 text-white"
                        : "bg-slate-800/60 text-slate-400 hover:text-white border border-slate-700/50"
                    }`}
                    onClick={() => handleCategoryFilter("all")}
                    aria-pressed={categoryFilter === "all"}
                    data-testid="button-category-filter-all"
                  >
                    All
                  </button>
                  {CATEGORY_OPTIONS.map(({ value, label, icon: Icon }) => {
                    const active = categoryFilter === value;
                    return (
                      <button
                        type="button"
                        className={`dashboard-category-filter ${
                          active
                            ? "is-active bg-indigo-600 text-white"
                            : "bg-slate-800/60 text-slate-400 hover:text-white border border-slate-700/50"
                        }`}
                        key={value}
                        onClick={() => handleCategoryFilter(value)}
                        aria-pressed={active}
                        data-testid={`button-category-filter-${value}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {value === "singing-competition" ? "Singing" : label}
                      </button>
                    );
                  })}
                </div>

              {allOpportunitiesLoading ? (
                <div className="dashboard-breakdown-loading" aria-label="Loading productivity breakdown">
                  <div />
                  <div />
                  <div />
                  <div />
                </div>
              ) : (
                <>
                  <table className="dashboard-breakdown-desktop-table hidden w-full md:table">
                    <thead>
                      <tr>
                        <th scope="col">Category</th>
                        {BREAKDOWN_STAGES.map((stage) => (
                          <th scope="col" key={stage.label} title={"description" in stage ? stage.description : ""}>
                            {stage.label}
                          </th>
                        ))}
                        <th scope="col">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsRows.map(({ value, label, icon: Icon, counts, total }) => (
                        <tr
                          className="dashboard-breakdown-row border-b border-slate-800/60 transition-colors hover:bg-slate-800/30"
                          key={value}
                        >
                          <th scope="row" className="dashboard-breakdown-category-cell">
                            <span className="dashboard-breakdown-category-name flex items-center gap-2 text-slate-200 font-medium">
                              <Icon className="h-4 w-4" />
                              <span>{label}</span>
                            </span>
                          </th>
                          {counts.map((count, index) => (
                            <td
                              className={`dashboard-breakdown-number ${getBreakdownNumberClass(count)}`}
                              key={`${value}-${BREAKDOWN_STAGES[index]?.label}`}
                              aria-label={`${count} ${label} opportunities in ${BREAKDOWN_STAGES[index]?.label}`}
                            >
                              {count}
                            </td>
                          ))}
                          <td
                            className={`dashboard-breakdown-total-cell ${getBreakdownNumberClass(total)}`}
                          >
                            {total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="dashboard-breakdown-mobile-cards block md:hidden">
                    {analyticsRows.map(({ value, label, icon: Icon, counts, total }) => {
                      const activeStageTotal = counts
                        .slice(0, 3)
                        .reduce((sum, count) => sum + count, 0);
                      const progressColors = [
                        "dashboard-progress-amber",
                        "dashboard-progress-blue",
                        "dashboard-progress-green",
                      ];
                      const progressLabels = ["To Apply", "Applied", "Interviewing"];

                      return (
                        <article
                          className="dashboard-breakdown-mobile-card bg-slate-900/70 border border-slate-800 rounded-xl p-4 mb-3"
                          key={value}
                        >
                          <div className="dashboard-breakdown-mobile-header">
                            <span className="dashboard-breakdown-mobile-title">
                              <Icon className="h-4 w-4" />
                              {label}
                            </span>
                            <span className="dashboard-breakdown-total-badge">{total}</span>
                          </div>
                          <div
                            className="dashboard-breakdown-progress"
                            role="img"
                            aria-label={`${counts[0]} To Apply, ${counts[1]} Applied, ${counts[2]} Interviewing`}
                          >
                            {counts.slice(0, 3).map((count, index) => (
                              <span
                                className={`dashboard-breakdown-progress-segment ${progressColors[index]} ${count === 0 ? "is-empty" : ""}`}
                                key={progressLabels[index]}
                                style={{
                                  width: `${activeStageTotal > 0 ? (count / activeStageTotal) * 100 : 33.333}%`,
                                }}
                              />
                            ))}
                          </div>
                          <div className="dashboard-breakdown-mobile-footer">
                            {counts.slice(0, 3).map((count, index) => (
                              <span key={progressLabels[index]}>
                                <strong className={getBreakdownNumberClass(count)}>{count}</strong>{" "}
                                {progressLabels[index]}
                                {index < 2 ? " •" : ""}
                              </span>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
              </section>
            </>
          )}

          {viewMode !== "analytics" && (
            <>
        {statsLoading ? (
          <div
            className="grid grid-cols-2 gap-3 my-4 md:grid-cols-4"
            data-tour="metrics"
          >
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="dashboard-stat-card h-[60px] animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div
            className="grid grid-cols-2 gap-3 my-4 md:grid-cols-4"
            data-tour="metrics"
          >
            <button
              type="button"
              className={`dashboard-stat-card cursor-pointer transition-all hover:border-indigo-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                summaryFilter === "total"
                  ? "is-active ring-2 ring-indigo-500 bg-slate-800/80"
                  : ""
              }`}
              onClick={() => handleSummaryFilter("total")}
              aria-pressed={summaryFilter === "total"}
              data-testid="button-summary-total"
            >
              <span className="dashboard-stat-label text-sm font-medium text-slate-300">Total Tracked</span>
              <strong className="dashboard-stat-value text-base font-semibold text-slate-100">{stats.total}</strong>
            </button>
            <button
              type="button"
              className={`dashboard-stat-card dashboard-stat-card-warm cursor-pointer transition-all hover:border-indigo-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                stats.closingSoon > 0 ? "is-alert" : "is-zero"
              } ${
                summaryFilter === "closing-soon"
                  ? "is-active ring-2 ring-indigo-500 bg-slate-800/80"
                  : ""
              }`}
              onClick={() => handleSummaryFilter("closing-soon")}
              aria-pressed={summaryFilter === "closing-soon"}
              data-testid="button-summary-closing-soon"
            >
              <span className="dashboard-stat-label text-sm font-medium text-slate-300">Closing Soon</span>
              <strong className="dashboard-stat-value text-base font-semibold text-slate-100">{stats.closingSoon}</strong>
            </button>
            <button
              type="button"
              className={`dashboard-stat-card dashboard-stat-card-indigo cursor-pointer transition-all hover:border-indigo-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                summaryFilter === "to-apply"
                  ? "is-active ring-2 ring-indigo-500 bg-slate-800/80"
                  : ""
              }`}
              onClick={() => handleSummaryFilter("to-apply")}
              aria-pressed={summaryFilter === "to-apply"}
              data-testid="button-summary-to-apply"
            >
              <span className="dashboard-stat-label text-sm font-medium text-slate-300">To Apply</span>
              <strong className="dashboard-stat-value text-base font-semibold text-slate-100">{stats.byStatus["to-apply"]}</strong>
            </button>
            <button
              type="button"
              className={`dashboard-stat-card dashboard-stat-card-emerald cursor-pointer transition-all hover:border-indigo-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                summaryFilter === "interviewing"
                  ? "is-active ring-2 ring-indigo-500 bg-slate-800/80"
                  : ""
              }`}
              onClick={() => handleSummaryFilter("interviewing")}
              aria-pressed={summaryFilter === "interviewing"}
              data-testid="button-summary-interviewing"
            >
              <span className="dashboard-stat-label text-sm font-medium text-slate-300">Interviewing</span>
              <strong className="dashboard-stat-value text-base font-semibold text-slate-100">{stats.byStatus.interviewing}</strong>
            </button>
          </div>
        ) : null}

        <section className="space-y-4">
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
            </>
          )}
        </div>
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
