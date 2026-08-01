"use client";
import { useEffect, useState } from "react";

/**
 * Builds `text` up one slice at a time.
 * Waits `startDelay` ms, then appends a character every `speed` ms.
 */
export function useTypewriter(text: string, speed = 38, startDelay = 600) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let index = 0;
    let interval: ReturnType<typeof setInterval> | undefined;

    const timeout = setTimeout(() => {
      // Reset here rather than in the effect body so the typing restarts
      // cleanly if `text` ever changes, without an empty flash on mount.
      setDisplayed("");
      setDone(false);

      interval = setInterval(() => {
        index += 1;
        setDisplayed(text.slice(0, index));
        if (index >= text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}
