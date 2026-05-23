import { createFileRoute, Link } from "@tanstack/react-router";
import { Flag } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Captain Login — Golfixation" },
      { name: "description", content: "Captains sign in to enter team scores." },
    ],
  }),
  component: LoginPlaceholder,
});

function LoginPlaceholder() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Flag className="h-10 w-10 text-primary" />
      <h1 className="mt-4 text-2xl font-bold text-foreground">Captain Login</h1>
      <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
        Email OTP login is coming in Phase 2. For now, public leaderboards are live.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Back to tournaments
      </Link>
    </div>
  );
}