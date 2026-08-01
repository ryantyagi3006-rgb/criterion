"use client";
import { useEffect, useRef } from "react";

// Scrub-optimised build of the source clip: 1440x810 instead of 3840x2160, and
// re-encoded so every frame is a keyframe. The original 4K version had sparse
// keyframes, so each backward seek re-decoded an 8.3 megapixel frame from a
// distant reference and the scrub could only manage a couple of frames a
// second. Regenerate with scripts/build-hero-video.mjs.
const SRC = "/hero.mp4";

export default function BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Desktop: the pointer position maps straight onto the clip timeline.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let targetTime = 0;
    let hasCursor = false;
    let seeking = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;

    // This clip only completes roughly 9 seeks a second, so asking for a new
    // frame every animation frame just throws work away and reads as stutter.
    // Instead keep exactly one seek in flight and always aim it at the newest
    // cursor position, which runs the decoder at its true ceiling with no
    // backlog to fall behind.
    const pump = () => {
      if (seeking || !hasCursor) return;
      const duration = video.duration;
      if (!duration || Number.isNaN(duration)) return;
      // Wide enough that a frame the decoder cannot land on exactly, such as
      // the very end of the clip, does not retrigger forever.
      if (Math.abs(targetTime - video.currentTime) < 0.02) return;

      if (!video.paused) video.pause();
      seeking = true;
      video.currentTime = targetTime;

      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        seeking = false;
        pump();
      }, 250);
    };

    const onSeeked = () => {
      clearTimeout(watchdog);
      seeking = false;
      pump(); // immediately chase wherever the cursor moved to meanwhile
    };

    const onMouseMove = (event: MouseEvent) => {
      if (window.innerWidth < 1024) return;
      const duration = video.duration;
      if (!duration || Number.isNaN(duration)) return;

      // Absolute mapping. Accumulating deltas lets the figure drift away from
      // the cursor over time, so the x position across the viewport is the
      // position in the clip.
      const ratio = Math.min(Math.max(event.clientX / window.innerWidth, 0), 1);
      targetTime = ratio * duration;
      hasCursor = true;
      pump();
    };

    window.addEventListener("mousemove", onMouseMove);
    video.addEventListener("seeked", onSeeked);
    return () => {
      clearTimeout(watchdog);
      window.removeEventListener("mousemove", onMouseMove);
      video.removeEventListener("seeked", onSeeked);
    };
  }, []);

  // Mobile and tablet: scrubbing is off, so just play it.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.innerWidth < 1024) {
      video.autoplay = true;
      video.loop = true;
      video.play().catch(() => {});
    }
  }, []);

  return (
    <div className="order-last lg:order-none relative lg:absolute lg:inset-0 lg:z-0 overflow-hidden pointer-events-none w-full aspect-square md:aspect-video lg:aspect-auto lg:h-full bg-surface lg:bg-transparent">
      <video
        ref={videoRef}
        src={SRC}
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover object-right lg:object-right-bottom"
      />
      {/* Keeps the copy legible over the clip in both themes. The gradients are
          built from --paper, so they are white in light mode and navy in dark. */}
      <div className="hidden lg:block absolute inset-0 bg-gradient-to-r from-paper via-paper/70 to-transparent" />
      {/* The nav sits over the brightest part of the clip, which leaves the
          light dark-mode text unreadable without this. */}
      <div className="hidden lg:block absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-paper/90 to-transparent" />
    </div>
  );
}
