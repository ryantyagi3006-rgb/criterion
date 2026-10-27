/**
 * Working written in the maths editor is stored as LaTeX. Answers written
 * before that editor existed are ordinary typed text, so both have to be
 * recognised and shown correctly.
 */

// A backslash command, a braced script, or a subscript or superscript. Plain
// typed working such as "c2 = a2 + b2" matches none of these.
const LATEX_SIGNS = /\\[a-zA-Z]+|\\[{}[\]()|]|[_^]\{|\\\\/;

export function looksLikeLatex(value: string): boolean {
  return LATEX_SIGNS.test(value || "");
}

/**
 * Reads LaTeX back as something a person, or a model marking the work, can
 * follow. Used for word counts and for the marking payload, so the examiner
 * sees "3/4" rather than "\\frac{3}{4}".
 */
export function latexToReadable(latex: string): string {
  if (!latex) return "";

  const WORDS: Record<string, string> = {
    times: " x ", cdot: ".", div: " / ", pm: " +/- ", mp: " -/+ ",
    leq: " <= ", le: " <= ", geq: " >= ", ge: " >= ", neq: " != ", ne: " != ",
    approx: " ~ ", equiv: " = ", infty: "infinity", pi: "pi", theta: "theta",
    alpha: "alpha", beta: "beta", gamma: "gamma", delta: "delta", Delta: "Delta",
    sum: "sum", int: "integral", degree: " degrees", circ: " degrees",
    rightarrow: " -> ", to: " -> ", ldots: "...", cdots: "...",
  };

  // An unfinished box reads as a gap, before the structure is unpicked, so
  // it ends up bracketed like any other content.
  let out = latex
    .replace(/\\placeholder\s*\{[^{}]*\}/g, "[gap]")
    .replace(/\\placeholder(?![a-zA-Z])/g, "[gap]");

  // Operators and letters are named first, while every command still carries
  // its backslash. Unpicking \sqrt first would leave \pm sitting against the
  // word sqrt, and the two would be read as one unknown command.
  out = out.replace(
    new RegExp(`\\\\(${Object.keys(WORDS).join("|")})(?![a-zA-Z])`, "g"),
    (_m, name: string) => WORDS[name]
  );

  // Then the structures, innermost first, which is why this runs more than
  // once: a fraction inside a fraction needs its inside resolved to be
  // matched at all.
  for (let pass = 0; pass < 4; pass++) {
    out = out
      .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)")
      .replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, "root[$1]($2)")
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)")
      .replace(/\\(?:left|right|displaystyle|mathrm|text|mathit)\s*/g, "")
      .replace(/\^\s*\{([^{}]*)\}/g, "^($1)")
      .replace(/_\s*\{([^{}]*)\}/g, "_($1)");
  }

  // Anything still carrying a backslash is read as its own name.
  out = out.replace(/\\([a-zA-Z]+)/g, "$1");

  return out
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A few commands exist in the editor but not in the renderer. An unfinished
 * answer is the common case: a student leaves an empty box in a root or a
 * fraction and submits anyway, and the teacher should see the box rather than
 * an error where the working should be.
 */
export function forRendering(latex: string): string {
  return (latex || "")
    .replace(/\\placeholder\s*\{[^{}]*\}/g, "\\square")
    .replace(/\\placeholder(?![a-zA-Z])/g, "\\square")
    .replace(/\\differentialD/g, "d")
    .replace(/\\exponentialE/g, "e")
    .replace(/\\imaginaryI/g, "i");
}

/** What to show when the answer is read rather than edited. */
export function mathToPlain(value: string): string {
  return looksLikeLatex(value) ? latexToReadable(value) : value;
}
