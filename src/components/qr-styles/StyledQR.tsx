"use client";

/**
 * StyledQR — QR seals where the QR CODE ITSELF is the ornament.
 *
 * Design philosophy:
 *  - The QR modules (dot-style, colored) ARE the decoration.
 *  - 5 circular variants (midnightGold, azureNeon, royalPurple, ivoryMono,
 *    imperialCrest) use a plain outer circle + curved arc text + optional
 *    heraldic centerpiece.
 *  - 1 scene variant (stellarNexus) breaks the circular constraint: the QR
 *    sits at the center of a SQUARE cosmic scene (nebula, stars, planets,
 *    orbital rings, radiant beams). The QR is the luminous "sun" — art
 *    communicates outward from it.
 *
 * Rendering:
 *  - Uses qr-code-styling (kozakdenys, MIT) which styles individual modules.
 *  - dotsOptions.type = "dots" | "rounded" | "extra-rounded" | "classy-rounded".
 *  - errorCorrectionLevel: "H" (30% redundancy — mandatory for colored modules).
 *
 * Variants:
 *  1. midnightGold  — black circle, gold modules (#d4af37), dots style.
 *  2. azureNeon     — navy circle, cyan radial gradient modules, extra-rounded.
 *  3. royalPurple   — dark purple circle, purple linear-gradient modules, classy-rounded.
 *  4. ivoryMono     — off-white circle, charcoal modules, dots style (daytime/print).
 *  5. imperialCrest — heraldic crest centerpiece, gold modules on royal blue.
 *  6. stellarNexus  — COSMIC SCENE: square frame, QR as stellar core, surrounded
 *                     by 6 planets on 3 orbital rings, 24 radiant beams, 5 nebula
 *                     cloud layers, 80+ star field, corona halo. Art outside the
 *                     QR composes with it — the QR is the atom, the scene is the
 *                     cosmos orbiting it.
 */

import React, { useEffect, useRef, useMemo, useId } from "react";

export type Variant =
  | "midnightGold"
  | "azureNeon"
  | "royalPurple"
  | "ivoryMono"
  | "imperialCrest"
  | "stellarNexus";

export type StyledQRProps = {
  value: string;
  variant: Variant;
  /** Curved text along the top arc inside the circle. */
  topText?: string;
  /** Curved text along the bottom arc inside the circle. */
  bottomText?: string;
  /** Outer diameter (or square side for scene variants) in px. Default 360. */
  size?: number;
};

type Theme = {
  background: string;       // circle/square fill
  backgroundGradient?: {    // optional bg gradient
    type: "radial" | "linear";
    from: string;
    to: string;
  };
  moduleColor: string;      // primary module color (used when no gradient)
  moduleGradient?: {
    type: "linear" | "radial";
    from: string;
    to: string;
    rotation?: number;
  };
  textColor: string;        // curved arc text
  defaultTop: string;
  defaultBottom: string;
  dotType: "dots" | "rounded" | "extra-rounded" | "classy" | "classy-rounded" | "square";
  cornerSquareType: "dot" | "square" | "extra-rounded";
  cornerDotType: "dot" | "square";
  fontFamily: string;
  letterSpacing: number;    // % of em
  /** Heraldic / brand emblem at center. qr-code-styling's `image` + `imageOptions`.
   *  sizeFraction must stay ≤ 0.45 at level H to preserve scan integrity. */
  centerImage?: {
    url: string;
    sizeFraction: number;   // 0-1, fraction of the QR matrix width
    margin: number;         // px of clear space carved around the image
  };
  /** Frame shape — "circle" is the default 5 variants. "scene" is a square
   *  frame with an inline SVG cosmic composition around the QR. */
  frameShape?: "circle" | "scene";
};

