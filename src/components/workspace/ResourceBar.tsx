"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ToolView } from "./ToolsPanel";
import MathField from "./MathField";

/**
 * Every resource a student can use, on the bar beside the answer.
 *
 * Nothing here is assigned per question. A student who needs a calculator on
 * a question nobody thought would need one should not be locked out of it, so
 * the full set is offered everywhere and they pick what they want.
 */
const RESOURCES = [
  { id: "maths", label: "Maths", hint: "Equation editor" },
  { id: "graphing", label: "Graph", hint: "GeoGebra plotter" },
  { id: "calculator", label: "Calculator", hint: "Scientific calculator" },
  { id: "formula_sheet", label: "Formulae", hint: "Formula sheet" },
  { id: "periodic_table", label: "Elements", hint: "Periodic table" },
  { id: "unit_converter", label: "Units", hint: "Unit converter" },
  { id: "dictionary", label: "Words", hint: "Word tools" },
  { id: "map", label: "Grid", hint: "Coordinate grid" },
] as const;

export default function ResourceBar({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [scratch, setScratch] = useState("");

  // The panel is portalled to the body. The question card it sits inside
  // keeps a transform once its entrance animation finishes, and a transformed
  // ancestor anchors position:fixed to itself rather than to the window,
  // which pushed the panel off the bottom of the screen.

  // Escape closes whatever is open, which matters most in exam mode where a
  // panel covering the question would otherwise need a mouse.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const current = RESOURCES.find((r) => r.id === open);

  return (
    <>
      <div className={`flex flex-wrap items-center gap-1 ${compact ? "" : "mb-2"}`}>
        {!compact && <span className="microlabel mr-1">Resources</span>}
        {RESOURCES.map((r) => (
          <button
            key={r.id}
            type="button"
            title={r.hint}
            aria-label={r.hint}
            aria-pressed={open === r.id}
            onClick={() => setOpen(open === r.id ? null : r.id)}
            className={`h-8 px-2.5 rounded-lg border text-xs font-semibold transition-colors ${
              open === r.id
                ? "border-teal bg-tealwash text-tealdeep"
                : "border-line bg-paper text-ink hover:border-teal"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {current && typeof document !== "undefined" && createPortal(
        <div
          className="fixed z-40 bottom-4 right-4 w-[min(26rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-surface shadow-xl"
          role="dialog"
          aria-label={current.hint}
        >
          <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-line bg-surface px-3 py-2">
            <span className="text-sm font-semibold text-ink">{current.hint}</span>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="text-xs font-semibold text-soft hover:text-ink"
            >
              Close
            </button>
          </div>
          <div className="p-3">
            {current.id === "maths" ? (
              <div>
                <MathField
                  value={scratch}
                  onChange={setScratch}
                  ariaLabel="Maths scratchpad"
                />
                <p className="mt-2 text-[11px] text-soft">
                  A space to work something out. Copy what you need into your answer.
                </p>
              </div>
            ) : (
              <ToolView id={current.id} />
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
