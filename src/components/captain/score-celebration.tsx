import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { BirdSvg } from "./bird-svg";
import { TIER_LABEL, type CelebrationTier } from "@/lib/score-celebration";

type Props = {
  tier: CelebrationTier;
  muted?: boolean;
  onDone: () => void;
};

const TIER_CONFIG: Record<
  CelebrationTier,
  {
    durationMs: number;
    confettiCount: number;
    birdSize: number;
    badgeClass: string;
    confettiColors: string[];
    drop?: boolean;
  }
> = {
  ace: {
    durationMs: 2200,
    confettiCount: 60,
    birdSize: 180,
    badgeClass: "bg-amber-400 text-amber-950 ring-4 ring-amber-300/60",
    confettiColors: ["#fbbf24", "#f59e0b", "#fde68a", "#ffffff", "#eab308"],
  },
  albatross: {
    durationMs: 1900,
    confettiCount: 45,
    birdSize: 150,
    badgeClass: "bg-violet-500 text-white ring-4 ring-violet-300/50",
    confettiColors: ["#a78bfa", "#8b5cf6", "#c4b5fd", "#fbbf24"],
  },
  eagle: {
    durationMs: 1700,
    confettiCount: 35,
    birdSize: 130,
    badgeClass: "bg-primary text-primary-foreground ring-4 ring-primary/40",
    confettiColors: ["#10b981", "#34d399", "#a7f3d0", "#fbbf24"],
  },
  birdie: {
    durationMs: 1400,
    confettiCount: 20,
    birdSize: 100,
    badgeClass: "bg-primary text-primary-foreground ring-2 ring-primary/30",
    confettiColors: ["#10b981", "#34d399", "#a7f3d0"],
  },
  oof: {
    durationMs: 1100,
    confettiCount: 0,
    birdSize: 70,
    badgeClass: "bg-muted text-muted-foreground ring-2 ring-border",
    confettiColors: [],
    drop: true,
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
      case "oof":
        drop(0, 220);
        break;
    }

    // close once sounds finish to free resources
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    // audio not available; silent fallback
  }
}

export function ScoreCelebration({ tier, muted, onDone }: Props) {
  const cfg = TIER_CONFIG[tier];
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // Confetti pieces: pre-randomized once per mount so they don't reshuffle on re-render.
  const pieces = useMemo(() => {
    return Array.from({ length: cfg.confettiCount }, (_, i) => {
      const angle = (Math.random() - 0.5) * 140; // degrees spread
      const distance = 140 + Math.random() * 240; // px
      const rad = (angle - 90) * (Math.PI / 180);
      const tx = Math.cos(rad) * distance;
      const ty = Math.sin(rad) * distance;
      const rot = (Math.random() - 0.5) * 720;
      const color = cfg.confettiColors[i % cfg.confettiColors.length] ?? "#fbbf24";
      const delay = Math.random() * 120;
      const dur = 900 + Math.random() * 500;
      const size = 6 + Math.random() * 6;
      return { tx, ty, rot, color, delay, dur, size, id: i };
    });
  }, [cfg]);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!muted && !prefersReduced) playSound(tier);

    const t = setTimeout(() => doneRef.current(), cfg.durationMs);
    return () => clearTimeout(t);
  }, [tier, muted, cfg.durationMs]);

  if (typeof document === "undefined") return null;

  const birdAnimClass = cfg.drop ? "animate-bird-drop" : "animate-bird-fly";

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      aria-live="polite"
      aria-label={`${TIER_LABEL[tier]} celebration`}
      onClick={() => doneRef.current()}
    >
      {/* Badge */}
      <div
        className={`absolute left-1/2 top-[22%] -translate-x-1/2 rounded-full px-5 py-2 text-2xl font-extrabold tracking-widest shadow-xl animate-badge-pop ${cfg.badgeClass}`}
      >
        {TIER_LABEL[tier]}
      </div>

      {/* Bird */}
      <div
        className={`absolute ${cfg.drop ? "right-6 top-[55%]" : "left-0 top-1/2"} ${birdAnimClass}`}
        style={{
          width: cfg.birdSize,
          height: cfg.birdSize * (80 / 120),
          color: cfg.drop ? "var(--muted-foreground)" : "var(--primary)",
          animationDuration: `${cfg.durationMs}ms`,
        }}
      >
        <BirdSvg className="h-full w-full drop-shadow-md" />
      </div>

      {/* Confetti */}
      {pieces.length > 0 && (
        <div className="absolute left-1/2 top-[28%] h-0 w-0">
          {pieces.map((p) => (
            <span
              key={p.id}
              className="absolute block animate-confetti-burst"
              style={{
                width: p.size,
                height: p.size * 0.4,
                backgroundColor: p.color,
                borderRadius: 1,
                ["--tx" as string]: `${p.tx}px`,
                ["--ty" as string]: `${p.ty}px`,
                ["--rot" as string]: `${p.rot}deg`,
                animationDelay: `${p.delay}ms`,
                animationDuration: `${p.dur}ms`,
              }}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}