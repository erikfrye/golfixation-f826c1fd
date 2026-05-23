import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/captain/team/$teamId")({
  component: TeamLayout,
});

function TeamLayout() {
  const { teamId } = Route.useParams();
  const teamQ = useQuery({
    queryKey: ["captain-layout-team", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("tournament_id")
        .eq("id", teamId)
        .maybeSingle();
      if (error) throw error;
      return data as { tournament_id: string } | null;
    },
  });
  const tournamentId = teamQ.data?.tournament_id;

  return (
    <div className="min-h-screen bg-background pb-16">
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-30 h-14 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-3xl items-center">
          <Link
            to="/captain/team/$teamId"
            params={{ teamId }}
            activeOptions={{ exact: true }}
            activeProps={{ className: "text-primary" }}
            inactiveProps={{ className: "text-muted-foreground hover:bg-muted" }}
            className="flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors"
          >
            <Pencil className="h-5 w-5" />
            Scoring
          </Link>
          <div className="h-8 w-px bg-border" />
          {tournamentId ? (
            <Link
              to="/tournament/$id"
              params={{ id: tournamentId }}
              className="flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <Trophy className="h-5 w-5" />
              Leaderboard
            </Link>
          ) : (
            <span className="flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground/50">
              <Trophy className="h-5 w-5" />
              Leaderboard
            </span>
          )}
        </div>
      </nav>
    </div>
  );
}
