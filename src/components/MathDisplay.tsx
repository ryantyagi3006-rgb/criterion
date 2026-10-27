"use client";
import { useEffect, useRef, useState } from "react";
import { looksLikeLatex, forRendering } from "@/lib/latex";

/**
 * Shows stored working as typeset mathematics. KaTeX is used rather than the
 * full editor, since these views only ever read the work back.
 *
 * Answers typed before the maths editor existed are ordinary text, so they are
 * shown as they were written instead of being forced through a parser that
 * would only mangle them.
 */
export default function MathDisplay({ latex }: { latex: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const isLatex = looksLikeLatex(latex);

  useEffect(() => {
    if (!isLatex) return;
    let cancelled = false;

    (async () => {
      try {
        const katex = (await import("katex")).default;
        if (cancelled || !ref.current) return;
        katex.render(forRendering(latex), ref.current, {
          displayMode: true,
          throwOnError: false,
          // A mistyped command shows in red rather than blanking the answer,
          // which matters when a teacher is marking and needs to see what the
          // student actually wrote.
          errorColor: "#b3261e",
          trust: false,
          strict: false,
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [latex, isLatex]);

  if (!latex.trim()) return <p className="text-sm italic text-soft">No answer given</p>;

  if (!isLatex || failed)
    return (
      <pre className="text-sm font-mono whitespace-pre-wrap rounded-lg bg-paper border border-line p-3 text-ink">
        {latex}
      </pre>
    );

  return (
    <div className="rounded-lg bg-paper border border-line p-3 overflow-x-auto">
      <div ref={ref} className="text-ink" />
    </div>
  );
}
