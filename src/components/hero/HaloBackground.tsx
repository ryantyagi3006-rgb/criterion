"use client";
import { useEffect, useRef } from "react";
import type { VantaEffect } from "vanta/dist/vanta.halo.min";

// Vanta reads these as hex numbers, not CSS strings, so they cannot come from
// the CSS custom properties the rest of the hero uses.
//
// The halo stays on black in both themes on purpose. It is an additive glow,
// so against a light backdrop it has nothing to glow against and washes out to
// almost nothing. Instead the paper gradient in front of it does the theme
// work: it fades cream to transparent in light mode and navy to transparent in
// dark, so the animation reads as a panel on the right in both.
const HALO_OPTIONS = {
  baseColor: 0x0,
  backgroundColor: 0x0,
  amplitudeFactor: 3.0,
  size: 3.0,
};

export default function HaloBackground() {
  const hostRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<VantaEffect | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Loaded on the client only. three is roughly 600KB, so keeping it out of
    // the initial bundle matters more than starting the animation a tick early.
    (async () => {
      const [{ default: HALO }, THREE] = await Promise.all([
        import("vanta/dist/vanta.halo.min"),
        import("three"),
      ]);
      if (cancelled || !hostRef.current) return;

      effectRef.current = HALO({
        el: hostRef.current,
        THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.0,
        minWidth: 200.0,
        ...HALO_OPTIONS,
      });
    })();

    return () => {
      cancelled = true;
      effectRef.current?.destroy();
      effectRef.current = null;
    };
  }, []);

  return (
    <div className="order-last lg:order-none relative lg:absolute lg:inset-0 lg:z-0 overflow-hidden pointer-events-none w-full aspect-square md:aspect-video lg:aspect-auto lg:h-full bg-black">
      <div ref={hostRef} className="absolute inset-0" />
      {/* Carries the theme, and keeps the copy legible over the animation. */}
      <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-paper from-25% via-paper/80 to-transparent" />
      <div className="hidden lg:block absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-paper/90 to-transparent" />
    </div>
  );
}
