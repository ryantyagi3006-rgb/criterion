"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AnswerDisplay from "./AnswerDisplay";
import CriterionTags from "./CriterionTag";
import DiagramStrip from "./DiagramStrip";
import StimulusPanel from "./StimulusPanel";
import MediaPanel from "./MediaPanel";
import { CRITERIA, criterionName, indicativeLevel, parseCriteria, ensureCriterionMarks, marksForCriterion } from "@/lib/myp";
import { effectiveScores, parseScores, scoresTotal, type CriterionScores } from "@/lib/scores";
import { formatDateTime } from "@/lib/dates";

type Props = {
  attempt: {
    id: string; status: string; submittedAt: string | null; overallFeedback: string;
    student: { name: string; email: string };
    answers: {
      questionId: string; content: string; timeSpentSec: number;
      score: number | null; aiScore: number | null; aiFeedback: string; aiConfidence: number;
      criterionScores: string; aiCriterionScores: string;
    }[];
    assessment: {
      title: string; subject: string; totalMarks: number;
      questions: {
        id: string; number: string; text: string; marks: number; answerFormat: string;
        topic: string; rubric: string; criteria: string; diagrams: string;
        stimulus: string; stimulusTitle: string; media: string;
      }[];
    };
  };
};

// Teacher moderation: review suggested marks, adjust, then release.
export default function ReviewPanel({ attempt }: Props) {
  const router = useRouter();
  const { assessment, student } = attempt;
  // Marks are held per question per criterion. Answers marked before this
  // existed fall back to sharing their single total in the marks ratio.
  const criteriaFor = (q: (typeof assessment.questions)[number]) =>
    ensureCriterionMarks(parseCriteria(q.criteria), q.marks);

  const [scores, setScores] = useState<Record<string, CriterionScores>>(() =>
    Object.fromEntries(
      assessment.questions.map((q) => {
        const a = attempt.answers.find((x) => x.questionId === q.id);
        const criteria = criteriaFor(q);
        const stored = a?.criterionScores ?? "{}";
        const aiStored = a?.aiCriterionScores ?? "{}";
        const source = Object.keys(parseScores(stored)).length ? stored : aiStored;
        return [q.id, effectiveScores(source, a?.score ?? a?.aiScore ?? 0, criteria)];
      })
    )
  );
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      assessment.questions.map((q) => [q.id, attempt.answers.find((x) => x.questionId === q.id)?.aiFeedback ?? ""])
    )
  );
  const [overall, setOverall] = useState(attempt.overallFeedback);
  const [busy, setBusy] = useState(false);

  const total = Object.values(scores).reduce((sum, byCriterion) => sum + scoresTotal(byCriterion), 0);
  const released = attempt.status === "RELEASED";

  // Each criterion's grade is the marks actually awarded under it, summed
  // across the questions that assess it.
  const critRows = CRITERIA.map((c) => {
    let max = 0;
    let earned = 0;
    for (const q of assessment.questions) {
      const share = marksForCriterion(criteriaFor(q), c);
      if (share <= 0) continue;
      max += share;
      earned += scores[q.id]?.[c] ?? 0;
    }
    return { criterion: c, max, earned, level: indicativeLevel(earned, max) };
  }).filter((r) => r.max > 0);

  async function act(body: object) {
    setBusy(true);
    await fetch(`/api/attempts/${attempt.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    router.refresh();
  }

  function payloadScores() {
    return assessment.questions.map((q) => ({
      questionId: q.id,
      criterionScores: scores[q.id] ?? {},
      feedback: feedbacks[q.id],
    }));
  }

  const input = "rounded-lg border border-line bg-paper text-ink outline-none focus:border-teal focus:ring-1 focus:ring-teal";

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="rounded-2xl bg-surface border border-line p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="microlabel mb-1">{assessment.subject}</p>
            <h1 className="font-display text-2xl font-semibold text-ink">{student.name}</h1>
            <p className="text-sm text-soft mt-1">
              {assessment.title}, submitted {attempt.submittedAt ? formatDateTime(attempt.submittedAt) : "recently"}
            </p>
            <p className="text-xs text-soft mt-1">
              {released ? "Released to student" : attempt.status === "MARKED" ? "Marked, awaiting your review" : "Awaiting marking. Score manually below."}
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-4xl font-semibold text-teal">
              {total}<span className="text-lg text-soft">/{assessment.totalMarks}</span>
            </div>
            <div className="microlabel mt-1">Current total</div>
          </div>
        </div>

        {critRows.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {critRows.map((r) => (
              <div key={r.criterion} className="rounded-lg border border-line bg-paper p-2.5 text-center">
                <div className="text-xs text-soft">Criterion {r.criterion}</div>
                <div className="font-display text-lg font-semibold text-ink">{r.earned}/{r.max}</div>
                <div className="text-[11px] text-soft">level {r.level}/8</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <button disabled={busy} onClick={() => act({ scores: payloadScores(), overallFeedback: overall, release: true })}
            className="rounded-lg bg-teal hover:bg-tealdeep text-paper px-4 py-2 text-sm font-semibold disabled:opacity-50 transition-colors">
            {released ? "Re-release with changes" : "Approve and release"}
          </button>
          <button disabled={busy} onClick={() => act({ scores: payloadScores(), overallFeedback: overall })}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50 hover:border-soft transition-colors">
            Save without releasing
          </button>
          <button disabled={busy} onClick={() => { if (confirm("Reopen this submission so the student can continue? Their answers are kept.")) act({ reopen: true }); }}
            className="rounded-lg border border-amber px-4 py-2 text-sm font-semibold text-amber disabled:opacity-50">
            Reopen submission
          </button>
        </div>
      </div>

      {assessment.questions.map((q) => {
        const a = attempt.answers.find((x) => x.questionId === q.id);
        return (
          <div key={q.id} className="rounded-xl bg-surface border border-line p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold text-ink">Question {q.number}</h2>
                <div className="mt-1">
                  <CriterionTags subjectGroup={assessment.subject} criteria={q.criteria} />
                </div>
                <div className="text-xs text-soft mt-1">
                  {q.topic}
                  {a?.timeSpentSec ? `, ${Math.round(a.timeSpentSec / 60)} min spent` : ""}
                  {a && a.aiConfidence > 0 && (
                    <> , marking confidence {(a.aiConfidence * 100).toFixed(0)}%
                      {a.aiConfidence < 0.6 && <span className="text-amber"> (check manually)</span>}
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className="flex flex-wrap justify-end gap-1.5">
                  {criteriaFor(q).map((c) => (
                    <label
                      key={c.criterion}
                      className="flex items-center gap-1 rounded-lg border border-line bg-paper px-2 py-1"
                      title={`${criterionName(assessment.subject, c.criterion)}, out of ${c.marks}`}
                    >
                      <span className="grid place-items-center w-5 h-5 rounded bg-teal text-paper text-[11px] font-bold">
                        {c.criterion}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={c.marks}
                        step={0.5}
                        value={scores[q.id]?.[c.criterion] ?? 0}
                        onChange={(e) =>
                          setScores((prev) => ({
                            ...prev,
                            [q.id]: {
                              ...prev[q.id],
                              [c.criterion]: Math.min(c.marks, Math.max(0, +e.target.value || 0)),
                            },
                          }))
                        }
                        className="w-12 bg-transparent text-sm text-right font-bold outline-none text-ink"
                        aria-label={`Marks for criterion ${c.criterion} on question ${q.number}`}
                      />
                      <span className="text-xs text-soft">/{c.marks}</span>
                    </label>
                  ))}
                </div>
                <span className="text-xs text-soft">
                  {scoresTotal(scores[q.id] ?? {})}/{q.marks} total
                </span>
              </div>
            </div>
            <p className="mt-3 text-sm text-ink whitespace-pre-wrap leading-relaxed">{q.text}</p>
            <DiagramStrip diagrams={q.diagrams} small />
            <MediaPanel media={q.media} compact />
            <StimulusPanel stimulus={q.stimulus} title={q.stimulusTitle} compact />
            {q.rubric && (
              <p className="mt-2 text-xs text-soft border-l-2 border-line pl-2 leading-relaxed">Clarification: {q.rubric}</p>
            )}
            <div className="mt-3 rounded-lg bg-paper border border-line p-3">
              <div className="microlabel mb-1.5">Student answer</div>
              <AnswerDisplay format={q.answerFormat} content={a?.content ?? ""} />
            </div>
            <label className="block mt-3 microlabel">
              Feedback to student
              {a?.aiScore !== null && a?.aiScore !== undefined && (
                <span className="normal-case tracking-normal font-normal"> (suggested {a.aiScore}/{q.marks}, edit freely)</span>
              )}
              <textarea
                value={feedbacks[q.id]} rows={2}
                onChange={(e) => setFeedbacks((s) => ({ ...s, [q.id]: e.target.value }))}
                className={`${input} mt-1 w-full px-3 py-2 text-sm font-normal normal-case tracking-normal`}
              />
            </label>
          </div>
        );
      })}

      <div className="rounded-xl bg-surface border border-line p-5">
        <label className="microlabel">
          Overall feedback, edit before release
          <textarea value={overall} rows={4} onChange={(e) => setOverall(e.target.value)}
            className={`${input} mt-1 w-full px-3 py-2 text-sm font-normal normal-case tracking-normal`} />
        </label>
      </div>
    </div>
  );
}
