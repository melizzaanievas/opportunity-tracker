import { useState } from "react";
import { Link } from "wouter";
import { differenceInDays, isPast } from "date-fns";
import { 
  useListOpportunities, 
  useGetDashboardStats, 
  useTestTelegramAlert,
  ListOpportunitiesStatus
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Briefcase, 
  Banknote, 
  Code, 
  FileQuestion,
  CheckCircle2,
  Send,
  Loader2,
  AlertCircle
} from "lucide-react";

const TYPE_ICONS = {
  job: Briefcase,
  grant: Banknote,
  hackathon: Code,
  other: FileQuestion,
};

const STATUS_CONFIG = {
  "to-apply": { label: "To Apply", dot: "#818cf8" },
  applied:    { label: "Applied",   dot: "#c084fc" },
  completed:  { label: "Completed", dot: "#34d399" },
};

/* ── glass helpers ── */
const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(230,220,255,0.22)",
  borderRadius: "16px",
  boxShadow: "0 8px 32px rgba(12,10,28,0.3)",
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
      onSuccess: (data) => {
        toast({ title: "Telegram Alert Sent", description: data.message || "Test message sent successfully." });
      },
      onError: () => {
        toast({ title: "Failed to send", description: "Please check your Telegram configuration.", variant: "destructive" });
      }
    });
  };

  const renderDeadlineBadge = (deadline: string | null | undefined) => {
    if (!deadline) return null;
    const date = new Date(deadline);
    const days = differenceInDays(date, new Date());
    if (isPast(date) && days < 0)
      return <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(239,68,68,0.2)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.35)" }}>Past due</span>;
    if (days <= 3)
      return <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}>{days}d left</span>;
    if (days <= 7)
      return <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(251,191,36,0.12)", color: "#fcd34d", border: "1px solid rgba(251,191,36,0.3)" }}>{days}d left</span>;
    return <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "#a8a0be", border: "1px solid rgba(230,220,255,0.18)" }}>{days}d left</span>;
  };

  return (
    <AppLayout>
      <div className="space-y-8 pb-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-serif font-bold" style={{ color: "#f4effa", textShadow: "0 0 20px rgba(220,200,255,0.25)" }}>
              Dashboard
            </h1>
            <p className="mt-1 text-sm" style={{ color: "#dcd6e8" }}>Your command center for opportunities.</p>
          </div>
          <button
            onClick={handleTestAlert}
            disabled={testTelegram.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 self-start sm:self-auto"
            style={{
              background: "linear-gradient(135deg, rgba(124,108,155,0.35), rgba(41,41,82,0.55))",
              border: "1px solid rgba(243,229,171,0.5)",
              color: "#f3e5ab",
              boxShadow: "0 0 10px rgba(243,229,171,0.18)",
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "1rem",
              letterSpacing: "0.04em",
            }}
          >
            {testTelegram.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
            Test Alert
          </button>
        </div>

        {/* Stat Cards */}
        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(230,220,255,0.12)" }} />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total */}
            <div className="p-5 flex flex-col justify-center" style={glassCard}>
              <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#a8a0be" }}>Total</p>
              <div className="text-3xl font-bold font-serif" style={{ color: "#f4effa" }}>{stats.total}</div>
            </div>
            {/* Closing Soon */}
            <div className="p-5 flex flex-col justify-center relative overflow-hidden" style={{ ...glassCard, borderColor: "rgba(251,191,36,0.3)" }}>
              <AlertCircle className="absolute right-[-8%] top-[-8%] w-16 h-16" style={{ color: "rgba(251,191,36,0.1)" }} />
              <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#fcd34d" }}>Closing Soon</p>
              <div className="text-3xl font-bold font-serif" style={{ color: "#f3e5ab" }}>{stats.closingSoon}</div>
            </div>
            {/* To Apply */}
            <div className="p-5 flex flex-col justify-center" style={{ ...glassCard, borderColor: "rgba(129,140,248,0.35)" }}>
              <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#818cf8" }}>To Apply</p>
              <div className="text-3xl font-bold font-serif" style={{ color: "#f4effa" }}>{stats.byStatus["to-apply"]}</div>
            </div>
            {/* Completed */}
            <div className="p-5 flex flex-col justify-center" style={{ ...glassCard, borderColor: "rgba(52,211,153,0.3)" }}>
              <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#34d399" }}>Completed</p>
              <div className="text-3xl font-bold font-serif" style={{ color: "#f4effa" }}>{stats.byStatus.completed}</div>
            </div>
          </div>
        ) : null}

        {/* Filter Pills + Cards */}
        <div className="space-y-6">
          {/* Glass pill filter tabs */}
          <div
            className="inline-flex items-center gap-1 p-1 rounded-full"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(230,220,255,0.15)",
              backdropFilter: "blur(8px)",
            }}
          >
            {FILTERS.map(({ value, label }) => {
              const active = statusFilter === value;
              return (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className="px-4 py-1.5 text-sm rounded-full transition-all duration-200"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    letterSpacing: "0.03em",
                    background: active
                      ? "linear-gradient(135deg, rgba(124,108,155,0.55), rgba(61,61,112,0.75))"
                      : "transparent",
                    color: active ? "#f3e5ab" : "#a8a0be",
                    border: active ? "1px solid rgba(243,229,171,0.5)" : "1px solid transparent",
                    boxShadow: active ? "0 0 12px rgba(243,229,171,0.2)" : "none",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Cards grid */}
          {opsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(230,220,255,0.1)" }} />
              ))}
            </div>
          ) : opportunities?.length === 0 ? (
            <div
              className="text-center py-24 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(230,220,255,0.2)" }}
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(255,255,255,0.06)" }}>
                <Briefcase className="w-8 h-8" style={{ color: "#a8a0be" }} />
              </div>
              <h3 className="text-lg font-serif font-medium mb-2" style={{ color: "#f4effa" }}>No opportunities found</h3>
              <p className="max-w-sm mx-auto mb-6 text-sm" style={{ color: "#a8a0be" }}>
                You haven't tracked anything in this category yet. Time to add something new.
              </p>
              <Link href="/add">
                <button
                  className="px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200"
                  style={{
                    background: "linear-gradient(135deg, rgba(124,108,155,0.4), rgba(41,41,82,0.6))",
                    border: "1px solid rgba(243,229,171,0.5)",
                    color: "#f3e5ab",
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: "1rem",
                    boxShadow: "0 0 10px rgba(243,229,171,0.15)",
                  }}
                >
                  Add Opportunity
                </button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {opportunities?.map((opp) => {
                const Icon = TYPE_ICONS[opp.type] || TYPE_ICONS.other;
                const statusConf = STATUS_CONFIG[opp.status] ?? STATUS_CONFIG["to-apply"];

                return (
                  <Link key={opp.id} href={`/opportunity/${opp.id}`}>
                    <div
                      className="group h-full flex flex-col cursor-pointer transition-all duration-200"
                      style={{
                        ...glassCard,
                        minHeight: "160px",
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.background = "rgba(255,255,255,0.13)";
                        el.style.borderColor = "rgba(243,229,171,0.35)";
                        el.style.boxShadow = "0 12px 40px rgba(12,10,28,0.5), 0 0 16px rgba(243,229,171,0.12)";
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.background = "rgba(255,255,255,0.08)";
                        el.style.borderColor = "rgba(230,220,255,0.22)";
                        el.style.boxShadow = "0 8px 32px rgba(12,10,28,0.3)";
                      }}
                    >
                      <div className="p-5 pb-3">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="p-2 rounded-xl shrink-0" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(230,220,255,0.15)", color: "#dcd6e8" }}>
                            <Icon className="w-5 h-5" />
                          </div>
                          {renderDeadlineBadge(opp.deadline)}
                        </div>
                        <p className="text-base font-serif font-semibold leading-tight line-clamp-2" style={{ color: "#f4effa" }}>
                          {opp.title}
                        </p>
                      </div>
                      <div className="p-5 pt-0 flex-1 flex flex-col justify-end">
                        <div className="flex items-center justify-between text-xs mt-auto">
                          <div className="flex items-center gap-1.5 font-medium" style={{ color: "#a8a0be" }}>
                            <span className="w-2 h-2 rounded-full" style={{ background: statusConf.dot }} />
                            {statusConf.label}
                          </div>
                          {opp.taskCount !== undefined && opp.taskCount > 0 && (
                            <div className="flex items-center gap-1.5 font-medium" style={{ color: "#a8a0be" }}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {opp.completedTaskCount || 0}/{opp.taskCount}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
