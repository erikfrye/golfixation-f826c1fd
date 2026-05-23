import { createFileRoute, Outlet, Link, useRouter } from "@tanstack/react-router";
import { Pencil, Trophy } from "lucide-react";

export const Route = createFileRoute("/captain/team/$teamId")({
  component: TeamLayout,
});

function TeamLayout() {
  const { teamId } = Route.useParams();
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const isLeaderboard = pathname.includes("/leaderboard");

  return (
    <div className="min-h-screen bg-background pb-16">
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-30 h-14 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-3xl items-center">
          <Link
            to="/captain/team/$teamId"
            params={{ teamId }}
            className={`flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
              !isLeaderboard ? "text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Pencil className="h-5 w-5" />
            Scoring
          </Link>
          <div className="h-8 w-px bg-border" />
          <Link
            to="/captain/team/$teamId/leaderboard"
            params={{ teamId }}
            className={`flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
              isLeaderboard ? "text-primary" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Trophy className="h-5 w-5" />
            Leaderboard
          </Link>
        </div>
      </nav>
    </div>
  );
}