const THEMES: Record<Variant, Theme> = {
  midnightGold: {
    background: "#0a0a0a",
    moduleColor: "#d4af37",
    textColor: "#d4af37",
    defaultTop: "OPENTICKET",
    defaultBottom: "SCAN ME",
    dotType: "dots",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    fontFamily: "Georgia, 'Times New Roman', serif",
    letterSpacing: 8,
    centerImage: {
      url: "/qr-emblems/openticket-monogram-deco.svg",
      sizeFraction: 0.38,
      margin: 5,
    },
  },
  azureNeon: {
    background: "#0a1128",
    moduleColor: "#00d9ff",
    moduleGradient: {
      type: "radial",
      from: "#5ce1e6",
      to: "#00d9ff",
    },
    textColor: "#7ee8f0",
    defaultTop: "SCAN TO ENTER",
    defaultBottom: "OPENTICKET",
    dotType: "extra-rounded",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    fontFamily: "'Inter', -apple-system, sans-serif",
    letterSpacing: 6,
    centerImage: {
      url: "/qr-emblems/openticket-circuit-neon.svg",
      sizeFraction: 0.36,
      margin: 5,
    },
  },
  royalPurple: {
    background: "#1a0a2e",
    moduleColor: "#a855f7",
    moduleGradient: {
      type: "linear",
      from: "#a855f7",
      to: "#6366f1",
      rotation: Math.PI / 4,
    },
    textColor: "#c4a7f7",
    defaultTop: "SPACESHIP FEST",
    defaultBottom: "MMXXVI",
    dotType: "classy-rounded",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    fontFamily: "Georgia, 'Times New Roman', serif",
    letterSpacing: 7,
    centerImage: {
      url: "/qr-emblems/openticket-cosmic-nebula.svg",
      sizeFraction: 0.4,
      margin: 4,
    },
  },
  ivoryMono: {
    background: "#faf7f0",
    moduleColor: "#1a1a1a",
    textColor: "#1a1a1a",
    defaultTop: "OPENTICKET",
    defaultBottom: "PREMIUM ACCESS",
    dotType: "dots",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    fontFamily: "Georgia, 'Times New Roman', serif",
    letterSpacing: 8,
    centerImage: {
      url: "/qr-emblems/openticket-tech-minimal.svg",
      sizeFraction: 0.36,
      margin: 6,
    },
  },
  imperialCrest: {
    background: "#0a1f4a",
    backgroundGradient: {
      type: "radial",
      from: "#1e3a7a",
      to: "#050e2a",
    },
    moduleColor: "#d4af37",
    moduleGradient: {
      type: "linear",
      from: "#f8e29a",
      to: "#b8941e",
      rotation: Math.PI / 2,
    },
    textColor: "#f4d47c",
    defaultTop: "OPENTICKET",
    defaultBottom: "ROYAL EDITION",
    dotType: "dots",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    fontFamily: "'Cinzel', 'Trajan Pro', Georgia, serif",
    letterSpacing: 9,
    centerImage: {
      url: "/qr-emblems/openticket-crest.svg",
      sizeFraction: 0.42,
      margin: 6,
    },
  },
  stellarNexus: {
    background: "#030010",
    moduleColor: "#f4d47c",
    moduleGradient: {
      type: "linear",
      from: "#f8e29a",
      to: "#5ce1e6",
      rotation: Math.PI / 4,
    },
    textColor: "#9ce5ff",
    defaultTop: "OPENTICKET",
    defaultBottom: "STELLAR EDITION",
    dotType: "dots",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    fontFamily: "'Inter', -apple-system, sans-serif",
    letterSpacing: 7,
    frameShape: "scene",
    // No centerImage — the QR itself is the luminous star. The scene surrounds it.
  },
};

/** ────────────────────────────────────────────────────────────────────────
 *  Inner QR renderer — uses qr-code-styling via ref + effect.
 *  The library is vanilla JS and touches `document`, so we keep it client-side
 *  and dynamic-import in the effect (avoids Next.js SSR bundling).
 *  ──────────────────────────────────────────────────────────────────────── */
function QRCanvas({
  value,
  size,
  theme,
}: {
  value: string;
  size: number;
  theme: Theme;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("qr-code-styling");
      if (cancelled) return;
      const QRCodeStyling = mod.default;
      const container = ref.current;
      if (!container) return;

      // Build dotsOptions — gradient if set, solid color otherwise.
      const dotsOptions: Record<string, unknown> = {
        type: theme.dotType,
      };
      if (theme.moduleGradient) {
        dotsOptions.gradient = {
          type: theme.moduleGradient.type,
          rotation: theme.moduleGradient.rotation ?? 0,
          colorStops: [
            { offset: 0, color: theme.moduleGradient.from },
            { offset: 1, color: theme.moduleGradient.to },
          ],
        };
      } else {
        dotsOptions.color = theme.moduleColor;
      }

      const cfg: Record<string, unknown> = {
        width: size,
        height: size,
        type: "svg",
        data: value,
        margin: 0,
        qrOptions: {
          typeNumber: 0,
          mode: "Byte",
          errorCorrectionLevel: "H",
        },
        dotsOptions,
        backgroundOptions: {
          color: "transparent",
        },
        cornersSquareOptions: {
          type: theme.cornerSquareType,
          color: theme.moduleColor,
        },
        cornersDotOptions: {
          type: theme.cornerDotType,
          color: theme.moduleColor,
        },
      };

      // Heraldic / brand centerpiece (imperialCrest + any variant that defines centerImage)
      if (theme.centerImage) {
        cfg.image = theme.centerImage.url;
        cfg.imageOptions = {
          hideBackgroundDots: true,
          imageSize: theme.centerImage.sizeFraction,
          margin: theme.centerImage.margin,
          crossOrigin: "anonymous",
        };
      }

      const qr = new QRCodeStyling(cfg as never);

      container.innerHTML = "";
      qr.append(container);
    })();
    return () => {
      cancelled = true;
    };
  }, [value, size, theme]);

  return (
    <div
      ref={ref}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    />
  );
}

