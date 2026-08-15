// Extended responses are stored as a very small subset of HTML so bold,
// italic and underline survive. Student input is rendered back to teachers,
// so it is never trusted: everything outside this allowlist is dropped, and
// ALL attributes are stripped, which removes event handlers and urls.
const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "u", "br", "p", "div"]);

const DANGEROUS = /<(script|style|iframe|object|embed|link|meta|form|input|svg|math)\b[\s\S]*?<\/\1\s*>/gi;
const DANGEROUS_SELF_CLOSING = /<(script|style|iframe|object|embed|link|meta|input)\b[^>]*\/?>/gi;

export function sanitizeRichText(html: string): string {
  if (!html) return "";

  let out = html.replace(DANGEROUS, "").replace(DANGEROUS_SELF_CLOSING, "");

  // Rebuild every remaining tag from its name alone. Anything not on the
  // allowlist disappears, and no attribute can survive this.
  out = out.replace(/<(\/)?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g, (_match, closing: string | undefined, rawName: string) => {
    const tag = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (tag === "br") return "<br>";
    return closing ? `</${tag}>` : `<${tag}>`;
  });

  return out;
}

/** Flattens the stored markup to plain text, for word counts and for marking. */
export function richTextToPlain(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countWords(html: string): number {
  const text = richTextToPlain(html);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}
