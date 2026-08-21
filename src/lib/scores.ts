import { CRITERIA, type CriterionRef } from "./myp";

// A question's score is recorded against each criterion it assesses, so a
// question worth A4 and C2 is marked out of 4 for A and out of 2 for C rather
// than being given one number and divided up afterwards.
export type CriterionScores = Record<string, number>;

export function parseScores(json: string): CriterionScores {
  try {
    const raw = JSON.parse(json || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: CriterionScores = {};
    for (const key of CRITERIA) {
      const value = Number((raw as Record<string, unknown>)[key]);
      if (Number.isFinite(value) && value >= 0) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** Clamps each criterion to the marks that criterion is actually worth. */
export function clampScores(scores: CriterionScores, criteria: CriterionRef[]): CriterionScores {
  const out: CriterionScores = {};
  for (const c of criteria) {
    const raw = Number(scores[c.criterion]);
    if (!Number.isFinite(raw) || raw <= 0) {
      out[c.criterion] = 0;
      continue;
    }
    // Halves are allowed, so round to the nearest 0.5 rather than an integer.
    out[c.criterion] = Math.min(c.marks, Math.round(raw * 2) / 2);
  }
  return out;
}

export function scoresTotal(scores: CriterionScores): number {
  return Object.values(scores).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

/**
 * Falls back for answers marked before scores were kept per criterion: share
 * the single total out in the same ratio as the marks. Used only for reading
 * old data, never for anything newly marked.
 */
export function scoresFromTotal(total: number, criteria: CriterionRef[]): CriterionScores {
  const available = criteria.reduce((sum, c) => sum + c.marks, 0);
  const out: CriterionScores = {};
  for (const c of criteria) {
    out[c.criterion] = available > 0 ? (total * c.marks) / available : 0;
  }
  return out;
}

/** The per-criterion scores to display, preferring real ones over the fallback. */
export function effectiveScores(
  stored: string,
  total: number | null | undefined,
  criteria: CriterionRef[]
): CriterionScores {
  const parsed = parseScores(stored);
  if (Object.keys(parsed).length > 0) return clampScores(parsed, criteria);
  return scoresFromTotal(total ?? 0, criteria);
}
