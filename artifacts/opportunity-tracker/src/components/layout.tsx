import { Link, useLocation } from "wouter";
import { useLogout, useGetAuthMe } from "@workspace/api-client-react";
import { Loader2, Zap, LogOut } from "lucide-react";

const sans  = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: auth, isLoading } = useGetAuthMe();
  const logout = useLogout();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#F3E5AB" }} />
      </div>
    );
  }

  if (!auth?.authenticated) {
    setLocation("/");
    return null;
  }

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => setLocation("/") });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Navbar — dark frosted glass ── */}
      <header
        className="sticky top-0 z-50 w-full"
        style={{
          background: "rgba(14,13,34,0.6)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(230,220,255,0.1)",
        }}
      >
        <div className="container mx-auto px-4 max-w-5xl h-16 flex items-center justify-between">

          {/* Logo + wordmark */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group no-underline">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-200"
              style={{
                background: "rgba(124,108,155,0.35)",
                border: "1px solid rgba(243,229,171,0.4)",
                color: "#F3E5AB",
                boxShadow: "0 0 10px rgba(243,229,171,0.12)",
              }}
            >
              <Zap className="w-4 h-4" />
            </div>
            {/* Wordmark — sans-serif, bold */}
            <span style={{
              fontFamily: sans,
              fontSize: "0.95rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "#F8F5FF",
              textTransform: "uppercase",
            }} className="hidden sm:inline-block">
              Tracker
            </span>
          </Link>

          <div className="flex items-center gap-2">

            <div className="h-4 w-px hidden sm:block" style={{ background: "rgba(230,220,255,0.15)" }} />

            {/* Sign out — sans-serif */}
            <button
              onClick={handleLogout}
              disabled={logout.isPending}
              className="hidden sm:flex items-center gap-1.5 transition-all duration-200"
              style={{
                fontFamily: sans,
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.04em",
                padding: "7px 14px",
                borderRadius: "999px",
                background: "transparent",
                border: "1px solid transparent",
                color: "#a8a0be",
                cursor: logout.isPending ? "not-allowed" : "pointer",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget;
                el.style.color = "#F8F5FF";
                el.style.borderColor = "rgba(230,220,255,0.2)";
                el.style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget;
                el.style.color = "#a8a0be";
                el.style.borderColor = "transparent";
                el.style.background = "transparent";
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
              SIGN OUT
            </button>

          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        {children}
      </main>
    </div>
  );
}
