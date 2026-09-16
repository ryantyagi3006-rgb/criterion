"use client";
import { useEffect, useRef, useState } from "react";
import { normaliseColours, countWords, TEXT_COLOURS } from "@/lib/richtext";

const MARKS = [
  { command: "bold", label: "B", title: "Bold, Cmd or Ctrl + B", className: "font-bold" },
  { command: "italic", label: "I", title: "Italic, Cmd or Ctrl + I", className: "italic font-serif" },
  { command: "underline", label: "U", title: "Underline, Cmd or Ctrl + U", className: "underline" },
] as const;

const LISTS = [
  { command: "insertUnorderedList", title: "Bullet points", glyph: "•—" },
  { command: "insertOrderedList", title: "Numbered points", glyph: "1—" },
] as const;

const COLOUR_CLASSES = TEXT_COLOURS.map((c) => `hl-${c.name}`);

const btn =
  "h-8 min-w-8 px-1.5 rounded-lg border text-sm transition-colors disabled:opacity-50";

/**
 * One editor for anything stored as formatted text: question wording for
 * teachers, extended responses for students. Colour is offered only where the
 * caller asks for it, so a student paper stays plain black on plain paper.
 */
export default function RichTextEditor({
  value,
  onChange,
  colours = false,
  spellCheck = true,
  wordCount = false,
  ariaLabel,
  placeholder = "",
  className = "",
  minHeight = "min-h-24",
}: {
  value: string;
  onChange: (v: string) => void;
  colours?: boolean;
  spellCheck?: boolean;
  wordCount?: boolean;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [pickingColour, setPickingColour] = useState(false);

  // contenteditable is uncontrolled, so only write into it when the incoming
  // value genuinely differs. Rewriting on every keystroke would collapse the
  // caret to the start of the text.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  function refreshActive() {
    const state: Record<string, boolean> = {};
    for (const m of MARKS) state[m.command] = document.queryCommandState(m.command);
    for (const l of LISTS) state[l.command] = document.queryCommandState(l.command);
    setActive(state);
  }

  function emit() {
    // Colours are rewritten to palette classes the moment they are applied, so
    // an inline style never reaches the database.
    const html = normaliseColours(ref.current?.innerHTML ?? "");
    if (ref.current && ref.current.innerHTML !== html) ref.current.innerHTML = html;
    onChange(html);
    refreshActive();
  }

  function run(command: string, arg?: string) {
    ref.current?.focus();
    // execCommand is deprecated but is still the only thing every browser
    // implements for this, and the output is sanitised before it is shown.
    if (arg !== undefined) document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, arg);
    emit();
  }

  /**
   * Takes the colour off the selection and leaves bold, italic and underline
   * alone. The browser is asked to paint the selection in the body colour,
   * which splits the coloured spans at the right places, and the spans it
   * touched are then unwrapped so no stray colour is stored.
   */
  function clearColour() {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand("foreColor", false, getComputedStyle(el).color);

      for (const span of Array.from(el.querySelectorAll("span[style*='color']"))) {
        span.removeAttribute("style");
        span.classList.remove(...COLOUR_CLASSES);
        // An ancestor may still be carrying the old colour, so it goes too.
        let parent = span.parentElement;
        while (parent && parent !== el) {
          parent.classList.remove(...COLOUR_CLASSES);
          parent = parent.parentElement;
        }
        if (!span.attributes.length) span.replaceWith(...Array.from(span.childNodes));
      }
    }
    emit();
    setPickingColour(false);
  }

  const words = countWords(value);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 mb-2">
        {MARKS.map((m) => (
          <button
            key={m.command}
            type="button"
            title={m.title}
            aria-pressed={!!active[m.command]}
            aria-label={m.title}
            onMouseDown={(e) => e.preventDefault()} // keep the selection
            onClick={() => run(m.command)}
            className={`${btn} ${m.className} ${
              active[m.command]
                ? "border-teal bg-tealwash text-tealdeep"
                : "border-line bg-paper text-ink hover:border-teal"
            }`}
          >
            {m.label}
          </button>
        ))}

        <span className="w-px h-5 bg-line mx-1" />

        {LISTS.map((l) => (
          <button
            key={l.command}
            type="button"
            title={l.title}
            aria-pressed={!!active[l.command]}
            aria-label={l.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(l.command)}
            className={`${btn} font-mono text-xs tracking-tight ${
              active[l.command]
                ? "border-teal bg-tealwash text-tealdeep"
                : "border-line bg-paper text-ink hover:border-teal"
            }`}
          >
            {l.glyph}
          </button>
        ))}

        {colours && (
          <>
            <span className="w-px h-5 bg-line mx-1" />
            <div className="relative">
              <button
                type="button"
                title="Text colour"
                aria-label="Text colour"
                aria-expanded={pickingColour}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setPickingColour((v) => !v)}
                className={`${btn} px-2 flex items-center gap-1 ${
                  pickingColour ? "border-teal bg-tealwash" : "border-line bg-paper hover:border-teal"
                }`}
              >
                <span className="font-bold text-ink">A</span>
                <span className="w-3.5 h-1.5 rounded-sm bg-[linear-gradient(90deg,var(--hl-red),var(--hl-amber),var(--hl-green),var(--hl-blue),var(--hl-purple))]" />
              </button>

              {pickingColour && (
                <div className="absolute z-20 mt-1 left-0 flex items-center gap-1 rounded-lg border border-line bg-surface p-1.5 shadow-sm">
                  {TEXT_COLOURS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      title={c.label}
                      aria-label={c.label}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        run("foreColor", c.sentinel);
                        setPickingColour(false);
                      }}
                      className="w-6 h-6 rounded-full border border-line hover:scale-110 transition-transform"
                      style={{ background: `var(--hl-${c.name})` }}
                    />
                  ))}
                  <span className="w-px h-5 bg-line mx-0.5" />
                  <button
                    type="button"
                    title="Remove colour"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={clearColour}
                    className="text-[11px] text-soft hover:text-ink px-1.5"
                  >
                    None
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <span className="ml-2 text-[11px] text-soft">Select text, then format it.</span>
      </div>

      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        contentEditable
        suppressContentEditableWarning
        spellCheck={spellCheck}
        data-placeholder={placeholder}
        onInput={emit}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        onFocus={refreshActive}
        onBlur={emit}
        className={`richtext ${minHeight} ${className}`}
      />

      {wordCount && (
        <div className="mt-1.5 text-xs text-soft text-right">
          {words} word{words === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}