/** ────────────────────────────────────────────────────────────────────────
 *  Curved arc text — one top arc, one bottom arc.
 *  Used by both the circular frame (inside the circle) and the scene frame
 *  (around the QR core, on the orbital text band).
 *  ──────────────────────────────────────────────────────────────────────── */
function ArcText({
  text,
  radius,
  center,
  side,
  fill,
  fontFamily,
  fontSize,
  letterSpacing,
  pathId,
}: {
  text: string;
  radius: number;
  center: number;
  side: "top" | "bottom";
  fill: string;
  fontFamily: string;
  fontSize: number;
  letterSpacing: number;
  pathId: string;
}) {
  // Arc path from left to right. For top: clockwise (sweep=1). For bottom: counter-clockwise.
  const d =
    side === "top"
      ? `M ${center - radius},${center} A ${radius},${radius} 0 0,1 ${center + radius},${center}`
      : `M ${center - radius},${center} A ${radius},${radius} 0 0,0 ${center + radius},${center}`;

  return (
    <>
      <path id={pathId} d={d} fill="none" stroke="none" />
      <text
        fontFamily={fontFamily}
        fontSize={fontSize}
        fontWeight={700}
        fill={fill}
        letterSpacing={letterSpacing}
      >
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {text}
        </textPath>
      </text>
    </>
  );
}

/** ────────────────────────────────────────────────────────────────────────
 *  StellarNexusScene — inline SVG cosmic composition.
 *
 *  Drawn as a unit square (viewBox 0 0 1000 1000) then scaled to `size`.
 *  The central 45% is reserved (carved out) for the QR core — no stars or
 *  dense nebula there. The QR will be rendered on top of this SVG.
 *
 *  Layers (back → front):
 *   1. Deep space backdrop (radial gradient cyan → purple → black)
 *   2. Nebula cloud layers (5 soft blobs)
 *   3. Star field (80+ stars of varying size/color, feature stars with glow)
 *   4. Radiant beams (24 rays at 15° intervals from center)
 *   5. Orbital rings (3 tilted ellipses)
 *   6. Planets (6 bodies on the orbital rings)
 *   7. Central corona (luminous halo behind the QR)
 *   8. Vignette (corner darkening)
 *  ──────────────────────────────────────────────────────────────────────── */
