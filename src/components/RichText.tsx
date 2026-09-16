import { sanitizeRichText, isRichText } from "@/lib/richtext";

/**
 * Renders stored question text or an extended response. The markup comes from
 * a teacher or a student, so it is always reduced to the formatting allowlist
 * first. Text saved before formatting existed has no tags at all, so it is
 * rendered as plain text and keeps its line breaks.
 */
export default function RichText({
  html,
  className = "",
}: {
  html: string;
  className?: string;
}) {
  if (!html) return null;

  if (!isRichText(html))
    return <div className={`whitespace-pre-wrap ${className}`}>{html}</div>;

  return (
    <div
      className={`richtext ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
    />
  );
}
