import { Flag } from "lucide-react";
import {
  buildScorecard,
  proximityWinners,
  type ExportPayload,
} from "@/lib/export-scorecard";

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ScorecardSheet({
  payload,
  innerRef,
}: {
  payload: ExportPayload;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  const card = buildScorecard(payload);
  const winners = proximityWinners(payload);
  const t = payload.tournament;
  const front = card.holeNumbers.slice(0, 9);
  const back = card.hasBackNine ? card.holeNumbers.slice(9) : [];

  const cell =
    "border border-border px-1.5 py-1 text-center text-[11px] tabular-nums sm:text-xs";
  const headCell =
    "border border-border bg-foreground px-1.5 py-1 text-center text-[11px] font-semibold text-background sm:text-xs";
  const totalCell = `${cell} bg-muted font-semibold`;

  return (
    <div
      ref={innerRef}
      className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5" />
          <span className="text-lg font-bold tracking-tight">Golfixation</span>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold leading-tight">{t.name}</p>
          <p className="text-[11px] opacity-90">
            {[t.location, formatDate(t.start_date)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto p-3">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${headCell} text-left`}>Team</th>
              {front.map((n) => (
                <th key={n} className={headCell}>
                  {n}
                </th>
              ))}
              <th className={headCell}>OUT</th>
              {card.hasBackNine && (
                <>
                  {back.map((n) => (
                    <th key={n} className={headCell}>
                      {n}
                    </th>
                  ))}
                  <th className={headCell}>IN</th>
                </>
              )}
              <th className={headCell}>GROSS</th>
            </tr>
            <tr>
              <th className={`${cell} bg-muted text-left font-semibold`}>Par</th>
              {card.pars.slice(0, 9).map((p, i) => (
                <td key={i} className={`${cell} bg-muted`}>
                  {p}
                </td>
              ))}
              <td className={totalCell}>{card.outPar}</td>
              {card.hasBackNine && (
                <>
                  {card.pars.slice(9).map((p, i) => (
                    <td key={i} className={`${cell} bg-muted`}>
                      {p}
                    </td>
                  ))}
                  <td className={totalCell}>{card.inPar}</td>
                </>
              )}
              <td className={totalCell}>{card.totalPar}</td>
            </tr>
          </thead>
          <tbody>
            {card.rows.map((r) => (
              <tr key={r.teamId}>
                <td className={`${cell} whitespace-nowrap text-left font-medium`}>
                  {r.name}
                </td>
                {r.strokes.slice(0, 9).map((s, i) => (
                  <td key={i} className={cell}>
                    {s ?? ""}
                  </td>
                ))}
                <td className={totalCell}>{r.out ?? ""}</td>
                {card.hasBackNine && (
                  <>
                    {r.strokes.slice(9).map((s, i) => (
                      <td key={i} className={cell}>
                        {s ?? ""}
                      </td>
                    ))}
                    <td className={totalCell}>{r.in ?? ""}</td>
                  </>
                )}
                <td className={totalCell}>{r.holesPlayed > 0 ? r.gross : ""}</td>
              </tr>
            ))}
            {card.rows.length === 0 && (
              <tr>
                <td className={`${cell} text-left`} colSpan={front.length + 3}>
                  No teams yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {winners.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Proximity contests
            </p>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={headCell}>Hole</th>
                  <th className={`${headCell} text-left`}>Contest</th>
                  <th className={`${headCell} text-left`}>Winner</th>
                  <th className={`${headCell} text-left`}>Team</th>
                </tr>
              </thead>
              <tbody>
                {winners.map((w) => (
                  <tr key={w.contestId}>
                    <td className={cell}>{w.holeNumber}</td>
                    <td className={`${cell} text-left`}>{w.contestName}</td>
                    <td className={`${cell} text-left font-medium`}>
                      {w.player ?? "—"}
                    </td>
                    <td className={`${cell} text-left`}>{w.team ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          Scored live with Golfixation · golfixation.com
        </p>
      </div>
    </div>
  );
}
