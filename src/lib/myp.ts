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
export type CriterionRef = { criterion: string; strands: string };

export function parseCriteria(json: string): CriterionRef[] {
  try {
    const arr = JSON.parse(json || "[]");
    if (Array.isArray(arr))
      return arr.filter((c) => CRITERIA.includes(c?.criterion))
        .map((c) => ({ criterion: c.criterion, strands: c.strands ?? "" }));
  } catch {}
  return [];
}
