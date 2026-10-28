"use client";
import { useState } from "react";
import Link from "next/link";
import StartButton from "./StartButton";
import CriterionBars, { type CriterionRow } from "./CriterionBars";

export type UpcomingItem = {
  id: string;
  title: string;
  subject: string;
  meta: string;
  due: string | null;
  resuming: boolean;
};

export type SubmissionItem = {
  id: string;
  title: string;
  subject: string;
  submitted: string;
  status: string;
  totalScore: number | null;
  totalMarks: number;
  grade: number | null;
};

export type SubjectGrades = {
  subject: string;
  rows: CriterionRow[];
  bestGrade: number | null;
};

const statusBadge: Record<string, string> = {
  IN_PROGRESS: "bg-tealwash text-tealdeep",
  SUBMITTED: "bg-amberwash text-amber",
  MARKED: "bg-amberwash text-amber",
  RELEASED: "bg-tealwash text-tealdeep",
};

export default function StudentHome({
  upcoming,
  submissions,
  grades,
}: {
  upcoming: UpcomingItem[];
  submissions: SubmissionItem[];
  grades: SubjectGrades[];
}) {
  const [tab, setTab] = useState<"upcoming" | "submissions">("upcoming");
  const [showGrades, setShowGrades] = useState(false);

  const tabClass = (active: boolean) =>
    `px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
      active ? "border-teal text-ink" : "border-transparent text-soft hover:text-ink"
    }`;

  return (
    <div>
      <div className="flex items-end justify-between gap-4 border-b border-line mb-6 flex-wrap">
        <div className="flex" role="tablist" aria-label="Your work">
          <button
            role="tab"
            aria-selected={tab === "upcoming"}
            onClick={() => setTab("upcoming")}
            className={tabClass(tab === "upcoming")}
          >
            Upcoming assessments
            {upcoming.length > 0 && (
              <span className="ml-2 text-[11px] rounded-full bg-tealwash text-tealdeep px-1.5 py-0.5">
                {upcoming.length}
              </span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={tab === "submissions"}
            onClick={() => setTab("submissions")}
            className={tabClass(tab === "submissions")}
          >
            Submissions
            {submissions.length > 0 && (
              <span className="ml-2 text-[11px] rounded-full bg-paper text-soft px-1.5 py-0.5">
                {submissions.length}
              </span>
            )}
          </button>
        </div>

        <button
          onClick={() => setShowGrades(true)}
          className="mb-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-teal transition-colors"
        >
          View grades
        </button>
      </div>

      {tab === "upcoming" ? (
        <section aria-label="Upcoming assessments">
          {upcoming.length === 0 ? (
            <p className="text-sm text-soft rounded-xl border border-dashed border-line p-6 text-center">
              Nothing open right now. Check back later.
            </p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-line bg-surface p-4 flex items-center justify-between gap-4 flex-wrap"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{a.title}</div>
                    <div className="text-xs text-soft mt-1">{a.meta}</div>
                    {a.due && <div className="text-xs text-amber mt-1">Due {a.due}</div>}
                  </div>
                  <StartButton assessmentId={a.id} resuming={a.resuming} />
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section aria-label="Submissions">
          {submissions.length === 0 ? (
            <p className="text-sm text-soft rounded-xl border border-dashed border-line p-6 text-center">
              No submissions yet. Work you hand in appears here.
            </p>
          ) : (
            <div className="space-y-3">
              {submissions.map((t) => (
                <Link
                  key={t.id}
                  href={`/attempt/${t.id}/results`}
                  className="block rounded-xl border border-line bg-surface p-4 hover:border-teal transition-colors"
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{t.title}</div>
                      <div className="text-xs text-soft mt-1">
                        {t.subject} &middot; submitted {t.submitted}
                      </div>
                    </div>
                    {t.status === "RELEASED" ? (
                      <div className="text-right">
                        <div className="text-2xl font-semibold text-teal">
                          {t.totalScore ?? 0}
                          <span className="text-sm text-soft">/{t.totalMarks}</span>
                        </div>
                        <div className="text-xs text-soft">
                          {t.grade !== null ? `Grade ${t.grade}/7, view feedback` : "View feedback"}
                        </div>
                      </div>
                    ) : (
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusBadge[t.status] ?? "bg-paper text-soft"}`}
                      >
                        {t.status === "MARKED" ? "With your teacher" : "Submitted"}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {showGrades && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Your grades"
          onClick={() => setShowGrades(false)}
        >
          <div
            className="rounded-xl bg-surface border border-line p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-xl fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="microlabel">Criteria A to D</p>
                <h2 className="text-xl font-semibold text-ink mt-0.5">Your grades</h2>
              </div>
              <button
                onClick={() => setShowGrades(false)}
                className="text-soft hover:text-ink text-sm font-semibold"
                aria-label="Close grades"
              >
                Close
              </button>
            </div>

            {grades.length === 0 ? (
              <p className="text-sm text-soft rounded-xl border border-dashed border-line p-5 text-center mt-5">
                Complete an assessment to see your levels here.
              </p>
            ) : (
              <div className="space-y-4 mt-5">
                {grades.map((g) => (
                  <div key={g.subject} className="rounded-xl border border-line bg-paper p-4">
                    <div className="flex items-baseline justify-between mb-3 gap-3">
                      <div className="font-semibold text-sm text-ink">{g.subject}</div>
                      {g.bestGrade !== null && (
                        <div className="text-xs text-soft">
                          Grade <span className="text-base font-semibold text-teal">{g.bestGrade}</span>/7
                        </div>
                      )}
                    </div>
                    <CriterionBars subject={g.subject} rows={g.rows} />
                  </div>
                ))}
                <p className="text-[11px] text-soft">
                  Levels come from marks earned so far. Your teacher sets the final level and
                  grade, since boundaries differ by subject and year.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
