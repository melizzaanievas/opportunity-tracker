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

/* ── font aliases ── */
const serif  = "'Cormorant Garamond', Georgia, serif";
const sans   = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

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

/* ── shared glass card style ── */
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
      onSuccess: (data) => toast({ title: "Telegram Alert Sent", description: data.message || "Test message sent successfully." }),
      onError: ()       => toast({ title: "Failed to send",      description: "Please check your Telegram configuration.", variant: "destructive" }),
    });
  };

  const renderDeadlineBadge = (deadline: string | null | undefined) => {
    if (!deadline) return null;
    const date = new Date(deadline);
    const days = differenceInDays(date, new Date());
    const base: React.CSSProperties = { fontFamily: sans, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.04em", padding: "2px 8px", borderRadius: "999px", marginLeft: "auto", whiteSpace: "nowrap" };
    if (isPast(date) && days < 0) return <span style={{ ...base, background: "rgba(239,68,68,0.18)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.35)" }}>Past due</span>;
    if (days <= 3)  return <span style={{ ...base, background: "rgba(239,68,68,0.13)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.28)" }}>{days}d left</span>;
    if (days <= 7)  return <span style={{ ...base, background: "rgba(251,191,36,0.12)", color: "#fcd34d", border: "1px solid rgba(251,191,36,0.3)" }}>{days}d left</span>;
    return               <span style={{ ...base, background: "rgba(255,255,255,0.06)", color: "#a8a0be", border: "1px solid rgba(230,220,255,0.18)" }}>{days}d left</span>;
  };

  return (
    <AppLayout>
      <div className="space-y-8 pb-12">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 style={{
              fontFamily: serif,
              fontSize: "2.6rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: "#F8F5FF",
              textShadow: "0 0 24px rgba(220,200,255,0.3)",
              margin: 0,
            }}>
              Dashboard
            </h1>
            <p style={{ fontFamily: sans, fontSize: "0.875rem", color: "#E2DAF0", marginTop: "4px" }}>
              Your command center for opportunities.
            </p>
          </div>

          {/* Test Alert button — sans-serif, bold */}
          <button
            onClick={handleTestAlert}
            disabled={testTelegram.isPending}
            className="flex items-center gap-2 self-start sm:self-auto transition-all duration-200"
            style={{
              fontFamily: sans,
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              padding: "8px 18px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(243,229,171,0.45)",
              color: "#F3E5AB",
              boxShadow: "0 0 10px rgba(243,229,171,0.15)",
              cursor: testTelegram.isPending ? "not-allowed" : "pointer",
            }}
          >
            {testTelegram.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Send className="w-3.5 h-3.5" />}
            TEST ALERT
          </button>
        </div>

        {/* ── Stat Cards ── */}
        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(230,220,255,0.12)" }} />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* Total */}
            <div style={glassCard} className="p-5 flex flex-col justify-center">
              <p style={{ fontFamily: sans, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", color: "#F3E5AB", textTransform: "uppercase", marginBottom: "6px" }}>Total</p>
              <div style={{ fontFamily: serif, fontSize: "2.2rem", fontWeight: 700, color: "#ffffff", textShadow: "0 0 10px rgba(255,255,255,0.3)" }}>{stats.total}</div>
            </div>

            {/* Closing Soon */}
            <div style={{ ...glassCard, borderColor: "rgba(251,191,36,0.3)", position: "relative", overflow: "hidden" }} className="p-5 flex flex-col justify-center">
              <AlertCircle className="absolute right-[-8%] top-[-8%] w-16 h-16" style={{ color: "rgba(251,191,36,0.1)" }} />
              <p style={{ fontFamily: sans, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", color: "#F3E5AB", textTransform: "uppercase", marginBottom: "6px" }}>Closing Soon</p>
              <div style={{ fontFamily: serif, fontSize: "2.2rem", fontWeight: 700, color: "#ffffff", textShadow: "0 0 10px rgba(255,255,255,0.3)" }}>{stats.closingSoon}</div>
            </div>

            {/* To Apply */}
            <div style={{ ...glassCard, borderColor: "rgba(129,140,248,0.35)" }} className="p-5 flex flex-col justify-center">
              <p style={{ fontFamily: sans, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", color: "#F3E5AB", textTransform: "uppercase", marginBottom: "6px" }}>To Apply</p>
              <div style={{ fontFamily: serif, fontSize: "2.2rem", fontWeight: 700, color: "#ffffff", textShadow: "0 0 10px rgba(255,255,255,0.3)" }}>{stats.byStatus["to-apply"]}</div>
            </div>

            {/* Completed */}
            <div style={{ ...glassCard, borderColor: "rgba(52,211,153,0.3)" }} className="p-5 flex flex-col justify-center">
              <p style={{ fontFamily: sans, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", color: "#F3E5AB", textTransform: "uppercase", marginBottom: "6px" }}>Completed</p>
              <div style={{ fontFamily: serif, fontSize: "2.2rem", fontWeight: 700, color: "#ffffff", textShadow: "0 0 10px rgba(255,255,255,0.3)" }}>{stats.byStatus.completed}</div>
            </div>

          </div>
        ) : null}

        {/* ── Filter Tabs + Cards ── */}
        <div className="space-y-6">

          {/* Glass pill filter tabs — sans-serif, bold */}
          <div
            className="inline-flex items-center gap-1 p-1 rounded-full"
            style={{
              background: "rgba(18,17,40,0.5)",
              border: "1px solid rgba(230,220,255,0.15)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            {FILTERS.map(({ value, label }) => {
              const active = statusFilter === value;
              return (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className="px-4 py-1.5 rounded-full transition-all duration-200"
                  style={{
                    fontFamily: sans,
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    background: active ? "rgba(255,255,255,0.1)" : "transparent",
                    color: active ? "#F8F5FF" : "#a8a0be",
                    border: active ? "1px solid rgba(230,220,255,0.35)" : "1px solid transparent",
                    boxShadow: active ? "0 0 12px rgba(200,180,255,0.2), inset 0 0 8px rgba(255,255,255,0.04)" : "none",
                    cursor: "pointer",
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
            /* ── Empty State ── */
            <div
              className="text-center py-24 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(230,220,255,0.2)" }}
            >
              {/* Glowing ring around icon */}
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1.5px solid rgba(230,220,255,0.3)",
                  boxShadow: "0 0 24px rgba(200,180,255,0.2), 0 0 8px rgba(200,180,255,0.15) inset",
                }}
              >
                <Briefcase className="w-9 h-9" style={{ color: "#c4b5fd" }} />
              </div>
              <h3 style={{ fontFamily: serif, fontSize: "1.4rem", fontWeight: 600, letterSpacing: "0.04em", color: "#F8F5FF", marginBottom: "8px" }}>
                No opportunities found
              </h3>
              <p style={{ fontFamily: sans, fontSize: "0.875rem", color: "#E2DAF0", maxWidth: "320px", margin: "0 auto 24px" }}>
                You haven't tracked anything in this category yet. Time to add something new.
              </p>
              <Link href="/add">
                <button
                  className="transition-all duration-200"
                  style={{
                    fontFamily: sans,
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    padding: "10px 24px",
                    borderRadius: "999px",
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(243,229,171,0.45)",
                    color: "#F3E5AB",
                    boxShadow: "0 0 12px rgba(243,229,171,0.15)",
                  }}
                >
                  ADD OPPORTUNITY
                </button>
              </Link>
            </div>
          ) : (
            /* ── Opportunity Cards ── */
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {opportunities?.map((opp) => {
                const Icon = TYPE_ICONS[opp.type] || TYPE_ICONS.other;
                const statusConf = STATUS_CONFIG[opp.status] ?? STATUS_CONFIG["to-apply"];

                return (
                  <Link key={opp.id} href={`/opportunity/${opp.id}`}>
                    <div
                      className="group h-full flex flex-col cursor-pointer transition-all duration-200"
                      style={{ ...glassCard, minHeight: "160px" }}
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
                        {/* Card title — serif */}
                        <p style={{ fontFamily: serif, fontSize: "1.1rem", fontWeight: 600, letterSpacing: "0.02em", color: "#F8F5FF", lineHeight: 1.35 }} className="line-clamp-2">
                          {opp.title}
                        </p>
                      </div>
                      <div className="p-5 pt-0 flex-1 flex flex-col justify-end">
                        <div className="flex items-center justify-between text-xs mt-auto">
                          {/* Status — sans */}
                          <div className="flex items-center gap-1.5" style={{ fontFamily: sans, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em", color: "#a8a0be" }}>
                            <span className="w-2 h-2 rounded-full" style={{ background: statusConf.dot }} />
                            {statusConf.label.toUpperCase()}
                          </div>
                          {opp.taskCount !== undefined && opp.taskCount > 0 && (
                            <div className="flex items-center gap-1.5" style={{ fontFamily: sans, fontSize: "0.7rem", fontWeight: 600, color: "#a8a0be" }}>
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
