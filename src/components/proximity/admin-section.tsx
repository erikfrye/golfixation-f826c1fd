import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  type ProximityContest,
  type ProximityKind,
  type ProximityEligibility,
  KIND_LABEL,
  ELIGIBILITY_LABEL,
} from "./types";

type Props = {
  tournamentId: string;
  numHoles: number;
};

type Draft = {
  id?: string;
  hole_number: number;
  name: string;
  kind: ProximityKind;
  eligibility: ProximityEligibility;
  sponsor: string;
  sort_order: number;
};

const emptyDraft = (numHoles: number): Draft => ({
  hole_number: Math.min(1, numHoles),
  name: "",
  kind: "longest_drive",
  eligibility: "everyone",
  sponsor: "",
  sort_order: 0,
});

export function AdminProximitySection({ tournamentId, numHoles }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft(numHoles));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const contestsQ = useQuery({
    queryKey: ["admin-proximity-contests", tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proximity_contests")
        .select("id, tournament_id, hole_number, name, kind, eligibility, sponsor, sort_order")
        .eq("tournament_id", tournamentId)
        .order("hole_number")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as ProximityContest[];
    },
  });

  const openNew = () => {
    setDraft({ ...emptyDraft(numHoles), hole_number: 1 });
    setErr(null);
    setOpen(true);
  };

  const openEdit = (c: ProximityContest) => {
    setDraft({
      id: c.id,
      hole_number: c.hole_number,
      name: c.name,
      kind: c.kind,
      eligibility: c.eligibility,
      sponsor: c.sponsor ?? "",
      sort_order: c.sort_order,
    });
    setErr(null);
    setOpen(true);
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setErr("Name is required");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        tournament_id: tournamentId,
        hole_number: draft.hole_number,
        name: draft.name.trim(),
        kind: draft.kind,
        eligibility: draft.eligibility,
        sponsor: draft.sponsor.trim() ? draft.sponsor.trim() : null,
        sort_order: draft.sort_order,
      };
      const { error } = draft.id
        ? await supabase.from("proximity_contests").update(payload).eq("id", draft.id)
        : await supabase.from("proximity_contests").insert(payload);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["admin-proximity-contests", tournamentId] });
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this proximity contest and all its entries?")) return;
    const { error } = await supabase.from("proximity_contests").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-proximity-contests", tournamentId] });
  };

  const contests = contestsQ.data ?? [];

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Longest drive, closest to the pin, longest putt, etc. Captains can record entries on the matching hole; the
          most recent entry is the current leader.
        </p>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {contests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No proximity contests yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {contests.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <span className="inline-flex h-7 w-10 shrink-0 items-center justify-center rounded-md border border-border font-mono text-xs">
                #{c.hole_number}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{c.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5">{KIND_LABEL[c.kind]}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5">{ELIGIBILITY_LABEL[c.eligibility]}</span>
                  {c.sponsor && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary normal-case">
                      Sponsor: {c.sponsor}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEdit(c)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit proximity contest" : "Add proximity contest"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Longest Drive"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">Hole</span>
                <select
                  value={draft.hole_number}
                  onChange={(e) => setDraft((d) => ({ ...d, hole_number: Number(e.target.value) }))}
                  className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                >
                  {Array.from({ length: numHoles }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>#{n}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">Kind</span>
                <select
                  value={draft.kind}
                  onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as ProximityKind }))}
                  className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                >
                  {(Object.keys(KIND_LABEL) as ProximityKind[]).map((k) => (
                    <option key={k} value={k}>{KIND_LABEL[k]}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Eligibility</span>
              <select
                value={draft.eligibility}
                onChange={(e) => setDraft((d) => ({ ...d, eligibility: e.target.value as ProximityEligibility }))}
                className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
              >
                {(Object.keys(ELIGIBILITY_LABEL) as ProximityEligibility[]).map((k) => (
                  <option key={k} value={k}>{ELIGIBILITY_LABEL[k]}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Sponsor (optional)</span>
              <input
                value={draft.sponsor}
                onChange={(e) => setDraft((d) => ({ ...d, sponsor: e.target.value }))}
                placeholder="e.g. Pro Shop"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Sort order</span>
              <input
                type="number"
                value={draft.sort_order}
                onChange={(e) => setDraft((d) => ({ ...d, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            {err && <p className="text-xs text-destructive">{err}</p>}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm hover:bg-muted"
            >
              <X className="mr-1 h-3.5 w-3.5" /> Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Saving…" : draft.id ? "Save" : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}