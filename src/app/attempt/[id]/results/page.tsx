import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { CRITERIA, criterionName, indicativeLevel, parseCriteria, ensureCriterionMarks, marksForCriterion } from "@/lib/myp";
import Shell from "@/components/Shell";
import AnswerDisplay from "@/components/AnswerDisplay";
import CriterionTags from "@/components/CriterionTag";
import DiagramStrip from "@/components/DiagramStrip";
import StimulusPanel from "@/components/StimulusPanel";

export const dynamic = "force-dynamic";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/");

  const { id } = await params;
  const attempt = await db.attempt.findUnique({
    where: { id },
    include: {
      answers: true,
      assessment: { include: { questions: { orderBy: { order: "asc" } } } },
    },
  });
  if (!attempt || attempt.studentId !== session.userId) notFound();
  if (attempt.status === "IN_PROGRESS") redirect(`/attempt/${id}`);

  const released = attempt.status === "RELEASED";
  const { assessment } = attempt;
  const answerFor = (qid: string) => attempt.answers.find((a) => a.questionId === qid);

  // Criterion breakdown for the released result. A question contributes its
  // marks to every criterion it assesses.
  const critRows = CRITERIA.map((c) => {
    // Only the marks assigned to this criterion count toward it, and a
    // student's score on a split question is shared out in the same ratio.
    let max = 0;
    let earned = 0;
    for (const q of assessment.questions) {
      const criteria = ensureCriterionMarks(parseCriteria(q.criteria), q.marks);
      const share = marksForCriterion(criteria, c);
      if (share <= 0) continue;
      const questionTotal = criteria.reduce((sum, x) => sum + x.marks, 0) || q.marks;
      const a = answerFor(q.id);
      const scored = a?.score ?? a?.aiScore ?? 0;
      max += share;
      earned += questionTotal > 0 ? (scored * share) / questionTotal : 0;
    }
    return { criterion: c, max, earned, level: indicativeLevel(earned, max) };
  }).filter((r) => r.max > 0);

  return (
    <Shell name={session.name} role={session.role}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="rounded-2xl bg-surface border border-line p-6 text-center">
          <p className="microlabel mb-1">{assessment.subject}</p>
          <h1 className="font-display text-2xl font-semibold text-ink">{assessment.title}</h1>
          {released ? (
            <>
              <div className="mt-4 font-display text-6xl font-semibold text-teal">
                {attempt.totalScore ?? 0}
                <span className="text-2xl text-soft">/{assessment.totalMarks}</span>
              </div>
              <div className="text-sm text-soft mt-1">
                {(((attempt.totalScore ?? 0) / Math.max(1, assessment.totalMarks)) * 100).toFixed(0)}%, reviewed and released by your teacher
              </div>

              {critRows.length > 0 && (
                <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                  {critRows.map((r) => (
                    <div key={r.criterion} className="rounded-xl border border-line bg-paper p-3">
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-ink">{r.criterion}</span>
                        <span className="font-display text-xl font-semibold text-teal">{r.level}<span className="text-xs text-soft">/8</span></span>
                      </div>
                      <div className="text-[11px] text-soft mt-1 leading-tight">{criterionName(assessment.subject, r.criterion)}</div>
                      <div className="text-[11px] text-soft mt-1">{r.earned}/{r.max} marks</div>
                    </div>
                  ))}
                </div>
              )}

              {attempt.overallFeedback && (
                <div className="mt-5 text-left rounded-xl bg-tealwash p-4 text-sm text-ink whitespace-pre-wrap leading-relaxed">
                  <span className="microlabel">Overall feedback</span>
                  <p className="mt-1">{attempt.overallFeedback}</p>
                </div>
              )}
            </>
          ) : (
            <div className="mt-4">
              <p className="font-display text-xl font-semibold text-ink">Submitted</p>
              <p className="text-sm text-soft mt-2 max-w-md mx-auto leading-relaxed">
                {attempt.status === "MARKED"
                  ? "Marking is done. Your teacher is reviewing it before results are released."
                  : "Your work is in. Marks appear here once your teacher releases them."}
              </p>
            </div>
          )}
          <Link href="/dashboard" className="inline-block mt-5 text-sm font-semibold text-teal hover:underline">
            Back to dashboard
          </Link>
        </div>

        {released && assessment.questions.map((q) => {
          const a = answerFor(q.id);
          const score = a?.score ?? a?.aiScore ?? 0;
          const pct = score / q.marks;
          return (
            <div key={q.id} className="rounded-xl bg-surface border border-line p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display font-semibold text-ink">Question {q.number}</h2>
                  <div className="mt-1">
                    <CriterionTags subjectGroup={assessment.subject} criteria={q.criteria} />
                  </div>
                </div>
                <span className={`shrink-0 text-sm font-bold px-3 py-1 rounded-full ${
                  pct >= 0.8 ? "bg-tealwash text-tealdeep" :
                  pct >= 0.5 ? "bg-amberwash text-amber" :
                  "bg-paper border border-line text-soft"
                }`}>
                  {score}/{q.marks}
                </span>
              </div>
              <p className="mt-3 text-sm text-ink whitespace-pre-wrap leading-relaxed">{q.text}</p>
              <DiagramStrip diagrams={q.diagrams} small />
              <StimulusPanel stimulus={q.stimulus} title={q.stimulusTitle} compact />
              <div className="mt-3 rounded-lg bg-paper border border-line p-3">
                <div className="microlabel mb-1.5">Your answer</div>
                <AnswerDisplay format={q.answerFormat} content={a?.content ?? ""} />
              </div>
              {a?.aiFeedback && (
                <div className="mt-3 text-sm text-ink border-l-2 border-teal pl-3 whitespace-pre-wrap leading-relaxed">
                  {a.aiFeedback}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
