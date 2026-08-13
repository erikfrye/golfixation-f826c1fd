import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { TIER_LABEL, type CelebrationTier } from "@/lib/score-celebration";

type Props = {
  tier: CelebrationTier;
  muted?: boolean;
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

function playSound(tier: CelebrationTier) {
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;

    const chirp = (start: number, freq: number, dur = 0.18, type: OscillatorType = "triangle", gain = 0.18) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.6, now + start + dur);
      g.gain.setValueAtTime(0, now + start);
      g.gain.linearRampToValueAtTime(gain, now + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    };

    const drop = (start: number, freq: number, dur = 0.5, gain = 0.16) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now + start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.35, now + start + dur);
      g.gain.setValueAtTime(0, now + start);
      g.gain.linearRampToValueAtTime(gain, now + start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    };

    switch (tier) {
      case "ace":
        chirp(0, 880);
        chirp(0.12, 1175);
        chirp(0.24, 1568);
        chirp(0.4, 1976, 0.4, "triangle", 0.22);
        break;
      case "albatross":
        chirp(0, 988);
        chirp(0.1, 1318);
        chirp(0.22, 1760, 0.3);
        break;
      case "eagle":
        chirp(0, 784);
        chirp(0.12, 1175, 0.24);
        break;
      case "birdie":
        chirp(0, 1046, 0.16);
        break;
      case "par":
        chirp(0, 660, 0.14, "sine", 0.12);
        break;
      case "bogey":
        drop(0, 260, 0.4);
        break;
      case "double-bogey":
      case "over":
        drop(0, 220);
        break;
    }

    setTimeout(() => ctx.close().catch(() => {}), 1400);
  } catch {
    // audio not available; silent fallback
  }
}

export function ScoreCelebration({ tier, muted, onDone }: Props) {
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
    const prefersReduced =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!muted && !prefersReduced) playSound(tier);

    const t = setTimeout(() => doneRef.current(), cfg.durationMs);
    return () => clearTimeout(t);
  }, [tier, muted, cfg.durationMs]);

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