function StellarNexusScene({ size, uid }: { size: number; uid: string }) {
  // Deterministic pseudo-random star field (based on index, no Math.random to
  // keep SSR/CSR output identical and avoid hydration mismatches).
  const starField = useMemo(() => {
    const stars: Array<{
      cx: number;
      cy: number;
      r: number;
      color: string;
      opacity: number;
    }> = [];
    // 80 background stars, carve out central 45% (200px radius around 500,500)
    const mix = ["#ffffff", "#9ce5ff", "#f4d47c"];
    let i = 0;
    // Simple deterministic "hash" — 80 positions via golden-ratio distribution
    // across the square minus central exclusion zone.
    const gr = 2.39996; // golden angle in radians
    while (stars.length < 80 && i < 500) {
      // Fibonacci spiral sampled out of the full-frame square
      const t = (i + 0.5) / 200;
      const angle = i * gr;
      const radius = 480 * Math.sqrt(t); // 0..480px from center
      const cx = 500 + radius * Math.cos(angle);
      const cy = 500 + radius * Math.sin(angle);
      i += 1;
      // Skip if inside central carve-out (45% of frame = 225px radius)
      const dx = cx - 500;
      const dy = cy - 500;
      if (dx * dx + dy * dy < 225 * 225) continue;
      // Skip if outside the frame
      if (cx < 10 || cx > 990 || cy < 10 || cy > 990) continue;
      const sizeRand = ((i * 37) % 100) / 100;
      const r = 0.5 + sizeRand * 2.0; // 0.5 .. 2.5
      const opacityRand = ((i * 53) % 100) / 100;
      const opacity = 0.3 + opacityRand * 0.7;
      const colorIdx = i % 3;
      stars.push({ cx, cy, r, color: mix[colorIdx], opacity });
    }
    return stars;
  }, []);

  // 4-point "feature" stars with glow — placed in aesthetically pleasing
  // positions on the outer ring, well clear of the central QR.
  const featureStars = useMemo(
    () => [
      { cx: 180, cy: 210, r: 4 },
      { cx: 840, cy: 260, r: 3.5 },
      { cx: 160, cy: 780, r: 3 },
      { cx: 820, cy: 820, r: 4.5 },
      { cx: 500, cy: 90, r: 3.2 },
    ],
    []
  );

  // 24 radiant beams at 15° intervals
  const beams = useMemo(() => {
    const arr: Array<{ angle: number; length: number; opacity: number }> = [];
    for (let k = 0; k < 24; k += 1) {
      const angle = k * 15;
      // Alternate slightly so organic variation (odd beams are 5% longer)
      const length = k % 2 === 0 ? 380 : 400;
      const opacity = 0.3 + ((k * 17) % 5) * 0.08; // 0.3..0.62
      arr.push({ angle, length, opacity });
    }
    return arr;
  }, []);

  // 6 planets placed at aesthetic clock positions on the orbital rings.
  // Coordinates chosen so they visually orbit without overlap.
  const planets = useMemo(
    () => ({
      ice: { cx: 250, cy: 310, r: 14 },       // upper-left
      gasGiant: { cx: 825, cy: 530, r: 22 },  // right
      rockyRed: { cx: 760, cy: 790, r: 10 },  // lower-right
      greenEarth: { cx: 220, cy: 730, r: 13 },// lower-left
      yellowCrystal: { cx: 790, cy: 190, r: 9 }, // upper-right
      distantMoon: { cx: 500, cy: 140, r: 5 },// upper-center
    }),
    []
  );

  // Unique IDs for gradients/filters so multiple scenes on the page don't clash
  const ids = useMemo(
    () => ({
      bg: `sn-bg-${uid}`,
      neb1: `sn-neb1-${uid}`,
      neb2: `sn-neb2-${uid}`,
      neb3: `sn-neb3-${uid}`,
      neb4: `sn-neb4-${uid}`,
      neb5: `sn-neb5-${uid}`,
      beam: `sn-beam-${uid}`,
      corona: `sn-corona-${uid}`,
      vignette: `sn-vignette-${uid}`,
      glow: `sn-glow-${uid}`,
      ice: `sn-ice-${uid}`,
      gas1: `sn-gas1-${uid}`,
      gas2: `sn-gas2-${uid}`,
      gas3: `sn-gas3-${uid}`,
      rocky: `sn-rocky-${uid}`,
      green: `sn-green-${uid}`,
      crystal: `sn-crystal-${uid}`,
      moon: `sn-moon-${uid}`,
      clipIce: `sn-clip-ice-${uid}`,
      clipGas: `sn-clip-gas-${uid}`,
      clipGreen: `sn-clip-green-${uid}`,
      clipRocky: `sn-clip-rocky-${uid}`,
    }),
    [uid]
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1000 1000"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <defs>
        {/* 1. Deep-space radial backdrop */}
        <radialGradient id={ids.bg} cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="#7ee8f0" stopOpacity="0.1" />
          <stop offset="45%" stopColor="#2a0a4a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#030010" stopOpacity="1" />
        </radialGradient>

        {/* 2. Nebula blobs — 5 layers */}
        <radialGradient id={ids.neb1} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6a3fb5" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#6a3fb5" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#6a3fb5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.neb2} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c23ba3" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#c23ba3" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.neb3} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2da8a8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#2da8a8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.neb4} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3f5fcf" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#3f5fcf" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ids.neb5} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff6ecf" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ff6ecf" stopOpacity="0" />
        </radialGradient>

        {/* Radiant beam gradient (cyan → transparent) */}
        <linearGradient id={ids.beam} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#5ce1e6" stopOpacity="0.85" />
          <stop offset="40%" stopColor="#00d9ff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#00d9ff" stopOpacity="0" />
        </linearGradient>

        {/* Central corona — behind the QR, makes it look luminous like a star */}
        <radialGradient id={ids.corona} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="25%" stopColor="#9ce5ff" stopOpacity="0.4" />
          <stop offset="55%" stopColor="#5ce1e6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#030010" stopOpacity="0" />
        </radialGradient>

        {/* Vignette — corner darkening */}
        <radialGradient id={ids.vignette} cx="50%" cy="50%" r="75%">
          <stop offset="60%" stopColor="#030010" stopOpacity="0" />
          <stop offset="100%" stopColor="#030010" stopOpacity="0.9" />
        </radialGradient>

        {/* Feature star glow filter */}
        <filter id={ids.glow} x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Planet gradients + clipPaths */}
        <radialGradient id={ids.ice} cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#eaf6ff" />
          <stop offset="50%" stopColor="#c8e8ff" />
          <stop offset="100%" stopColor="#3a78c0" />
        </radialGradient>
        <linearGradient id={ids.gas1} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8b4d9e" />
          <stop offset="100%" stopColor="#6a3faf" />
        </linearGradient>
        <linearGradient id={ids.gas2} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c23ba3" />
          <stop offset="100%" stopColor="#8b4d9e" />
        </linearGradient>
        <linearGradient id={ids.gas3} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6a3faf" />
          <stop offset="100%" stopColor="#3f1f6a" />
        </linearGradient>
        <radialGradient id={ids.rocky} cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#ffcea8" />
          <stop offset="55%" stopColor="#ff8a5e" />
          <stop offset="100%" stopColor="#8b3a1e" />
        </radialGradient>
        <radialGradient id={ids.green} cx="40%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#6cc380" />
          <stop offset="60%" stopColor="#3d8948" />
          <stop offset="100%" stopColor="#1c4a2a" />
        </radialGradient>
        <radialGradient id={ids.crystal} cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#fff3c0" />
          <stop offset="50%" stopColor="#f8e29a" />
          <stop offset="100%" stopColor="#b8941e" />
        </radialGradient>
        <radialGradient id={ids.moon} cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#dcdce4" />
          <stop offset="100%" stopColor="#8e8e96" />
        </radialGradient>

        {/* Planet clipPaths for band/ocean overlays */}
        <clipPath id={ids.clipIce}>
          <circle cx={planets.ice.cx} cy={planets.ice.cy} r={planets.ice.r} />
        </clipPath>
        <clipPath id={ids.clipGas}>
          <circle cx={planets.gasGiant.cx} cy={planets.gasGiant.cy} r={planets.gasGiant.r} />
        </clipPath>
        <clipPath id={ids.clipGreen}>
          <circle cx={planets.greenEarth.cx} cy={planets.greenEarth.cy} r={planets.greenEarth.r} />
        </clipPath>
        <clipPath id={ids.clipRocky}>
          <circle cx={planets.rockyRed.cx} cy={planets.rockyRed.cy} r={planets.rockyRed.r} />
        </clipPath>
      </defs>

      {/* Layer 1 — deep-space backdrop */}
      <rect x="0" y="0" width="1000" height="1000" fill={`url(#${ids.bg})`} />

      {/* Layer 2 — nebula clouds (5 blobs) */}
      <circle cx="230" cy="250" r="350" fill={`url(#${ids.neb1})`} opacity="0.75" />
      <circle cx="790" cy="230" r="260" fill={`url(#${ids.neb2})`} opacity="0.7" />
      <circle cx="210" cy="780" r="280" fill={`url(#${ids.neb3})`} opacity="0.7" />
      <circle cx="800" cy="790" r="330" fill={`url(#${ids.neb4})`} opacity="0.75" />
      <circle cx="500" cy="150" r="180" fill={`url(#${ids.neb5})`} opacity="0.6" />

      {/* Layer 3 — star field (80 background stars) */}
      {starField.map((s, idx) => (
        <circle
          key={`s-${idx}`}
          cx={s.cx}
          cy={s.cy}
          r={s.r}
          fill={s.color}
          opacity={s.opacity}
        />
      ))}
      {/* Feature stars with 4-point glow cross */}
      {featureStars.map((s, idx) => (
        <g key={`fs-${idx}`} filter={`url(#${ids.glow})`} opacity="0.9">
          <circle cx={s.cx} cy={s.cy} r={s.r} fill="#ffffff" />
          {/* 4-point cross using thin rects */}
          <rect
            x={s.cx - s.r * 4}
            y={s.cy - 0.5}
            width={s.r * 8}
            height="1"
            fill="#ffffff"
            opacity="0.85"
          />
          <rect
            x={s.cx - 0.5}
            y={s.cy - s.r * 4}
            width="1"
            height={s.r * 8}
            fill="#ffffff"
            opacity="0.85"
          />
        </g>
      ))}

      {/* Layer 4 — 24 radiant beams emanating from center.
          Each beam is a thin triangular shape drawn along the positive X axis
          and rotated into position around (500,500). */}
      <g transform="translate(500 500)" opacity="0.75">
        {beams.map((b, idx) => (
          <g key={`beam-${idx}`} transform={`rotate(${b.angle})`}>
            <polygon
              points={`130,-2 ${130 + b.length},-0.5 ${130 + b.length},0.5 130,2`}
              fill={`url(#${ids.beam})`}
              opacity={b.opacity}
            />
          </g>
        ))}
      </g>

      {/* Layer 5 — 3 orbital rings (tilted ellipses), centered on 500,500.
          Each passes outside the central QR circle (radius ~225). */}
      <g
        fill="none"
        stroke="#5ce1e6"
        strokeOpacity="0.3"
        strokeWidth="0.9"
      >
        <ellipse
          cx="500"
          cy="500"
          rx="360"
          ry="300"
          transform="rotate(15 500 500)"
        />
        <ellipse
          cx="500"
          cy="500"
          rx="390"
          ry="270"
          transform="rotate(-25 500 500)"
        />
        <ellipse
          cx="500"
          cy="500"
          rx="340"
          ry="320"
          transform="rotate(40 500 500)"
        />
      </g>

      {/* Layer 6 — 6 planets */}
      {/* a) Ice planet — upper-left, with ice ring */}
      <g>
        <circle
          cx={planets.ice.cx}
          cy={planets.ice.cy}
          r={planets.ice.r}
          fill={`url(#${ids.ice})`}
        />
        {/* shadow overlay */}
        <circle
          cx={planets.ice.cx + 4}
          cy={planets.ice.cy + 3}
          r={planets.ice.r}
          fill="#030010"
          opacity="0.3"
          clipPath={`url(#${ids.clipIce})`}
        />
        {/* thin tilted ice ring */}
        <ellipse
          cx={planets.ice.cx}
          cy={planets.ice.cy}
          rx={planets.ice.r * 1.8}
          ry={planets.ice.r * 0.5}
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.55"
          strokeWidth="1"
          transform={`rotate(-20 ${planets.ice.cx} ${planets.ice.cy})`}
        />
      </g>

      {/* b) Gas giant — right, with horizontal bands + moon */}
      <g>
        <circle
          cx={planets.gasGiant.cx}
          cy={planets.gasGiant.cy}
          r={planets.gasGiant.r}
          fill={`url(#${ids.gas1})`}
        />
        {/* Band overlays clipped to the planet circle */}
        <g clipPath={`url(#${ids.clipGas})`}>
          <ellipse
            cx={planets.gasGiant.cx}
            cy={planets.gasGiant.cy - 6}
            rx={planets.gasGiant.r + 2}
            ry="3"
            fill={`url(#${ids.gas2})`}
            opacity="0.9"
          />
          <ellipse
            cx={planets.gasGiant.cx}
            cy={planets.gasGiant.cy + 4}
            rx={planets.gasGiant.r + 2}
            ry="4"
            fill={`url(#${ids.gas3})`}
            opacity="0.85"
          />
          <ellipse
            cx={planets.gasGiant.cx}
            cy={planets.gasGiant.cy + 12}
            rx={planets.gasGiant.r + 2}
            ry="2.5"
            fill="#4f2a8a"
            opacity="0.7"
          />
        </g>
        {/* shadow */}
        <circle
          cx={planets.gasGiant.cx + 6}
          cy={planets.gasGiant.cy + 4}
          r={planets.gasGiant.r}
          fill="#030010"
          opacity="0.3"
          clipPath={`url(#${ids.clipGas})`}
        />
        {/* small moon */}
        <circle
          cx={planets.gasGiant.cx + 36}
          cy={planets.gasGiant.cy - 14}
          r="3.5"
          fill="#dcdce4"
        />
      </g>

      {/* c) Rocky red — lower-right, with craters */}
      <g>
        <circle
          cx={planets.rockyRed.cx}
          cy={planets.rockyRed.cy}
          r={planets.rockyRed.r}
          fill={`url(#${ids.rocky})`}
        />
        {/* shadow */}
        <circle
          cx={planets.rockyRed.cx + 3}
          cy={planets.rockyRed.cy + 2}
          r={planets.rockyRed.r}
          fill="#030010"
          opacity="0.3"
          clipPath={`url(#${ids.clipRocky})`}
        />
        {/* craters */}
        <circle
          cx={planets.rockyRed.cx - 3}
          cy={planets.rockyRed.cy - 2}
          r="1.5"
          fill="#5a2814"
          opacity="0.8"
        />
        <circle
          cx={planets.rockyRed.cx + 2}
          cy={planets.rockyRed.cy + 3}
          r="1.2"
          fill="#5a2814"
          opacity="0.75"
        />
      </g>

      {/* d) Green earth-like — lower-left, oceans + continents */}
      <g>
        <circle
          cx={planets.greenEarth.cx}
          cy={planets.greenEarth.cy}
          r={planets.greenEarth.r}
          fill="#2a5ea8"
        />
        {/* continent blobs clipped to planet */}
        <g clipPath={`url(#${ids.clipGreen})`}>
          <ellipse
            cx={planets.greenEarth.cx - 4}
            cy={planets.greenEarth.cy - 3}
            rx="7"
            ry="5"
            fill="#3d8948"
            opacity="0.95"
          />
          <ellipse
            cx={planets.greenEarth.cx + 5}
            cy={planets.greenEarth.cy + 4}
            rx="5"
            ry="3.5"
            fill="#3d8948"
            opacity="0.95"
          />
          <ellipse
            cx={planets.greenEarth.cx + 3}
            cy={planets.greenEarth.cy - 6}
            rx="3"
            ry="2"
            fill="#6cc380"
            opacity="0.9"
          />
        </g>
        {/* shadow */}
        <circle
          cx={planets.greenEarth.cx + 4}
          cy={planets.greenEarth.cy + 3}
          r={planets.greenEarth.r}
          fill="#030010"
          opacity="0.32"
          clipPath={`url(#${ids.clipGreen})`}
        />
      </g>

      {/* e) Yellow crystal — upper-right, with white highlight wedge */}
      <g>
        <circle
          cx={planets.yellowCrystal.cx}
          cy={planets.yellowCrystal.cy}
          r={planets.yellowCrystal.r}
          fill={`url(#${ids.crystal})`}
        />
        {/* highlight wedge */}
        <path
          d={`M ${planets.yellowCrystal.cx - 3} ${planets.yellowCrystal.cy - 5}
              Q ${planets.yellowCrystal.cx - 6} ${planets.yellowCrystal.cy - 2}
                ${planets.yellowCrystal.cx - 4} ${planets.yellowCrystal.cy + 2}
              Q ${planets.yellowCrystal.cx - 2} ${planets.yellowCrystal.cy - 2}
                ${planets.yellowCrystal.cx - 3} ${planets.yellowCrystal.cy - 5} Z`}
          fill="#ffffff"
          opacity="0.4"
        />
        {/* shadow */}
        <circle
          cx={planets.yellowCrystal.cx + 2.5}
          cy={planets.yellowCrystal.cy + 2}
          r={planets.yellowCrystal.r}
          fill="#030010"
          opacity="0.28"
        />
      </g>

      {/* f) Distant moon — upper-center */}
      <g>
        <circle
          cx={planets.distantMoon.cx}
          cy={planets.distantMoon.cy}
          r={planets.distantMoon.r}
          fill={`url(#${ids.moon})`}
        />
        {/* shadow */}
        <circle
          cx={planets.distantMoon.cx + 1.5}
          cy={planets.distantMoon.cy + 1}
          r={planets.distantMoon.r}
          fill="#030010"
          opacity="0.3"
        />
      </g>

      {/* Layer 7 — central corona halo (behind the QR) */}
      <circle
        cx="500"
        cy="500"
        r="270"
        fill={`url(#${ids.corona})`}
        opacity="0.95"
      />

      {/* Dark backing circle for QR matrix — guarantees contrast of the
          cyan-gold modules against deep space. Slightly larger than the QR. */}
      <circle
        cx="500"
        cy="500"
        r="218"
        fill="#030010"
        opacity="0.85"
      />

      {/* Thin "atomic" orbital ring — the boundary where the corona ends */}
      <circle
        cx="500"
        cy="500"
        r="232"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />

      {/* Layer 8 — vignette corner darkening */}
      <rect x="0" y="0" width="1000" height="1000" fill={`url(#${ids.vignette})`} />
    </svg>
  );
}

