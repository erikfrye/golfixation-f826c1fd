import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Plus, Trash2, UserPlus, Pencil } from "lucide-react";
import { adminListTeams, adminGetTournament } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/tournaments/$id_/teams")({
  component: ManageTeams,
});

type Team = {
  id: string;
  name: string;
  captain_email: string;
  start_hole: number;
};
type Player = {
  id: string;
  team_id: string;
  name: string;
  mulligans_total: number;
};

function ManageTeams() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const tournamentQ = useQuery({
    queryKey: ["admin", "tournament", id],
    queryFn: () => adminGetTournament({ data: { id } }),
  });
  const isShotgun = tournamentQ.data?.start_format === "shotgun";
  const mulligansEnabled = tournamentQ.data?.mulligans_enabled ?? true;
  const numHoles = tournamentQ.data?.num_holes ?? 18;

  const teamsQ = useQuery({
    queryKey: ["admin", "teams", id],
    queryFn: async () => (await adminListTeams({ data: { tournamentId: id } })) as Team[],
  });

  const playersQ = useQuery({
    queryKey: ["admin", "players", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_players")
        .select("id, team_id, name, mulligans_total")
        .eq("tournament_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Player[];
    },
  });

  const [newTeamName, setNewTeamName] = useState("");
  const [newCaptainEmail, setNewCaptainEmail] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "teams", id] });
    qc.invalidateQueries({ queryKey: ["admin", "players", id] });
  };

  const addTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("teams").insert({
      tournament_id: id,
      name: newTeamName,
      captain_email: newCaptainEmail.toLowerCase(),
    });
    if (error) return alert(error.message);
    setNewTeamName("");
    setNewCaptainEmail("");
    refresh();
  };

  const removeTeam = async (teamId: string) => {
    if (!confirm("Delete this team and its players?")) return;
    await supabase.from("team_players").delete().eq("team_id", teamId);
    await supabase.from("teams").delete().eq("id", teamId);
    refresh();
  };

  const updateTeam = async (teamId: string, patch: Partial<Team>) => {
    await supabase.from("teams").update(patch).eq("id", teamId);
    refresh();
  };

  const addPlayer = async (teamId: string, name: string) => {
    if (!name.trim()) return;
    await supabase.from("team_players").insert({
      tournament_id: id,
      team_id: teamId,
      name: name.trim(),
      mulligans_total: 0,
    });
    refresh();
  };

  const removePlayer = async (playerId: string) => {
    await supabase.from("team_players").delete().eq("id", playerId);
    refresh();
  };

  const updatePlayer = async (playerId: string, patch: Partial<Player>) => {
    await supabase.from("team_players").update(patch).eq("id", playerId);
    refresh();
  };

  return (
    <div>
      <Link
        to="/admin/tournaments/$id"
        params={{ id }}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back to tournament
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Teams & players</h1>

      <form onSubmit={addTeam} className="mb-6 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Add team</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            required
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Team name"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            required
            type="email"
            value={newCaptainEmail}
            onChange={(e) => setNewCaptainEmail(e.target.value)}
            placeholder="captain@email.com"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add team
          </button>
        </div>
      </form>

      {teamsQ.isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      ) : !teamsQ.data || teamsQ.data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No teams yet.
        </div>
      ) : (
        <ul className="space-y-4">
          {teamsQ.data.map((team) => {
            const teamPlayers = (playersQ.data ?? []).filter((p) => p.team_id === team.id);
            return (
              <li key={team.id} className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      defaultValue={team.name}
                      onBlur={(e) =>
                        e.target.value !== team.name && updateTeam(team.id, { name: e.target.value })
                      }
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm font-semibold"
                    />
                    <input
                      defaultValue={team.captain_email}
                      onBlur={(e) =>
                        e.target.value !== team.captain_email &&
                        updateTeam(team.id, { captain_email: e.target.value.toLowerCase() })
                      }
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    />
                    {isShotgun && (
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        Start hole
                        <input
                          type="number"
                          min={1}
                          max={numHoles}
                          defaultValue={team.start_hole ?? 1}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => {
                            const n = Math.max(1, Math.min(numHoles, parseInt(e.target.value) || 1));
                            if (n !== team.start_hole) updateTeam(team.id, { start_hole: n });
                          }}
                          className="w-16 rounded-md border border-input bg-background px-2 py-1 text-center text-sm"
                        />
                      </label>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/captain/team/$teamId"
                      params={{ teamId: team.id }}
                      search={{ from: "admin" }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Score
                    </Link>
                    <button
                      onClick={() => removeTeam(team.id)}
                      className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete team
                    </button>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {teamPlayers.map((p) => (
                    <li key={p.id} className="flex items-center gap-2">
                      <input
                        defaultValue={p.name}
                        onBlur={(e) =>
                          e.target.value !== p.name && updatePlayer(p.id, { name: e.target.value })
                        }
                        className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                      {mulligansEnabled && (
                        <label className="flex items-center gap-1 text-xs text-muted-foreground">
                          Mulligans
                          <input
                            type="number"
                            min={0}
                            defaultValue={p.mulligans_total}
                            onBlur={(e) => {
                              const n = parseInt(e.target.value) || 0;
                              if (n !== p.mulligans_total)
                                updatePlayer(p.id, { mulligans_total: n });
                            }}
                            className="w-12 rounded-md border border-input bg-background px-1.5 py-1 text-center text-sm"
                          />
                        </label>
                      )}
                      <button
                        onClick={() => removePlayer(p.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove player"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>

                <AddPlayerInput onAdd={(name) => addPlayer(team.id, name)} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddPlayerInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(value);
        setValue("");
      }}
      className="mt-3 flex items-center gap-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add player…"
        className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      />
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent"
      >
        <UserPlus className="h-3.5 w-3.5" /> Add
      </button>
    </form>
  );
}