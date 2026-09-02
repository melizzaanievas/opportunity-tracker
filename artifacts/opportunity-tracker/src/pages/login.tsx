import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLogin, useGetAuthMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const login = useLogin();

  const { data: auth, isLoading } = useGetAuthMe();

  useEffect(() => {
    if (auth?.authenticated) {
      setLocation("/dashboard");
    }
  }, [auth, setLocation]);

  if (auth?.authenticated) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { data: { password } },
      {
        onSuccess: () => {
          setLocation("/dashboard");
        },
        onError: (error) => {
          toast({
            title: "Access Denied",
            description: error.data?.error || "Incorrect passcode",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-md border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-slate-950/50">
        <CardHeader className="space-y-3 text-center pb-6 pt-8">
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-sm">
            <Sparkles className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-semibold text-slate-100 tracking-tight">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-slate-400 text-sm max-w-xs mx-auto">
            Enter your passcode to open your opportunity hub.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium text-slate-300">
                Passcode
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 text-base bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-indigo-500/20"
                autoFocus
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-11 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all duration-200 active:scale-[0.99]"
              disabled={login.isPending || !password}
            >
              {login.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Unlock Workspace <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