/** ────────────────────────────────────────────────────────────────────────
 *  StellarNexusFrame — the square cosmic frame that wraps the QR.
 *  The QR is rendered at 58% of outer size at the center, with arc text
 *  curved around its circular band.
 *  ──────────────────────────────────────────────────────────────────────── */
function StellarNexusFrame({
  value,
  size,
  theme,
  topText,
  bottomText,
  uid,
}: {
  value: string;
  size: number;
  theme: Theme;
  topText?: string;
  bottomText?: string;
  uid: string;
}) {
  const center = size / 2;
  const qrSize = Math.round(size * 0.58);
  const arcRadius = size * 0.32; // curved text sits on the QR's "orbital" band
  const fontSize = Math.max(11, Math.round(size * 0.036));

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: 18,
        overflow: "hidden",
        background: theme.background,
        boxShadow:
          "inset 0 0 0 1px rgba(92,225,230,0.18), 0 12px 48px rgba(92,225,230,0.18), 0 8px 32px rgba(0,0,0,0.6)",
      }}
    >
      {/* Cosmic scene behind everything */}
      <StellarNexusScene size={size} uid={uid} />

      {/* QR matrix — centered on the luminous core */}
      <div
        style={{
          position: "absolute",
          top: (size - qrSize) / 2,
          left: (size - qrSize) / 2,
          width: qrSize,
          height: qrSize,
          zIndex: 2,
        }}
      >
        <QRCanvas value={value} size={qrSize} theme={theme} />
      </div>

      {/* Curved arc text on top of the QR orbital band */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 3,
        }}
      >
        <ArcText
          pathId={`sn-top-${uid}`}
          text={topText ?? theme.defaultTop}
          radius={arcRadius}
          center={center}
          side="top"
          fill={theme.textColor}
          fontFamily={theme.fontFamily}
          fontSize={fontSize}
          letterSpacing={theme.letterSpacing}
        />
        <ArcText
          pathId={`sn-bot-${uid}`}
          text={bottomText ?? theme.defaultBottom}
          radius={arcRadius}
          center={center}
          side="bottom"
          fill={theme.textColor}
          fontFamily={theme.fontFamily}
          fontSize={fontSize}
          letterSpacing={theme.letterSpacing}
        />
      </svg>
    </div>
  );
}

