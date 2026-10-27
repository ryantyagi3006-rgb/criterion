"use client";
import { useEffect, useRef, useState } from "react";

/**
 * A real mathematics editor, the kind you get in MathType: fractions stack,
 * roots draw their bar over the radicand, and exponents sit where they should.
 * Typing \frac or pressing / builds the structure as you go.
 *
 * What is stored is LaTeX, so the working stays machine readable for marking
 * and can be rendered anywhere later without a screenshot.
 *
 * MathLive is a custom element that reaches for the document as it loads, so
 * it is pulled in on the client only, after mount, never during the server
 * render.
 */
export default function MathField({
  value,
  onChange,
  ariaLabel = "Mathematical working",
  readOnly = false,
}: {
  value: string;
  onChange?: (latex: string) => void;
  ariaLabel?: string;
  readOnly?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLElement & { value: string } | null>(null);
  const latest = useRef(onChange);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Held in a ref so the field is built once, while still calling whatever
  // the current handler is. Assigned in an effect rather than during render,
  // since a render may be thrown away.
  useEffect(() => {
    latest.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await import("mathlive");
        if (cancelled || !host.current) return;

        // The virtual keyboard is a shared panel hung off the window. Point it
        // at the page body so it is not trapped inside a scrolling column.
        window.mathVirtualKeyboard.container = document.body;

        const el = document.createElement("math-field") as HTMLElement & {
          value: string;
          readOnly: boolean;
          smartMode: boolean;
          mathVirtualKeyboardPolicy: string;
        };
        el.setAttribute("aria-label", ariaLabel);
        el.value = value;
        el.readOnly = readOnly;
        // Lets a student type "if x is 5" as words without it becoming a
        // product of four variables.
        el.smartMode = true;
        el.mathVirtualKeyboardPolicy = readOnly ? "manual" : "auto";
        el.style.width = "100%";
        el.style.fontSize = "1.05rem";
        // MathLive paints itself black on white by default, which is wrong on
        // the dark theme. These point it at the page's own colours, so the
        // working looks like the rest of the paper in either theme.
        el.style.color = "var(--ink)";
        el.style.background = "transparent";
        el.style.setProperty("--caret-color", "var(--teal)");
        el.style.setProperty("--selection-background-color", "var(--tealwash)");
        el.style.setProperty("--selection-color", "var(--ink)");
        el.style.setProperty("--contains-highlight-background-color", "var(--tealwash)");
        el.style.setProperty("--smart-fence-color", "var(--soft)");

        if (!readOnly)
          el.addEventListener("input", () => latest.current?.(el.value));

        host.current.replaceChildren(el);
        field.current = el;
        setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the field in step when the value is changed from outside, for
  // instance when a saved attempt is reloaded. Writing on every keystroke
  // would fight the caret, so only a genuine difference is written.
  useEffect(() => {
    const el = field.current;
    if (el && el.value !== value) el.value = value;
  }, [value]);

  if (failed)
    return (
      <textarea
        className="w-full rounded-lg border border-line bg-paper px-4 py-3 text-sm outline-none focus:border-teal text-ink min-h-32 font-mono"
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Type your working"
      />
    );

  return (
    <div
      ref={host}
      className={`w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink ${
        readOnly ? "" : "focus-within:border-teal focus-within:ring-1 focus-within:ring-teal"
      } ${ready ? "" : "min-h-14"}`}
    />
  );
}
