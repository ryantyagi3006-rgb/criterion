// A section groups questions and carries its own preamble: a title, some
// instructions, and any figures those questions share.
//
// Question.section stores the section key. Assessments parsed before sections
// existed store the plain section name there, so the name doubles as the key
// for that older data and nothing needs migrating.

export type Section = {
  key: string;
  title: string;
  instructions: string;
  images: string[];
};

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,/;

export function parseSections(json: string): Section[] {
  try {
    const raw = JSON.parse(json || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((s) => s && typeof s === "object")
      .map((s) => ({
        key: String(s.key ?? s.title ?? "").trim(),
        title: String(s.title ?? "").trim(),
        instructions: String(s.instructions ?? ""),
        images: Array.isArray(s.images)
          ? s.images.filter((i: unknown) => typeof i === "string" && IMAGE_DATA_URL.test(i)).slice(0, 6)
          : [],
      }))
      .filter((s) => s.key);
  } catch {
    return [];
  }
}

export function serialiseSections(sections: Section[]): string {
  return JSON.stringify(
    sections
      .filter((s) => s.key)
      .map((s) => ({
        key: s.key,
        title: s.title,
        instructions: s.instructions,
        images: (s.images ?? []).filter((i) => IMAGE_DATA_URL.test(i)).slice(0, 6),
      }))
  );
}

/**
 * Guarantees every section a question points at actually exists, so questions
 * from an older assessment still show a heading once sections are edited.
 */
export function withSectionsForQuestions(
  sections: Section[],
  questionSectionKeys: string[]
): Section[] {
  const known = new Set(sections.map((s) => s.key));
  const missing = [...new Set(questionSectionKeys.filter((k) => k && !known.has(k)))];
  return [
    ...sections,
    ...missing.map((key) => ({ key, title: key, instructions: "", images: [] })),
  ];
}

export function findSection(sections: Section[], key: string): Section | undefined {
  if (!key) return undefined;
  return sections.find((s) => s.key === key);
}

export function newSectionKey(): string {
  return `sec_${Math.random().toString(36).slice(2, 9)}`;
}