/** ────────────────────────────────────────────────────────────────────────
 *  StyledQR — public component.
 *  Layout:
 *    • Circular variants (default): outer circle with QR + arc text inside.
 *    • Scene variants (stellarNexus): square frame with cosmic SVG + QR core.
 *  ──────────────────────────────────────────────────────────────────────── */
export function StyledQR({
  value,
  variant,
  topText,
  bottomText,
  size = 360,
}: StyledQRProps): React.JSX.Element {
  const theme = THEMES[variant];
  const uid = useId().replace(/:/g, "");
  const memoTheme = useMemo(() => theme, [theme]);

  // Route to the scene frame for stellarNexus (and future scene variants)
  if (theme.frameShape === "scene") {
    return (
      <StellarNexusFrame
        value={value}
        size={size}
        theme={memoTheme}
        topText={topText}
        bottomText={bottomText}
        uid={uid}
      />
    );
  }

  // Default circular frame (midnightGold, azureNeon, royalPurple, ivoryMono, imperialCrest)
  const center = size / 2;
  const qrSize = Math.round(size * 0.78);
  const arcRadius = size * 0.44; // radius of the curved-text circle (near inner edge)
  const fontSize = Math.max(11, Math.round(size * 0.038));

  const bgStyle = theme.backgroundGradient
    ? theme.backgroundGradient.type === "radial"
      ? `radial-gradient(circle at 50% 40%, ${theme.backgroundGradient.from}, ${theme.backgroundGradient.to})`
      : `linear-gradient(135deg, ${theme.backgroundGradient.from}, ${theme.backgroundGradient.to})`
    : theme.background;

  // Per-variant decorative ring
  const ringByVariant: Partial<Record<Variant, string>> = {
    imperialCrest:
      "inset 0 0 0 3px #d4af37, inset 0 0 0 5px #8b6914, inset 0 0 0 7px #d4af37, 0 12px 48px rgba(212,175,55,0.2), 0 8px 32px rgba(0,0,0,0.55)",
    midnightGold:
      "inset 0 0 0 2px #d4af37, inset 0 0 0 3px #8b6914, inset 0 0 0 5px #d4af37, 0 10px 40px rgba(212,175,55,0.18), 0 8px 32px rgba(0,0,0,0.5)",
    azureNeon:
      "inset 0 0 0 2px #00d9ff, 0 0 20px rgba(0,217,255,0.4), 0 8px 32px rgba(0,0,0,0.5)",
    royalPurple:
      "inset 0 0 0 1.5px #a855f7, 0 0 24px rgba(168,85,247,0.35), 0 8px 32px rgba(0,0,0,0.45)",
    ivoryMono:
      "inset 0 0 0 1px rgba(26,26,26,0.3), 0 8px 32px rgba(0,0,0,0.08)",
  };
  const ringStyle = ringByVariant[variant];

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        background: bgStyle,
        overflow: "hidden",
        boxShadow: ringStyle,
      }}
    >
      {/* Curved arc text layer */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        <ArcText
          pathId={`top-${uid}`}
          text={topText ?? theme.defaultTop}
          radius={arcRadius}
          center={center}
          side="top"
          fill={theme.textColor}
          fontFamily={theme.fontFamily}
          fontSize={fontSize}
          letterSpacing={theme.letterSpacing}
        />
        <ArcText
          pathId={`bot-${uid}`}
          text={bottomText ?? theme.defaultBottom}
          radius={arcRadius}
          center={center}
          side="bottom"
          fill={theme.textColor}
          fontFamily={theme.fontFamily}
          fontSize={fontSize}
          letterSpacing={theme.letterSpacing}
        />
      </svg>

      {/* QR matrix layer — centered, with quiet zone aligned to arc band */}
      <div
        style={{
          position: "absolute",
          top: (size - qrSize) / 2,
          left: (size - qrSize) / 2,
          width: qrSize,
          height: qrSize,
          zIndex: 1,
        }}
      >
        <QRCanvas value={value} size={qrSize} theme={memoTheme} />
      </div>
    </div>
  );
}

