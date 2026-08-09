import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useLogout, useGetAuthMe } from "@workspace/api-client-react";
import { Loader2, Plus, Zap, LogOut } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: auth, isLoading } = useGetAuthMe();
  const logout = useLogout();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#f3e5ab" }} />
      </div>
    );
  }

  if (!auth?.authenticated) {
    setLocation("/");
    return null;
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => setLocation("/")
    });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ color: "#dcd6e8" }}>
      {/* Dark frosted glass navbar */}
      <header
        className="sticky top-0 z-50 w-full"
        style={{
          background: "rgba(18, 17, 40, 0.55)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(230, 220, 255, 0.12)",
        }}
      >
        <div className="container mx-auto px-4 max-w-5xl h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200"
              style={{
                background: "linear-gradient(135deg, rgba(124,108,155,0.6), rgba(41,41,82,0.9))",
                border: "1px solid rgba(243,229,171,0.5)",
                color: "#f3e5ab",
              }}
            >
              <Zap className="w-4 h-4" />
            </div>
            <span
              className="font-serif font-semibold text-xl tracking-tight hidden sm:inline-block"
              style={{ color: "#f4effa" }}
            >
              Tracker
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/add">
              <button
                className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, rgba(124,108,155,0.4), rgba(41,41,82,0.6))",
                  border: "1px solid rgba(243,229,171,0.55)",
                  color: "#f3e5ab",
                  boxShadow: "0 0 10px rgba(243,229,171,0.2)",
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: "1rem",
                  letterSpacing: "0.04em",
                }}
              >
                <Plus className="w-4 h-4" />
                <span>New</span>
              </button>
            </Link>
            <div className="h-4 w-px hidden sm:block" style={{ background: "rgba(230,220,255,0.2)" }} />
            <button
              onClick={handleLogout}
              disabled={logout.isPending}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm rounded-full transition-all duration-200"
              style={{
                color: "#a8a0be",
                background: "transparent",
                border: "1px solid transparent",
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = "#f4effa";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(230,220,255,0.2)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = "#a8a0be";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
              }}
            >
              <LogOut className="w-4 h-4" />
              Sign out
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
