import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Golfixation" },
      { name: "description", content: "Sign in to manage tournaments or enter team scores." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  const signInGoogle = async () => {
    setError(null);
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/admin",
    });
    if (result.error) {
      setError(result.error.message ?? "Sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/admin" });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Flag className="h-10 w-10 text-primary" />
      <h1 className="mt-4 text-2xl font-bold text-foreground">Sign in to Golfixation</h1>
      <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
        Admins sign in with Google to manage tournaments. Captain login (email OTP) is coming in Phase 2.
      </p>

      <button
        onClick={signInGoogle}
        disabled={loading}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent disabled:opacity-60"
      >
        <GoogleIcon />
        {loading ? "Redirecting…" : "Continue with Google"}
      </button>
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      <Link to="/" className="mt-6 text-xs text-muted-foreground hover:text-foreground">
        ← Back to tournaments
      </Link>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.32Z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58Z"/>
    </svg>
  );
}