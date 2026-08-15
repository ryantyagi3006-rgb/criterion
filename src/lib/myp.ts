// IB MYP subject groups and their four assessment criteria (A to D).
// Each criterion is assessed on levels 0 to 8.
export const SUBJECT_GROUPS: Record<string, { A: string; B: string; C: string; D: string }> = {
  "Language and Literature": {
    A: "Analysing",
    B: "Organising",
    C: "Producing text",
    D: "Using language",
  },
  "Language Acquisition": {
    A: "Listening",
    B: "Reading",
    C: "Speaking",
    D: "Writing",
  },
  "Individuals and Societies": {
    A: "Knowing and understanding",
    B: "Investigating",
    C: "Communicating",
    D: "Thinking critically",
  },
  Sciences: {
    A: "Knowing and understanding",
    B: "Inquiring and designing",
    C: "Processing and evaluating",
    D: "Reflecting on the impacts of science",
  },
  Mathematics: {
    A: "Knowing and understanding",
    B: "Investigating patterns",
    C: "Communicating",
    D: "Applying mathematics in real-life contexts",
  },
  Arts: {
    A: "Investigating",
    B: "Developing",
    C: "Creating or performing",
    D: "Evaluating",
  },
  Design: {
    A: "Inquiring and analysing",
    B: "Developing ideas",
    C: "Creating the solution",
    D: "Evaluating",
  },
  "Physical and Health Education": {
    A: "Knowing and understanding",
    B: "Planning for performance",
    C: "Applying and performing",
    D: "Reflecting and improving performance",
  },
};

export const SUBJECT_GROUP_NAMES = Object.keys(SUBJECT_GROUPS);
export const CRITERIA = ["A", "B", "C", "D"] as const;

export function criterionName(subjectGroup: string, criterion: string): string {
  const group = SUBJECT_GROUPS[subjectGroup];
  if (!group) return "";
  return group[criterion as "A" | "B" | "C" | "D"] ?? "";
}

// Indicative achievement level (0 to 8) from marks earned vs marks available.
export function indicativeLevel(earned: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((earned / max) * 8);
}

// A question can assess several criteria, each with its own strands.
export type CriterionRef = { criterion: string; strands: string; marks: number };

export function parseCriteria(json: string): CriterionRef[] {
  try {
    const arr = JSON.parse(json || "[]");
    if (Array.isArray(arr))
      return arr
        .filter((c) => CRITERIA.includes(c?.criterion))
        .map((c) => ({
          criterion: c.criterion,
          strands: c.strands ?? "",
          marks: Number.isFinite(Number(c.marks)) && Number(c.marks) > 0 ? Math.round(Number(c.marks)) : 0,
        }));
  } catch {}
  return [];
}

/**
 * Questions written before marks were split per criterion carry the whole
 * total on the question and nothing on each criterion. Spreading the total
 * across them keeps those questions reading sensibly until a teacher sets
 * the real split, with any remainder going to the first criterion.
 */
export function ensureCriterionMarks(list: CriterionRef[], questionMarks: number): CriterionRef[] {
  if (list.length === 0) return list;
  if (list.some((c) => c.marks > 0)) return list;

  const each = Math.floor(questionMarks / list.length);
  const remainder = questionMarks - each * list.length;
  return list.map((c, i) => ({ ...c, marks: each + (i === 0 ? remainder : 0) }));
}

export function criteriaTotal(list: CriterionRef[]): number {
  return list.reduce((sum, c) => sum + (c.marks || 0), 0);
}

/** Marks a question contributes to one criterion, zero if it does not assess it. */
export function marksForCriterion(list: CriterionRef[], criterion: string): number {
  return list.find((c) => c.criterion === criterion)?.marks ?? 0;
}
