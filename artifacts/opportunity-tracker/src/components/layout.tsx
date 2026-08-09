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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
    <div className="min-h-screen text-foreground flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur-md">
        <div className="container mx-auto px-4 max-w-5xl h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200">
              <Zap className="w-4 h-4" />
            </div>
            <span className="font-serif font-semibold text-xl tracking-tight hidden sm:inline-block">
              Tracker
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Button size="sm" className="gap-2 shadow-sm rounded-full px-4 font-medium hover-elevate" asChild>
              <Link href="/add">
                <Plus className="w-4 h-4" />
                <span>New</span>
              </Link>
            </Button>
            <div className="h-4 w-px bg-border/50 mx-1 hidden sm:block" />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground hidden sm:flex"
              disabled={logout.isPending}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        {children}
      </main>
    </div>
  );
}