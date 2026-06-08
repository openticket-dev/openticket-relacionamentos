"use client";

/**
 * Ticket3DCard — Framer Motion 3D tilt wrapper.
 *
 * Wraps any child (typically a <StyledQR/>) with a pointer/gyro-driven
 * 3D tilt effect and a holographic sheen overlay that tracks the pointer.
 *
 * Behavior:
 *  - On mouse/touch move over the card, we compute a normalized [-0.5, 0.5]
 *    position for (x,y) and spring-animate rotateX/rotateY via useSpring.
 *  - On hover, the card lifts via translateZ(30px) on the inner motion div.
 *  - A holographic sheen motion.div renders a radial gradient positioned at
 *    the pointer with mix-blend-mode: overlay, fading on pointer leave.
 *  - On mobile touch devices, if DeviceOrientationEvent is available, tilt
 *    responds to gyroscope (beta/gamma) clamped to [-0.5, 0.5]. Falls back
 *    to touch drag if the permission prompt is denied or unsupported.
 *  - On pointer leave, springs return to rest (0,0).
 *
 * Respects the prefers-reduced-motion media query (via disabled prop opt-out).
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionStyle,
} from "framer-motion";

export function Ticket3DCard({
  children,
  intensity = 15,
  disabled = false,
}: {
  children: React.ReactNode;
  intensity?: number;
  disabled?: boolean;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);

  // Normalized pointer position in the range [-0.5, 0.5] (x horizontal, y vertical)
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [hovered, setHovered] = useState(false);

  // Spring configs per task spec: stiffness 220, damping 22
  const springConfig = { stiffness: 220, damping: 22, mass: 0.6 };
  const sx = useSpring(x, springConfig);
  const sy = useSpring(y, springConfig);

  // rotateY is driven by x (left/right pointer movement).
  // rotateX is driven by y (up/down pointer movement). Invert y so moving the
  // pointer UP tilts the card's TOP towards the viewer (natural parallax feel).
  const rotateY = useTransform(sx, [-0.5, 0.5], [-intensity, intensity]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [intensity, -intensity]);

  // Sheen position — tracked raw (no spring) so it follows the pointer instantly
  const sheenX = useMotionValue(50);
  const sheenY = useMotionValue(50);
  const sheenBackground = useTransform(
    [sheenX, sheenY] as const,
    // We use radial-gradient anchored at the pointer location (in percent)
    (latest: number[]) => {
      const [px, py] = latest;
      return `radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.1) 35%, rgba(255,255,255,0) 70%)`;
    }
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      x.set(nx);
      y.set(ny);
      sheenX.set((e.clientX - rect.left) / rect.width * 100);
      sheenY.set((e.clientY - rect.top) / rect.height * 100);
    },
    [disabled, x, y, sheenX, sheenY]
  );

  const handlePointerEnter = useCallback(() => {
    if (disabled) return;
    setHovered(true);
  }, [disabled]);

  const handlePointerLeave = useCallback(() => {
    if (disabled) return;
    setHovered(false);
    x.set(0);
    y.set(0);
    sheenX.set(50);
    sheenY.set(50);
  }, [disabled, x, y, sheenX, sheenY]);

  // Device orientation (mobile gyro) — graceful fallback
  useEffect(() => {
    if (disabled) return;
    if (typeof window === "undefined") return;
    // Only attempt gyro on touch devices
    const isTouch =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) return;
    if (typeof window.DeviceOrientationEvent === "undefined") return;

    // iOS 13+ requires permission; if unavailable or denied, silently skip.
    type OrientationEventWithPermission = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    const DOE = window.DeviceOrientationEvent as OrientationEventWithPermission;

    let cleanup: (() => void) | null = null;

    const bind = () => {
      const onOrient = (ev: DeviceOrientationEvent) => {
        // beta: front-to-back tilt (-180, 180), gamma: left-to-right tilt (-90, 90)
        const beta = ev.beta ?? 0;
        const gamma = ev.gamma ?? 0;
        // Map +/-30 degrees of tilt onto [-0.5, 0.5]
        const nx = Math.max(-0.5, Math.min(0.5, gamma / 60));
        const ny = Math.max(-0.5, Math.min(0.5, beta / 60));
        x.set(nx);
        y.set(ny);
      };
      window.addEventListener("deviceorientation", onOrient, true);
      cleanup = () => window.removeEventListener("deviceorientation", onOrient, true);
    };

    if (typeof DOE.requestPermission === "function") {
      // Don't auto-prompt; only bind if user already granted (permission flow would
      // need to be triggered by an explicit user gesture — we fallback to touch drag).
      // Best-effort: try to bind, browser will just not fire events if denied.
      bind();
    } else {
      bind();
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [disabled, x, y]);

  // Touch fallback — on touch move, track the finger like a pointer
  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (disabled) return;
      const el = ref.current;
      if (!el) return;
      const touch = e.touches[0];
      if (!touch) return;
      const rect = el.getBoundingClientRect();
      const nx = (touch.clientX - rect.left) / rect.width - 0.5;
      const ny = (touch.clientY - rect.top) / rect.height - 0.5;
      x.set(nx);
      y.set(ny);
      sheenX.set((touch.clientX - rect.left) / rect.width * 100);
      sheenY.set((touch.clientY - rect.top) / rect.height * 100);
    },
    [disabled, x, y, sheenX, sheenY]
  );

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;
    setHovered(false);
    x.set(0);
    y.set(0);
    sheenX.set(50);
    sheenY.set(50);
  }, [disabled, x, y, sheenX, sheenY]);

  // When disabled, just render children unwrapped
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onTouchMove={handleTouchMove}
      onTouchStart={handlePointerEnter}
      onTouchEnd={handleTouchEnd}
      style={{
        perspective: 1200,
        display: "inline-block",
        // Keep the bounding box tight around the child (QR seal is circular)
        willChange: "transform",
      }}
    >
      <motion.div
        style={
          {
            position: "relative",
            rotateX,
            rotateY,
            translateZ: hovered ? 30 : 0,
            transformStyle: "preserve-3d",
            transition: "translateZ 0.25s ease-out",
          } as MotionStyle
        }
      >
        {children}
        {/* Holographic sheen overlay — follows the pointer with overlay blend */}
        <motion.div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: sheenBackground,
            mixBlendMode: "overlay",
            pointerEvents: "none",
            opacity: hovered ? 0.4 : 0,
            transition: "opacity 0.25s ease-out",
          }}
        />
      </motion.div>
    </div>
  );
}
