"use client";
import QuestionImages from "./QuestionImages";
import { newSectionKey, type Section } from "@/lib/sections";

const input =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal text-ink";

/**
 * Sections group questions and carry their own preamble. Deleting one leaves
 * its questions in place; they simply fall back to having no section.
 */
export default function SectionEditor({
  sections,
  questionCounts,
  onChange,
}: {
  sections: Section[];
  questionCounts: Record<string, number>;
  onChange: (next: Section[]) => void;
}) {
  function patch(key: string, changes: Partial<Section>) {
    onChange(sections.map((s) => (s.key === key ? { ...s, ...changes } : s)));
  }

  function add() {
    onChange([
      ...sections,
      {
        key: newSectionKey(),
        title: `Section ${String.fromCharCode(65 + sections.length)}`,
        instructions: "",
        images: [],
      },
    ]);
  }

  function remove(key: string) {
    const used = questionCounts[key] ?? 0;
    const warning = used
      ? `Delete this section? Its ${used} question${used === 1 ? "" : "s"} stay, but lose their section heading.`
      : "Delete this section?";
    if (!confirm(warning)) return;
    onChange(sections.filter((s) => s.key !== key));
  }

  function move(index: number, delta: number) {
    const next = [...sections];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <section>
      <h2 className="font-display text-2xl font-semibold mb-1 text-ink">Sections</h2>
      <p className="text-sm text-soft mb-4">
        Each section can carry its own instructions and figures, shown above every question in it.
      </p>

      <div className="space-y-3">
        {sections.map((section, index) => (
          <div key={section.key} className="rounded-xl border border-line bg-surface p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${input} flex-1 min-w-48 font-semibold`}
                value={section.title}
                placeholder="Section title"
                onChange={(e) => patch(section.key, { title: e.target.value })}
              />
              <span className="text-[11px] text-soft whitespace-nowrap">
                {questionCounts[section.key] ?? 0} question{(questionCounts[section.key] ?? 0) === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Move section up" onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="rounded-md border border-line px-2 py-1 text-xs text-soft hover:border-teal disabled:opacity-30">
                  Up
                </button>
                <button type="button" aria-label="Move section down" onClick={() => move(index, 1)}
                  disabled={index === sections.length - 1}
                  className="rounded-md border border-line px-2 py-1 text-xs text-soft hover:border-teal disabled:opacity-30">
                  Down
                </button>
                <button type="button" onClick={() => remove(section.key)}
                  className="rounded-md border border-line px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:opacity-70">
                  Delete
                </button>
              </div>
            </div>

            <label className="microlabel space-y-1 block">
              <span>Instructions for this section</span>
              <textarea
                className={input}
                rows={2}
                placeholder="Answer ALL questions in this section. You may use a calculator."
                value={section.instructions}
                onChange={(e) => patch(section.key, { instructions: e.target.value })}
              />
            </label>

            <div className="space-y-1">
              <span className="microlabel">
                Images for this section
                {section.images.length > 0 && (
                  <span className="normal-case tracking-normal font-normal"> ({section.images.length})</span>
                )}
              </span>
              <QuestionImages
                images={section.images}
                onChange={(images) => patch(section.key, { images })}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-3 w-full rounded-xl border border-dashed border-line hover:border-teal text-sm font-semibold text-soft hover:text-teal py-3 transition-colors"
      >
        Add a section
      </button>
    </section>
  );
}
