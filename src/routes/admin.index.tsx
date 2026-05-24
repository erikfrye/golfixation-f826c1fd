import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id, name, status, num_holes, format, override_code, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const aboutQ = useQuery({
    queryKey: ["admin", "app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("about_content")
        .eq("id", "app")
        .maybeSingle();
      if (error) throw error;
      return data?.about_content ?? "";
    },
  });

  const [about, setAbout] = useState("");
  const [savingAbout, setSavingAbout] = useState(false);
  const [aboutMsg, setAboutMsg] = useState<string | null>(null);

  useEffect(() => {
    if (aboutQ.data !== undefined) setAbout(aboutQ.data);
  }, [aboutQ.data]);

  const saveAbout = async () => {
    setSavingAbout(true);
    setAboutMsg(null);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ id: "app", about_content: about, updated_at: new Date().toISOString() });
    setSavingAbout(false);
    setAboutMsg(error ? error.message : "Saved");
  };

  return (
    <div>
      <div className="mb-6 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-2 text-lg font-semibold text-foreground">App About</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Shown in the info modal across the app. Tournaments can override this with their own text.
        </p>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={5}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="About this app…"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={saveAbout}
            disabled={savingAbout}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {savingAbout ? "Saving…" : "Save About"}
          </button>
          {aboutMsg && <span className="text-xs text-muted-foreground">{aboutMsg}</span>}
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Tournaments</h1>
        <Link
          to="/admin/tournaments/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New tournament
        </Link>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      ) : !data || data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No tournaments yet. Create one to get started.
        </div>
      ) : (
        <ul className="space-y-2">
          {data.map((t) => (
            <li key={t.id}>
              <Link
                to="/admin/tournaments/$id"
                params={{ id: t.id }}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-primary hover:bg-accent/30"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{t.name}</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.num_holes} holes · Code <span className="font-mono">{t.override_code}</span>
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}