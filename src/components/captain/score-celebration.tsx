import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { TIER_LABEL, type CelebrationTier } from "@/lib/score-celebration";

type Props = {
  tier: CelebrationTier;
  onDone: () => void;
};

type Cfg = {
  durationMs: number;
  /** number of sunburst rays behind the word (0 = none) */
  rays: number;
  /** css color for rays */
  rayColor: string;
  /** text treatment class */
  textClass: string;
  /** gentle vs punchy entrance */
  mood: "hype" | "calm" | "sad";
};

const TIER_CONFIG: Record<CelebrationTier, Cfg> = {
  ace: {
    durationMs: 2400,
    rays: 20,
    rayColor: "#fde047",
    textClass: "wii-text-gold",
    mood: "hype",
  },
  albatross: {
    durationMs: 2100,
    rays: 18,
    rayColor: "#fcd34d",
    textClass: "wii-text-gold",
    mood: "hype",
  },
  eagle: {
    durationMs: 2000,
    rays: 16,
    rayColor: "#facc15",
    textClass: "wii-text-gold",
    mood: "hype",
  },
  birdie: {
    durationMs: 1800,
    rays: 14,
    rayColor: "#fde047",
    textClass: "wii-text-gold",
    mood: "hype",
  },
  par: {
    durationMs: 1400,
    rays: 0,
    rayColor: "transparent",
    textClass: "wii-text-white",
    mood: "calm",
  },
  bogey: {
    durationMs: 1500,
    rays: 0,
    rayColor: "transparent",
    textClass: "wii-text-ice",
    mood: "sad",
  },
  "double-bogey": {
    durationMs: 1600,
    rays: 0,
    rayColor: "transparent",
    textClass: "wii-text-ice",
    mood: "sad",
  },
  over: {
    durationMs: 1600,
    rays: 0,
    rayColor: "transparent",
    textClass: "wii-text-ice",
    mood: "sad",
  },
};

export function ScoreCelebration({ tier, onDone }: Props) {
  const cfg = TIER_CONFIG[tier];
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const rays = useMemo(
    () =>
      Array.from({ length: cfg.rays }, (_, i) => ({
        id: i,
        angle: (360 / Math.max(cfg.rays, 1)) * i + (i % 2 ? 4 : -4),
        length: 46 + (i % 3) * 22,
        delay: (i % 4) * 40,
      })),
    [cfg.rays],
  );

  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), cfg.durationMs);
    return () => clearTimeout(t);
  }, [tier, cfg.durationMs]);

  if (typeof document === "undefined") return null;

  const wordAnim =
    cfg.mood === "hype" ? "animate-wii-pop" : cfg.mood === "calm" ? "animate-wii-soft" : "animate-wii-sag";

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[100] grid place-items-center overflow-hidden"
      aria-live="polite"
      aria-label={`${TIER_LABEL[tier]} result`}
      onClick={() => doneRef.current()}
    >
      <div className="relative">
        {/* Sunburst rays */}
        {rays.length > 0 && (
          <div className="absolute left-1/2 top-1/2 h-0 w-0">
            {rays.map((r) => (
              <span
                key={r.id}
                className="absolute block origin-left rounded-full animate-wii-ray"
                style={{
                  width: r.length,
                  height: 6,
                  backgroundColor: cfg.rayColor,
                  transform: `rotate(${r.angle}deg) translateX(78px)`,
                  animationDelay: `${r.delay}ms`,
                }}
              />
            ))}
          </div>
        )}

        {/* The word */}
        <div
          className={`relative select-none whitespace-nowrap px-6 text-5xl font-black italic tracking-tight sm:text-7xl ${cfg.textClass} ${wordAnim}`}
        >
          {TIER_LABEL[tier]}
        </div>
      </div>
    </div>,
    document.body,
  );
}
