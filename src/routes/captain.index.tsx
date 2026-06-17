import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronRight, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMyCaptainTeams } from "@/lib/admin.functions";

export const Route = createFileRoute("/captain/")({
  component: CaptainIndex,
});

type CaptainTeam = {
  id: string;
  name: string;
  tournament_id: string;
  tournaments: { id: string; name: string; status: string; num_holes: number } | null;
};

function CaptainIndex() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["captain-teams", email],
    enabled: !!email,
    queryFn: async () => (await listMyCaptainTeams()) as unknown as CaptainTeam[],
    select: (teams) => teams.filter((t) => t.tournaments?.status !== "completed"),
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold text-foreground">Your teams</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tap a team to enter scores hole-by-hole.
      </p>

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No teams registered to {email}. Ask your tournament admin to add you as a captain.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.map((t) => (
              <li key={t.id}>
                <Link
                  to="/captain/team/$teamId"
                  params={{ teamId: t.id }}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-accent/30"
                >
                  <div>
                    <h3 className="font-semibold text-foreground">{t.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.tournaments?.name} · {t.tournaments?.num_holes} holes ·{" "}
                      <span className="capitalize">{t.tournaments?.status}</span>
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}