import { sanitizeRichText, isRichText } from "@/lib/richtext";

/**
 * Renders stored question text or an extended response. The markup comes from
 * a teacher or a student, so it is always reduced to the formatting allowlist
 * first. Text saved before formatting existed has no tags at all, so it is
 * rendered as plain text and keeps its line breaks.
 *
 * `inline` is for compact summaries. It keeps bold, italic, underline and
 * colour but lays everything on one run of text, so a question with a list in
 * it still previews as a single line. It also renders a span rather than a
 * div, which is what makes it legal inside the summary button.
 */
export default function RichText({
  html,
  className = "",
  inline = false,
}: {
  html: string;
  className?: string;
  inline?: boolean;
}) {
  if (!html) return null;

  if (!isRichText(html)) {
    if (inline) return <span className={className}>{html}</span>;
    return <div className={`whitespace-pre-wrap ${className}`}>{html}</div>;
  }

  const classes = `richtext ${inline ? "richtext-inline " : ""}${className}`;
  const props = {
    className: classes,
    dangerouslySetInnerHTML: { __html: sanitizeRichText(html) },
  };

  return inline ? <span {...props} /> : <div {...props} />;
}
