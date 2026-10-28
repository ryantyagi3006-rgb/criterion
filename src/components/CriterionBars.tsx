import { criterionName } from "@/lib/myp";

export type CriterionRow = { criterion: string; level: number; earned: number; max: number };

/**
 * Criterion levels for one subject.
 *
 * The bar tracks the level out of 8, which is the number being shown. Drawing
 * it from the raw mark percentage instead made two criteria at the same level
 * come out different lengths, which read as though one were better than the
 * other.
 */
export default function CriterionBars({
  subject,
  rows,
}: {
  subject: string;
  rows: CriterionRow[];
}) {
  return (
    <div className="space-y-3">
      {[...rows].sort((a, b) => a.criterion.localeCompare(b.criterion)).map((r) => (
        <div key={r.criterion}>
          <div className="flex justify-between items-baseline text-xs mb-1">
            <span className="text-soft">
              <span className="font-bold text-ink">{r.criterion}</span>{" "}
              {criterionName(subject, r.criterion)}
            </span>
            <span className="text-base font-semibold text-teal">
              {r.level}
              <span className="text-soft text-xs">/8</span>
            </span>
          </div>
          <div
            className="h-1.5 rounded-full bg-paper overflow-hidden"
            role="img"
            aria-label={`Criterion ${r.criterion}, level ${r.level} of 8`}
          >
            <div
              className="h-full rounded-full bg-teal"
              style={{ width: `${(Math.min(8, Math.max(0, r.level)) / 8) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
