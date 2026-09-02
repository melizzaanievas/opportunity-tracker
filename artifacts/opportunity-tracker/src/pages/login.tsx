import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useLogin, useGetAuthMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Loader2, LockKeyhole } from "lucide-react";

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
  }, [auth?.authenticated, setLocation]);

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
            description: error.data?.error || "Incorrect password",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading || auth?.authenticated) {
    return (
      <div className="login-page flex min-h-screen items-center justify-center">
        <div className="login-loading-indicator" aria-label="Opening your opportunity hub">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="login-page relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="login-ambient login-ambient-indigo" />
      <div className="login-ambient login-ambient-blue" />
      <div className="login-grid" />

      <Card className="login-card relative z-10 w-full max-w-[25rem] border border-slate-800 bg-slate-900/80 backdrop-blur-xl">
        <CardHeader className="space-y-4 px-7 pb-7 pt-8 text-center sm:px-9 sm:pt-10">
          <div className="login-lock-mark">
            <LockKeyhole className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="space-y-2">
            <CardTitle className="login-title text-3xl">Welcome Back</CardTitle>
            <CardDescription className="login-description text-sm">
              Enter your passcode to open your opportunity hub.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-7 pb-8 sm:px-9 sm:pb-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2.5">
              <Label htmlFor="password" className="login-label">Passcode</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your passcode"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-passcode-input h-12 bg-slate-950/60 text-center text-lg tracking-[0.22em] text-slate-100"
                autoComplete="current-password"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="login-submit-button h-12 w-full bg-indigo-600 text-base text-white"
              disabled={login.isPending || !password}
            >
              {login.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Unlocking...
                </>
              ) : (
                <>
                  Unlock Workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
