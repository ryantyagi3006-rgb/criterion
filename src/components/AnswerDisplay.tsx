import { sanitizeRichText } from "@/lib/richtext";

/* Renders a stored answer for results and review views. */
export default function AnswerDisplay({ format, content }: { format: string; content: string }) {
  if (!content.trim()) return <p className="text-sm italic text-soft">No answer given</p>;

  // Extended responses carry bold, italic and underline. This is student input
  // being shown to a teacher, so it is reduced to a formatting-only allowlist
  // with every attribute stripped before rendering.
  if (format === "long_text")
    return (
      <div
        className="text-sm text-ink leading-relaxed whitespace-pre-wrap [&_u]:underline [&_b]:font-semibold [&_strong]:font-semibold"
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
      />
    );

  if (format === "drawing" && content.startsWith("data:image"))
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={content} alt="Student drawing" className="rounded-lg border border-line max-w-full bg-white" />;

  if (format === "table") {
    try {
      const grid = JSON.parse(content) as string[][];
      return (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="text-sm w-full">
            <tbody>
              {grid.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className={`border border-line px-2 py-1.5 text-ink ${r === 0 ? "font-semibold bg-paper" : ""}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } catch {}
  }

  if (format === "code" || format === "math")
    return <pre className="text-sm font-mono whitespace-pre-wrap rounded-lg bg-paper border border-line p-3 text-ink">{content}</pre>;

  return <p className="text-sm whitespace-pre-wrap text-ink leading-relaxed">{content}</p>;
}
