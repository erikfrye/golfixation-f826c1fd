import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flag, LogOut } from "lucide-react";
import { AboutButton } from "@/components/about-dialog";
import { ThemeSwitcher } from "@/components/theme-switcher";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Golfixation" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const adminCheck = useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admins")
        .select("id")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  useEffect(() => {
    if (userId === null) navigate({ to: "/login" });
  }, [userId, navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  if (userId === undefined || (userId && adminCheck.isLoading)) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (userId === null) {
    return null;
  }
  if (adminCheck.data === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">Not authorized</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your account isn't registered as an admin. Contact the tournament organizer.
        </p>
        <button onClick={signOut} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/admin" className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Golfixation Admin</span>
          </Link>
          <div className="flex items-center gap-1">
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
          <AboutButton />
          <ThemeSwitcher />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}