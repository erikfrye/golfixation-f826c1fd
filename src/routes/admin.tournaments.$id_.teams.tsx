import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Plus, Trash2, UserPlus, Pencil, Upload, Download } from "lucide-react";
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
  const [importOpen, setImportOpen] = useState(false);

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
    const { error } = await supabase.from("team_players").update(patch).eq("id", playerId);
    if (error) {
      alert(`Failed to update player: ${error.message}`);
      return;
    }
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

      <BulkImport
        tournamentId={id}
        numHoles={numHoles}
        mulligansEnabled={mulligansEnabled}
        open={importOpen}
        onToggle={() => setImportOpen((v) => !v)}
        onDone={refresh}
      />

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
                            key={p.mulligans_total}
                            type="number"
                            min={0}
                            defaultValue={p.mulligans_total}
                            onFocus={(e) => e.target.select()}
                            onBlur={(e) => {
                              const parsed = parseInt(e.target.value, 10);
                              const n = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
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

type ParsedRow = {
  team_name: string;
  captain_email: string;
  start_hole: number;
  player_name: string;
  mulligans: number;
};

function parseCsv(text: string): { rows: string[][]; error?: string } {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); field = "";
        if (cur.some((v) => v.trim() !== "")) rows.push(cur);
        cur = [];
      } else field += c;
    }
  }
  if (field !== "" || cur.length > 0) {
    cur.push(field);
    if (cur.some((v) => v.trim() !== "")) rows.push(cur);
  }
  return { rows };
}

const TEMPLATE_CSV =
  "team_name,captain_email,start_hole,player_name,mulligans\n" +
  "Eagles,captain1@example.com,1,John Doe,2\n" +
  "Eagles,captain1@example.com,1,Jane Doe,2\n" +
  "Birdies,captain2@example.com,5,Bob Smith,1\n" +
  "Birdies,captain2@example.com,5,Alice Brown,1\n";

function BulkImport({
  tournamentId,
  numHoles,
  mulligansEnabled,
  open,
  onToggle,
  onDone,
}: {
  tournamentId: string;
  numHoles: number;
  mulligansEnabled: boolean;
  open: boolean;
  onToggle: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "teams-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    const t = await file.text();
    setText(t);
  };

  const parseRows = (): { ok: ParsedRow[]; error?: string } => {
    const { rows } = parseCsv(text);
    if (rows.length < 2) return { ok: [], error: "CSV must have a header row and at least one data row." };
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = {
      team_name: header.indexOf("team_name"),
      captain_email: header.indexOf("captain_email"),
      start_hole: header.indexOf("start_hole"),
      player_name: header.indexOf("player_name"),
      mulligans: header.indexOf("mulligans"),
    };
    if (idx.team_name < 0 || idx.captain_email < 0 || idx.player_name < 0)
      return { ok: [], error: "Missing required columns: team_name, captain_email, player_name." };
    const out: ParsedRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const team_name = (r[idx.team_name] ?? "").trim();
      const captain_email = (r[idx.captain_email] ?? "").trim().toLowerCase();
      const player_name = (r[idx.player_name] ?? "").trim();
      if (!team_name && !captain_email && !player_name) continue;
      if (!team_name || !captain_email || !player_name)
        return { ok: [], error: `Row ${i + 1}: team_name, captain_email and player_name are required.` };
      const sh = idx.start_hole >= 0 ? parseInt((r[idx.start_hole] ?? "1").trim(), 10) : 1;
      const start_hole = Math.max(1, Math.min(numHoles, Number.isFinite(sh) ? sh : 1));
      const mu = idx.mulligans >= 0 ? parseInt((r[idx.mulligans] ?? "0").trim(), 10) : 0;
      const mulligans = Number.isFinite(mu) ? Math.max(0, mu) : 0;
      out.push({ team_name, captain_email, start_hole, player_name, mulligans });
    }
    return { ok: out };
  };

  const preview = text.trim() ? parseRows() : null;

  const runImport = async () => {
    if (!preview || preview.error || preview.ok.length === 0) return;
    if (!confirm(`Import ${preview.ok.length} player row(s)? Existing teams with the same name will get new players appended.`)) return;
    setBusy(true);
    setStatus(null);
    try {
      // Group by team
      const teamsMap = new Map<string, { name: string; captain_email: string; start_hole: number; players: { name: string; mulligans: number }[] }>();
      for (const row of preview.ok) {
        const key = row.team_name.toLowerCase();
        let t = teamsMap.get(key);
        if (!t) {
          t = { name: row.team_name, captain_email: row.captain_email, start_hole: row.start_hole, players: [] };
          teamsMap.set(key, t);
        }
        t.players.push({ name: row.player_name, mulligans: row.mulligans });
      }

      // Fetch existing teams to dedupe by name (case-insensitive)
      const { data: existing, error: exErr } = await supabase
        .from("teams")
        .select("id, name")
        .eq("tournament_id", tournamentId);
      if (exErr) throw exErr;
      const existingByName = new Map<string, string>(
        (existing ?? []).map((t) => [t.name.toLowerCase(), t.id]),
      );

      let teamsCreated = 0;
      let playersCreated = 0;
      for (const t of teamsMap.values()) {
        let teamId = existingByName.get(t.name.toLowerCase());
        if (!teamId) {
          const { data: ins, error: tErr } = await supabase
            .from("teams")
            .insert({
              tournament_id: tournamentId,
              name: t.name,
              captain_email: t.captain_email,
              start_hole: t.start_hole,
            })
            .select("id")
            .single();
          if (tErr) throw tErr;
          teamId = ins.id;
          teamsCreated++;
        }
        const playerRows = t.players.map((p) => ({
          tournament_id: tournamentId,
          team_id: teamId!,
          name: p.name,
          mulligans_total: mulligansEnabled ? p.mulligans : 0,
        }));
        if (playerRows.length > 0) {
          const { error: pErr } = await supabase.from("team_players").insert(playerRows);
          if (pErr) throw pErr;
          playersCreated += playerRows.length;
        }
      }

      setStatus(`Imported ${teamsCreated} new team(s) and ${playersCreated} player(s).`);
      setText("");
      onDone();
    } catch (err) {
      setStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 rounded-lg border border-border bg-card">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-foreground"
      >
        <span className="inline-flex items-center gap-2">
          <Upload className="h-4 w-4" /> Bulk import (CSV)
        </span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            One row per player. Columns: <code>team_name, captain_email, start_hole, player_name, mulligans</code>. Players sharing a team_name are grouped into the same team (start_hole and captain_email taken from the first row).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" /> Download template
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent">
              <Upload className="h-3.5 w-3.5" /> Upload .csv
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Paste CSV here or upload a file…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          />
          {preview && preview.error && (
            <p className="text-xs text-destructive">{preview.error}</p>
          )}
          {preview && !preview.error && preview.ok.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Ready to import: {new Set(preview.ok.map((r) => r.team_name.toLowerCase())).size} team(s),{" "}
              {preview.ok.length} player(s).
            </p>
          )}
          {status && <p className="text-xs text-muted-foreground">{status}</p>}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={runImport}
              disabled={busy || !preview || !!preview?.error || preview.ok.length === 0}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Importing…" : "Import"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}