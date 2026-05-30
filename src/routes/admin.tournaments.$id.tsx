import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Users, Trash2 } from "lucide-react";
import { adminGetTournament } from "@/lib/admin.functions";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/tournaments/$id")({
  component: EditTournament,
});

type HoleRow = { id: string; hole_number: number; par: number };

function EditTournament() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const tQ = useQuery({
    queryKey: ["admin", "tournament", id],
    queryFn: () => adminGetTournament({ data: { id } }),
  });

  const holesQ = useQuery({
    queryKey: ["admin", "holes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holes")
        .select("id, hole_number, par")
        .eq("tournament_id", id)
        .order("hole_number");
      if (error) throw error;
      return (data ?? []) as HoleRow[];
    },
  });

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("draft");
  const [format, setFormat] = useState<string>("texas_scramble");
  const [code, setCode] = useState("");
  const [teeMin, setTeeMin] = useState(1);
  const [about, setAbout] = useState("");
  const [mulligansEnabled, setMulligansEnabled] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [startFormat, setStartFormat] = useState<"tee_time" | "shotgun">("tee_time");
  const [holes, setHoles] = useState<HoleRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (tQ.data) {
      setName(tQ.data.name);
      setLocation(tQ.data.location ?? "");
      setStatus(tQ.data.status);
      setFormat(tQ.data.format);
      setCode(tQ.data.override_code);
      setTeeMin(tQ.data.tee_shot_minimum ?? 1);
      setAbout(tQ.data.about_content ?? "");
      setMulligansEnabled(tQ.data.mulligans_enabled ?? true);
      setStartFormat((tQ.data.start_format as "tee_time" | "shotgun") ?? "tee_time");
      setStartDate(
        tQ.data.start_date
          ? new Date(tQ.data.start_date).toISOString().slice(0, 16)
          : "",
      );
    }
  }, [tQ.data]);

  useEffect(() => {
    if (holesQ.data) setHoles(holesQ.data);
  }, [holesQ.data]);

  if (tQ.isLoading) return <div className="h-32 animate-pulse rounded-lg bg-muted" />;
  if (!tQ.data) return <div className="text-sm text-muted-foreground">Tournament not found.</div>;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { error: tErr } = await supabase
        .from("tournaments")
        .update({
          name,
          location: location.trim() ? location.trim() : null,
          status,
          format,
          override_code: code.toUpperCase(),
          tee_shot_minimum: teeMin,
          about_content: about.trim() ? about : null,
          mulligans_enabled: mulligansEnabled,
          start_date: startDate ? new Date(startDate).toISOString() : null,
          start_format: startFormat,
        })
        .eq("id", id);
      if (tErr) throw tErr;

      for (const h of holes) {
        const { error } = await supabase.from("holes").update({ par: h.par }).eq("id", h.id);
        if (error) throw error;
      }
      setMessage("Saved");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this tournament and all its data? This cannot be undone.")) return;
    const { error } = await supabase.from("tournaments").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    navigate({ to: "/admin" });
  };

  return (
    <div>
      <Link to="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Edit tournament</h1>
        <Link
          to="/admin/tournaments/$id/teams"
          params={{ id }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          <Users className="h-4 w-4" /> Manage teams
        </Link>
      </div>

      <div className="space-y-5 rounded-lg border border-border bg-card p-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Location (golf course)</span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Pebble Beach Golf Links"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Start date & time</span>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Start format</span>
          <select
            value={startFormat}
            onChange={(e) => setStartFormat(e.target.value as "tee_time" | "shotgun")}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="tee_time">Tee time (all start hole 1)</option>
            <option value="shotgun">Shotgun (teams start on assigned hole)</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            With shotgun, set each team's starting hole on the Manage teams page.
          </p>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="scramble">Scramble</option>
            <option value="texas_scramble">Texas Scramble</option>
            <option value="match_play">Match Play</option>
            <option value="stroke_play">Stroke Play</option>
            <option value="best_ball">Best Ball (Four Ball)</option>
            <option value="alternate_shot">Alternate Shot</option>
          </select>
        </label>

        {format === "texas_scramble" && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              Tee shot minimum per player
            </span>
            <input
              type="number"
              min={0}
              value={teeMin}
              onChange={(e) => setTeeMin(parseInt(e.target.value) || 0)}
              className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Applies to all teams in this tournament.
            </p>
          </label>
        )}

        <label className="flex items-center gap-3 text-sm font-medium text-foreground">
          <Switch checked={mulligansEnabled} onCheckedChange={setMulligansEnabled} />
          Allow mulligans
        </label>

        <div>
          <span className="mb-2 block text-sm font-medium text-foreground">Hole pars</span>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
            {holes.map((h, idx) => (
              <label key={h.id} className="flex flex-col items-center text-xs">
                <span className="text-muted-foreground">#{h.hole_number}</span>
                <input
                  type="number"
                  min={3}
                  max={6}
                  value={h.par}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const par = parseInt(e.target.value) || 4;
                    setHoles((prev) => prev.map((x, i) => (i === idx ? { ...x, par } : x)));
                  }}
                  className="mt-1 w-12 rounded-md border border-input bg-background px-1.5 py-1 text-center text-sm"
                />
              </label>
            ))}
          </div>
        </div>

        <Accordion type="single" collapsible className="border-t border-border">
          <AccordionItem value="advanced" className="border-b-0">
            <AccordionTrigger className="text-sm font-medium text-foreground">
              Advanced settings
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-5 pt-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-foreground">Override code</span>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-40 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm uppercase"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-foreground">About (override)</span>
                  <textarea
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    rows={4}
                    placeholder="Leave blank to use the app-wide About text."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Shown in the info modal on this tournament's pages. Overrides the app-wide About.
                  </p>
                </label>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        <div className="flex justify-between">
          <button
            onClick={remove}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}