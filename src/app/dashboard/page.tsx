import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiAvailable } from "@/lib/ai-available";
import { criterionName, indicativeLevel, parseCriteria, ensureCriterionMarks } from "@/lib/myp";
import { effectiveScores } from "@/lib/scores";
import { formatDate, formatDateTime } from "@/lib/dates";
import Shell from "@/components/Shell";
import UploadCard from "@/components/UploadCard";
import StartButton from "@/components/StartButton";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  DRAFT: "bg-amberwash text-amber",
  PUBLISHED: "bg-tealwash text-tealdeep",
  ARCHIVED: "bg-paper text-soft",
  IN_PROGRESS: "bg-tealwash text-tealdeep",
  SUBMITTED: "bg-amberwash text-amber",
  MARKED: "bg-amberwash text-amber",
  RELEASED: "bg-tealwash text-tealdeep",
};

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/");

  return session.role === "TEACHER" ? (
    <TeacherDashboard userId={session.userId} name={session.name} />
  ) : (
    <StudentDashboard userId={session.userId} name={session.name} />
  );
}

async function TeacherDashboard({ userId, name }: { userId: string; name: string }) {
  // Selected rather than included: this page shows counts and totals, so
  // pulling whole questions would drag every embedded image through it.
  const assessments = await db.assessment.findMany({
    where: { teacherId: userId },
    select: {
      id: true, title: true, subject: true, totalMarks: true,
      mode: true, aiConfidence: true, status: true,
      _count: { select: { questions: true } },
      attempts: {
        select: {
          id: true, status: true, totalScore: true,
          student: { select: { name: true } },
          answers: { select: { aiScore: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const pendingReview = assessments.flatMap((a) =>
    a.attempts.filter((t) => t.status === "SUBMITTED" || t.status === "MARKED").map((t) => ({ ...t, assessment: a }))
  );

  return (
    <Shell name={name} role="TEACHER">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-8">
          <UploadCard aiAvailable={aiAvailable()} />

          <section>
            <p className="microlabel mb-1">Your library</p>
            <h2 className="font-display text-2xl font-semibold mb-4 text-ink">Assessments</h2>
            {assessments.length === 0 && (
              <p className="text-sm text-soft rounded-xl border border-dashed border-line p-6 text-center">
                Upload a task sheet above to create your first assessment.
              </p>
            )}
            <div className="space-y-3">
              {assessments.map((a) => {
                const released = a.attempts.filter((t) => t.status === "RELEASED");
                const avg = released.length
                  ? released.reduce((s, t) => s + (t.totalScore ?? 0), 0) / released.length
                  : null;
                return (
                  <Link key={a.id} href={`/assessment/${a.id}/edit`}
                    className="block rounded-xl border border-line bg-surface p-4 hover:border-teal transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-ink">{a.title}</div>
                        <div className="text-xs text-soft mt-1">
                          {a.subject} &middot; {a._count.questions} questions &middot; {a.totalMarks} marks &middot;{" "}
                          {a.mode === "EXAM" ? "Exam" : "Practice"}
                          {a.aiConfidence > 0 && <> &middot; parse confidence {(a.aiConfidence * 100).toFixed(0)}%</>}
                        </div>
                        <div className="text-xs text-soft mt-1">
                          {a.attempts.length} attempt{a.attempts.length === 1 ? "" : "s"}
                          {avg !== null && <> &middot; class average {avg.toFixed(1)}/{a.totalMarks}</>}
                        </div>
                      </div>
                      <span className={`text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full ${statusBadge[a.status]}`}>
                        {a.status}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        <aside>
          <p className="microlabel mb-1">Moderation queue</p>
          <h2 className="font-display text-2xl font-semibold mb-4 text-ink">To review</h2>
          {pendingReview.length === 0 && (
            <p className="text-sm text-soft rounded-xl border border-dashed border-line p-5 text-center">
              Nothing waiting. Submissions appear here after marking.
            </p>
          )}
          <div className="space-y-3">
            {pendingReview.map((t) => (
              <Link key={t.id} href={`/review/${t.id}`}
                className="block rounded-xl border border-line bg-surface p-4 hover:border-teal transition-colors">
                <div className="font-semibold text-sm text-ink">{t.student.name}</div>
                <div className="text-xs text-soft mt-0.5">{t.assessment.title}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusBadge[t.status]}`}>
                    {t.status === "MARKED" ? "Marked, review" : "Awaiting marking"}
                  </span>
                  {t.status === "MARKED" && (
                    <span className="text-xs text-soft">
                      {t.answers.reduce((s, x) => s + (x.aiScore ?? 0), 0)}/{t.assessment.totalMarks}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </Shell>
  );
}

async function StudentDashboard({ userId, name }: { userId: string; name: string }) {
  const [published, attempts] = await Promise.all([
    db.assessment.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true, title: true, subject: true, totalMarks: true,
        durationMinutes: true, mode: true, dueDate: true,
        _count: { select: { questions: true } },
        teacher: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.attempt.findMany({
      where: { studentId: userId },
      select: {
        id: true, assessmentId: true, status: true, submittedAt: true, totalScore: true,
        assessment: { select: { title: true, subject: true, totalMarks: true } },
        // Only what the criterion analytics need, not the question text,
        // stimulus or images.
        answers: {
          select: {
            score: true, aiScore: true, criterionScores: true, aiCriterionScores: true,
            question: { select: { criteria: true, marks: true } },
          },
        },
      },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  const attemptByAssessment = new Map(attempts.map((t) => [t.assessmentId, t]));
  const upcoming = published.filter((a) => {
    const t = attemptByAssessment.get(a.id);
    return !t || t.status === "IN_PROGRESS";
  });
  const done = attempts.filter((t) => t.status !== "IN_PROGRESS");

  // Criterion achievement per subject group, from released results.
  // Each criterion counts only the marks available under it and the marks
  // actually awarded there, so a question spanning two criteria is not
  // counted at full value against both.
  const critStats = new Map<string, { earned: number; max: number }>();
  for (const t of done.filter((d) => d.status === "RELEASED")) {
    for (const a of t.answers) {
      const criteria = ensureCriterionMarks(parseCriteria(a.question.criteria), a.question.marks);
      const awarded = effectiveScores(
        a.criterionScores && a.criterionScores !== "{}" ? a.criterionScores : a.aiCriterionScores,
        a.score ?? a.aiScore ?? 0,
        criteria
      );
      for (const c of criteria) {
        const key = `${t.assessment.subject}::${c.criterion}`;
        const cur = critStats.get(key) ?? { earned: 0, max: 0 };
        cur.earned += awarded[c.criterion] ?? 0;
        cur.max += c.marks;
        critStats.set(key, cur);
      }
    }
  }
  const bySubject = new Map<string, { criterion: string; level: number; pct: number }[]>();
  for (const [key, v] of critStats) {
    const [subject, criterion] = key.split("::");
    const rows = bySubject.get(subject) ?? [];
    rows.push({ criterion, level: indicativeLevel(v.earned, v.max), pct: (v.earned / v.max) * 100 });
    bySubject.set(subject, rows);
  }

  return (
    <Shell name={name} role="STUDENT">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-8">
          <section>
            <p className="microlabel mb-1">Ready when you are</p>
            <h2 className="font-display text-2xl font-semibold mb-4 text-ink">Open assessments</h2>
            {upcoming.length === 0 && (
              <p className="text-sm text-soft rounded-xl border border-dashed border-line p-6 text-center">
                Nothing open right now. Check back later.
              </p>
            )}
            <div className="space-y-3">
              {upcoming.map((a) => {
                const t = attemptByAssessment.get(a.id);
                return (
                  <div key={a.id} className="rounded-xl border border-line bg-surface p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-ink">{a.title}</div>
                      <div className="text-xs text-soft mt-1">
                        {a.subject} &middot; {a._count.questions} questions &middot; {a.totalMarks} marks
                        {a.durationMinutes ? <> &middot; {a.durationMinutes} min</> : null} &middot;{" "}
                        {a.mode === "EXAM" ? "Exam mode" : "Practice mode, tutor on"} &middot; set by {a.teacher.name}
                      </div>
                      {a.dueDate && (
                        <div className="text-xs text-amber mt-1">Due {formatDate(a.dueDate)}</div>
                      )}
                    </div>
                    <StartButton assessmentId={a.id} resuming={!!t} />
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <p className="microlabel mb-1">Your record</p>
            <h2 className="font-display text-2xl font-semibold mb-4 text-ink">Completed</h2>
            {done.length === 0 && <p className="text-sm text-soft">No submissions yet.</p>}
            <div className="space-y-3">
              {done.map((t) => (
                <Link key={t.id} href={`/attempt/${t.id}/results`}
                  className="block rounded-xl border border-line bg-surface p-4 hover:border-teal transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-ink">{t.assessment.title}</div>
                      <div className="text-xs text-soft mt-1">
                        Submitted {t.submittedAt ? formatDateTime(t.submittedAt) : "recently"}
                      </div>
                    </div>
                    {t.status === "RELEASED" ? (
                      <div className="text-right">
                        <div className="font-display text-2xl font-semibold text-teal">
                          {t.totalScore ?? 0}<span className="text-sm text-soft">/{t.assessment.totalMarks}</span>
                        </div>
                        <div className="text-xs text-soft">View feedback</div>
                      </div>
                    ) : (
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusBadge[t.status]}`}>
                        {t.status === "MARKED" ? "With your teacher" : "Submitted"}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside>
          <p className="microlabel mb-1">Criteria A to D</p>
          <h2 className="font-display text-2xl font-semibold mb-4 text-ink">Achievement</h2>
          {bySubject.size === 0 ? (
            <p className="text-sm text-soft rounded-xl border border-dashed border-line p-5 text-center">
              Complete assessments to see your criterion levels here.
            </p>
          ) : (
            <div className="space-y-4">
              {[...bySubject.entries()].map(([subject, rows]) => (
                <div key={subject} className="rounded-xl border border-line bg-surface p-4">
                  <div className="font-semibold text-sm text-ink mb-3">{subject}</div>
                  <div className="space-y-3">
                    {rows.sort((a, b) => a.criterion.localeCompare(b.criterion)).map((r) => (
                      <div key={r.criterion}>
                        <div className="flex justify-between items-baseline text-xs mb-1">
                          <span className="text-soft">
                            <span className="font-bold text-ink">{r.criterion}</span>{" "}
                            {criterionName(subject, r.criterion)}
                          </span>
                          <span className="font-display text-base font-semibold text-teal">{r.level}<span className="text-soft text-xs">/8</span></span>
                        </div>
                        <div className="h-1.5 rounded-full bg-paper overflow-hidden">
                          <div className="h-full rounded-full bg-teal" style={{ width: `${r.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-soft mt-3">
                    Indicative levels from marks earned. Final levels are your teacher&apos;s best-fit judgement.
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </Shell>
  );
}
