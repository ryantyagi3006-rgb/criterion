import { criterionName, parseCriteria, type CriterionRef } from "@/lib/myp";

// Criterion labels styled like the header of an MYP task sheet question,
// e.g.  [A] Criterion A: Knowing and understanding (strands i, ii)  [C] Criterion C: ...
// Accepts either the stored JSON string or an already-parsed list.
export default function CriterionTags({
  subjectGroup,
  criteria,
  compact = false,
}: {
  subjectGroup: string;
  criteria: string | CriterionRef[];
  compact?: boolean;
}) {
  const list = typeof criteria === "string" ? parseCriteria(criteria) : criteria;
  if (list.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1.5 align-middle">
      {list.map((c) => {
        const name = criterionName(subjectGroup, c.criterion);
        return (
          <span key={c.criterion} className="inline-flex items-center gap-1.5">
            <span className="grid place-items-center w-5 h-5 rounded bg-teal text-paper text-[11px] font-bold shrink-0">
              {c.criterion}
            </span>
            {!compact && (
              <span className="text-xs font-medium text-tealdeep">
                Criterion {c.criterion}
                {name ? `: ${name}` : ""}
                {c.strands ? ` (strands ${c.strands})` : ""}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
