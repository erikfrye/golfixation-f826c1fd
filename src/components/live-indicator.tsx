import { useRelativeTime } from "@/hooks/use-relative-time";

export function LiveIndicator({ lastUpdated }: { lastUpdated: Date }) {
  const relative = useRelativeTime(lastUpdated);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      Live · {relative}
    </span>
  );
}