export const STYLED_QR_VARIANTS: Array<{
  key: Variant;
  name: string;
  tagline: string;
  darkModeReadable: "excellent" | "good" | "fair";
}> = [
  {
    key: "midnightGold",
    name: "Midnight Gold",
    tagline: "Monograma art deco · sunburst de 24 raios · triplo anel dourado",
    darkModeReadable: "excellent",
  },
  {
    key: "azureNeon",
    name: "Azure Neon",
    tagline: "Circuito cyberpunk · hexagono ciano + LEDs + solder pads",
    darkModeReadable: "excellent",
  },
  {
    key: "royalPurple",
    name: "Royal Purple",
    tagline: "Nebula cosmica · planeta roxo + 3 orbitas + constelacao dourada",
    darkModeReadable: "excellent",
  },
  {
    key: "ivoryMono",
    name: "Ivory Mono",
    tagline: "Monograma minimalista · grid blueprint + compasso architectural",
    darkModeReadable: "excellent",
  },
  {
    key: "imperialCrest",
    name: "Imperial Crest",
    tagline: "Brasao heraldico · coroa + escudo OT + ramos de louro · ouro sobre azul real",
    darkModeReadable: "excellent",
  },
  {
    key: "stellarNexus",
    name: "Stellar Nexus",
    tagline: "Nucleo luminoso ao centro · 6 planetas em orbita · 24 feixes radiantes · nebula 5 camadas",
    darkModeReadable: "excellent",
  },
];
