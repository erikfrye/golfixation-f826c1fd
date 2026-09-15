import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Download, Image as ImageIcon, Printer } from "lucide-react";
import { adminExportTournament } from "@/lib/admin.functions";
import { ScorecardSheet } from "@/components/export/scorecard-sheet";
import { exportFileBase, toCsv, type ExportPayload } from "@/lib/export-scorecard";

export const Route = createFileRoute("/admin/tournaments/$id_/export")({
  head: () => ({
    meta: [
      { title: "Export scores — Golfixation" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExportTournamentPage,
});

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ExportTournamentPage() {
  const { id } = Route.useParams();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin", "export", id],
    queryFn: () => adminExportTournament({ data: { id } }) as Promise<ExportPayload>,
  });

  const payload = q.data;

  const downloadCsv = () => {
    if (!payload) return;
    const csv = toCsv(payload);
    downloadBlob(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
      `${exportFileBase(payload.tournament)}.csv`,
    );
  };

  const downloadPng = async () => {
    if (!payload || !sheetRef.current) return;
    setBusy("png");
    setError(null);
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(sheetRef.current, {
        pixelRatio: 2,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
      });
      if (!blob) throw new Error("Could not create the image");
      downloadBlob(blob, `${exportFileBase(payload.tournament)}.png`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image download failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="print-export">
      <div className="no-print">
        <Link
          to="/admin/tournaments/$id"
          params={{ id }}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-foreground">Export scores</h1>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={downloadCsv}
              disabled={!payload}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Spreadsheet (CSV)
            </button>
            <button
              onClick={downloadPng}
              disabled={!payload || busy === "png"}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              <ImageIcon className="h-4 w-4" />
              {busy === "png" ? "Preparing…" : "Image (PNG)"}
            </button>
            <button
              onClick={() => window.print()}
              disabled={!payload}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Printer className="h-4 w-4" /> Print / Save as PDF
            </button>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {q.isLoading && <div className="h-40 animate-pulse rounded-lg bg-muted" />}
        {q.error && (
          <p className="text-sm text-destructive">
            {q.error instanceof Error ? q.error.message : "Could not load scores"}
          </p>
        )}
      </div>

      {payload && <ScorecardSheet payload={payload} innerRef={sheetRef} />}
    </div>
  );
}
