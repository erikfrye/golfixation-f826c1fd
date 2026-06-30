import type { SVGProps } from "react";

/**
 * A stylized flying bird with separate wing path so callers can animate
 * wings via CSS. `currentColor` themes the body; the wing inherits opacity.
 */
export function BirdSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* body */}
      <path
        d="M8 52 C 28 48, 46 50, 62 44 C 78 38, 92 36, 110 30 L 102 40 L 112 42 L 96 50 C 84 56, 70 58, 56 58 C 40 58, 22 58, 8 52 Z"
        fill="currentColor"
      />
      {/* eye */}
      <circle cx="104" cy="36" r="1.6" fill="#0b1020" />
      {/* beak */}
      <path d="M110 32 L 118 33 L 110 36 Z" fill="#f59e0b" />
      {/* wing — animated via .bird-wing */}
      <path
        className="bird-wing"
        d="M40 50 C 52 22, 76 22, 86 46 C 70 40, 54 42, 40 50 Z"
        fill="currentColor"
        opacity="0.82"
        style={{ transformOrigin: "63px 46px", transformBox: "fill-box" }}
      />
    </svg>
  );
}