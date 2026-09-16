// Question text and extended responses are stored as a very small subset of
// HTML so bold, italic, underline, colour and lists survive. Student input is
// rendered back to teachers and teacher input is rendered to students, so
// neither is trusted: everything outside this allowlist is dropped and every
// attribute is stripped, bar one validated class on a span.
const ALLOWED_TAGS = new Set([
  "b", "strong", "i", "em", "u", "br", "p", "div", "span", "ul", "ol", "li",
]);

/**
 * Colour is a short fixed palette rather than free CSS. Each entry is stored
 * as a class, so the rendered colour comes from the stylesheet and adjusts to
 * the light and dark themes instead of being burnt into the saved markup.
 * The sentinel is what the editor hands to the browser; it is only ever a
 * marker, swapped for the class before anything is saved.
 */
export const TEXT_COLOURS = [
  { name: "red", label: "Red", sentinel: "#d11a1a" },
  { name: "amber", label: "Amber", sentinel: "#c2760a" },
  { name: "green", label: "Green", sentinel: "#127c46" },
  { name: "blue", label: "Blue", sentinel: "#1d5fd0" },
  { name: "purple", label: "Purple", sentinel: "#7226c4" },
] as const;

export type TextColour = (typeof TEXT_COLOURS)[number]["name"];

const COLOUR_CLASS = /^hl-(red|amber|green|blue|purple)$/;

const DANGEROUS = /<(script|style|iframe|object|embed|link|meta|form|input|svg|math)\b[\s\S]*?<\/\1\s*>/gi;
const DANGEROUS_SELF_CLOSING = /<(script|style|iframe|object|embed|link|meta|input)\b[^>]*\/?>/gi;

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/**
 * Browsers colour a selection with an inline style or a font tag, depending on
 * the browser and its mood. Both are rewritten to the palette class here, as
 * soon as the edit happens, so only the class shape is ever stored.
 */
export function normaliseColours(html: string): string {
  if (!html) return "";
  let out = html;

  for (const c of TEXT_COLOURS) {
    const rgb = hexToRgb(c.sentinel);
    // style="color: rgb(r, g, b)" or style="color:#hex", in any tag
    const styled = new RegExp(
      `(<[a-z]+\\b[^>]*?)style\\s*=\\s*(["'])[^"']*color\\s*:\\s*(?:${rgb.replace(/[()]/g, "\\$&")}|${c.sentinel})[^"']*\\2`,
      "gi"
    );
    out = out.replace(styled, `$1class="hl-${c.name}"`);
    // <font color="#hex">
    out = out.replace(
      new RegExp(`<font\\b[^>]*color\\s*=\\s*(["']?)${c.sentinel}\\1[^>]*>`, "gi"),
      `<span class="hl-${c.name}">`
    );
  }

  // Any font tag left over carried a colour outside the palette, so it becomes
  // a plain span and loses the colour rather than keeping an arbitrary one.
  out = out.replace(/<font\b[^>]*>/gi, "<span>").replace(/<\/font\s*>/gi, "</span>");
  return out;
}

export function sanitizeRichText(html: string): string {
  if (!html) return "";

  let out = normaliseColours(html).replace(DANGEROUS, "").replace(DANGEROUS_SELF_CLOSING, "");

  // Rebuild every remaining tag from its name alone. Anything not on the
  // allowlist disappears, and the only attribute that can survive is a span
  // class matching one palette colour exactly.
  out = out.replace(
    /<(\/)?([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g,
    (_match, closing: string | undefined, rawName: string, attrs: string) => {
      const tag = rawName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (tag === "br") return "<br>";
      if (closing) return `</${tag}>`;
      // Browsers colour a selection by reusing whatever element is already
      // there, so the class can land on a u or a b just as easily as a span.
      // It survives on any allowed tag, and only when it names one palette
      // colour exactly.
      const cls = /class\s*=\s*["']?([a-z-]+)/i.exec(attrs)?.[1]?.toLowerCase();
      if (cls && COLOUR_CLASS.test(cls)) return `<${tag} class="${cls}">`;
      return `<${tag}>`;
    }
  );

  return out;
}

/** True when the value carries markup, rather than being plain typed text. */
export function isRichText(html: string): boolean {
  return /<(b|strong|i|em|u|br|p|div|span|ul|ol|li)\b[^>]*>/i.test(html || "");
}

/** Flattens the stored markup to plain text, for word counts and for marking. */
export function richTextToPlain(html: string): string {
  if (!html) return "";
  return html
    // Numbered lists keep their numbers, so a question that asks for step 2
    // still reads as step 2 once the tags are gone.
    .replace(/<ol\b[^>]*>([\s\S]*?)<\/ol\s*>/gi, (_m, inner: string) => {
      let n = 0;
      return inner.replace(/<li\b[^>]*>/gi, () => `\n${++n}. `);
    })
    .replace(/<li\b[^>]*>/gi, "\n- ")
    // Each item already opened with a newline, so only the end of the list
    // itself adds one. Otherwise every point comes out double spaced.
    .replace(/<\/li\s*>/gi, "")
    .replace(/<\/(ul|ol)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countWords(html: string): number {
  const text = richTextToPlain(html);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}
