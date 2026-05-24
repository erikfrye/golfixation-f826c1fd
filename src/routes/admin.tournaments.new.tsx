import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/admin/tournaments/new")({
  component: NewTournament,
});

function generateCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function NewTournament() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [numHoles, setNumHoles] = useState(18);
  const [format, setFormat] = useState<"texas_scramble" | "scramble">("texas_scramble");
  const [code, setCode] = useState(generateCode());
  const [mulligansEnabled, setMulligansEnabled] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [startFormat, setStartFormat] = useState<"tee_time" | "shotgun">("tee_time");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data: t, error: tErr } = await supabase
        .from("tournaments")
        .insert({
          name,
          num_holes: numHoles,
          format,
          override_code: code.toUpperCase(),
          status: "draft",
          created_by: user.user?.id ?? null,
          mulligans_enabled: mulligansEnabled,
          start_date: startDate ? new Date(startDate).toISOString() : null,
          start_format: startFormat,
        })
        .select("id")
        .single();
      if (tErr) throw tErr;

      const holes = Array.from({ length: numHoles }, (_, i) => ({
        tournament_id: t.id,
        hole_number: i + 1,
        par: 4,
      }));
      const { error: hErr } = await supabase.from("holes").insert(holes);
      if (hErr) throw hErr;

      navigate({ to: "/admin/tournaments/$id", params: { id: t.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tournament");
      setSaving(false);
    }
  };

  return (
    <div>
      <Link to="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-foreground">New tournament</h1>
      <form onSubmit={submit} className="space-y-5 rounded-lg border border-border bg-card p-5">
        <Field label="Name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Summer Open 2026"
          />
        </Field>
        <Field label="Number of holes">
          <input
            type="number"
            min={1}
            max={36}
            value={numHoles}
            onChange={(e) => setNumHoles(parseInt(e.target.value) || 18)}
            className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Format">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "texas_scramble" | "scramble")}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="texas_scramble">Texas Scramble</option>
            <option value="scramble">Scramble</option>
          </select>
        </Field>
        <Field label="Start date & time">
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Start format">
          <select
            value={startFormat}
            onChange={(e) => setStartFormat(e.target.value as "tee_time" | "shotgun")}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="tee_time">Tee time (all start hole 1)</option>
            <option value="shotgun">Shotgun (teams start on assigned hole)</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={mulligansEnabled}
            onChange={(e) => setMulligansEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Allow mulligans
        </label>
        <Field label="Captain override code">
          <div className="flex gap-2">
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-40 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm uppercase"
            />
            <button
              type="button"
              onClick={() => setCode(generateCode())}
              className="rounded-md border border-border px-3 py-2 text-xs hover:bg-accent"
            >
              Regenerate
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Share with captains as a fallback if email OTP fails.
          </p>
        </Field>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Link to="/admin" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create tournament"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}