"use client";
import { useState } from "react";

/**
 * The long source a question refers to: an unseen extract, article, transcript
 * and so on. Long passages are collapsed by default in compact views so a
 * 1500 word extract does not bury the question itself.
 */
export default function StimulusPanel({
  stimulus,
  title,
  compact = false,
}: {
  stimulus: string;
  title?: string;
  compact?: boolean;
}) {
  const words = stimulus.trim() ? stimulus.trim().split(/\s+/).length : 0;
  const [open, setOpen] = useState(!compact);
  if (!stimulus.trim()) return null;

  return (
    <figure className="mt-4 rounded-xl border border-line bg-paper overflow-hidden">
      <figcaption className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-line bg-surface">
        <span className="microlabel">{title?.trim() || "Source text"}</span>
        <span className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] text-soft">{words} words</span>
          {compact && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-[11px] font-semibold text-teal hover:opacity-70 transition-opacity"
            >
              {open ? "Hide" : "Read"}
            </button>
          )}
        </span>
      </figcaption>

      {open && (
        <div
          className="px-4 py-3 max-h-[26rem] overflow-y-auto"
          // Long extracts need their own scroll so the answer box stays reachable.
          tabIndex={0}
          aria-label={title?.trim() || "Source text"}
        >
          <p className="text-[15px] leading-[1.75] text-ink whitespace-pre-wrap font-serif">
            {stimulus}
          </p>
        </div>
      )}
    </figure>
  );
}
