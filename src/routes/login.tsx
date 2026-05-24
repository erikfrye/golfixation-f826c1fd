import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { redeemOverrideCode } from "@/lib/captain.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Golfixation" },
      { name: "description", content: "Sign in to manage tournaments or enter team scores." },
    ],
  }),
  component: LoginPage,
});

type Tab = "captain" | "override" | "admin";

function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("captain");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/captain" });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Flag className="h-10 w-10 text-primary" />
      <h1 className="mt-4 text-2xl font-bold text-foreground">Sign in to Golfixation</h1>

      <div className="mt-6 w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex rounded-md bg-muted p-1 text-xs font-medium">
          {(["captain", "override", "admin"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded px-2 py-1.5 transition-colors ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t === "captain" ? "Email link" : t === "override" ? "Override code" : "Admin"}
            </button>
          ))}
        </div>

        {tab === "captain" && <CaptainOtpForm />}
        {tab === "override" && <OverrideForm />}
        {tab === "admin" && <AdminForm />}
      </div>

      <Link to="/" className="mt-6 text-xs text-muted-foreground hover:text-foreground">
        ← Back to tournaments
      </Link>
    </div>
  );
}

function CaptainOtpForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/captain`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-foreground">
          Check <span className="font-medium">{email}</span> for a sign-in link.
        </p>
        <p className="text-xs text-muted-foreground">
          Tap the link in the email to open your captain dashboard.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setError(null);
          }}
          className="w-full text-xs text-muted-foreground hover:text-foreground"
        >
          ← Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={sendLink} className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Enter the email your tournament admin registered for your team.
      </p>
      <input
        type="email"
        required
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-base"
      />
      <button
        disabled={loading}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {loading ? "Sending…" : "Email me a sign-in link"}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

function OverrideForm() {
  const navigate = useNavigate();
  const redeem = useServerFn(redeemOverrideCode);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await redeem({ data: { code, email } });
      const { error: vErr } = await supabase.auth.verifyOtp({
        token_hash: result.tokenHash,
        type: "magiclink",
      });
      if (vErr) throw new Error(vErr.message);
      navigate({ to: "/captain" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to redeem code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Skip email entirely with the tournament override code provided by your admin.
      </p>
      <input
        type="text"
        required
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="OVERRIDE CODE"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-center font-mono text-base tracking-wider"
      />
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="captain email"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-base"
      />
      <button
        disabled={loading}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in with override"}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

function AdminForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Tournament admins sign in with Google.</p>
      <button
        onClick={signInGoogle}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent disabled:opacity-60"
      >
        <GoogleIcon />
        {loading ? "Redirecting…" : "Continue with Google"}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
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