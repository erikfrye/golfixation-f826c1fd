import { useState } from "react";
import { Check, CloudOff, Loader2, RefreshCw, WifiOff, X } from "lucide-react";
import { useOfflineQueue } from "@/hooks/use-offline-queue";

export function SyncStatusPill({ teamId }: { teamId: string }) {
  const { items, syncing, online, queue } = useOfflineQueue(teamId);
  const [open, setOpen] = useState(false);

  const pendingCount = items.length;
  const failedCount = items.filter((i) => i.attempts >= 3).length;

  let label: string;
  let Icon = Check;
  let tone = "bg-muted text-muted-foreground";
  if (!online && pendingCount > 0) {
    label = `Offline · ${pendingCount} pending`;
    Icon = WifiOff;
    tone = "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  } else if (!online) {
    label = "Offline";
    Icon = WifiOff;
    tone = "bg-muted text-muted-foreground";
  } else if (syncing && pendingCount > 0) {
    label = `Syncing ${pendingCount}…`;
    Icon = Loader2;
    tone = "bg-primary/15 text-primary";
  } else if (failedCount > 0) {
    label = `${failedCount} failed — retry`;
    Icon = CloudOff;
    tone = "bg-destructive/15 text-destructive";
  } else if (pendingCount > 0) {
    label = `${pendingCount} pending`;
    Icon = Loader2;
    tone = "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  } else {
    label = "All synced";
    Icon = Check;
    tone = "bg-primary/10 text-primary";
  }

  const disabled = pendingCount === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${tone} ${
          disabled ? "cursor-default" : "cursor-pointer hover:opacity-90"
        }`}
        aria-label={label}
      >
        <Icon className={`h-3 w-3 ${syncing && Icon === Loader2 ? "animate-spin" : ""}`} />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-t-2xl bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Pending score saves</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">All scores synced.</p>
            ) : (
              <ul className="divide-y divide-border">
                {[...items]
                  .sort((a, b) => a.holeNumber - b.holeNumber)
                  .map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">
                          Hole {item.holeNumber} · {item.payload.strokes} strokes
                        </div>
                        {item.lastError ? (
                          <div className="truncate text-[11px] text-destructive">
                            {item.lastError}
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground">
                            Queued · {item.attempts > 0 ? `${item.attempts} attempt(s)` : "waiting"}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {item.attempts >= 3 ? "failed" : syncing ? "syncing" : "pending"}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => queue?.retryAll()}
                disabled={items.length === 0 || syncing}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}