import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parseCriteria, ensureCriterionMarks } from "@/lib/myp";
import { clampScores, scoresTotal } from "@/lib/scores";

/** MYP criterion levels run 0 to 8. */
function normaliseLevels(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const key of ["A", "B", "C", "D"]) {
    const value = Number((raw as Record<string, unknown>)[key]);
    if (Number.isFinite(value)) out[key] = Math.min(8, Math.max(0, Math.round(value)));
  }
  return out;
}

/** MYP grades run 1 to 7. Null clears it. */
function normaliseGrade(raw: unknown): number | null {
  if (raw === null || raw === "" || raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.min(7, Math.max(1, Math.round(value)));
}

// Teacher moderates AI marks: adjust per-question scores, then release.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await ctx.params;
  if (!session || session.role !== "TEACHER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const attempt = await db.attempt.findUnique({
    where: { id },
    include: { assessment: true },
  });
  if (!attempt || attempt.assessment.teacherId !== session.userId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const {
    scores, overallFeedback, release, reopen,
    addMinutes, reopenMinutes, criterionLevels, grade,
  } = await req.json();

  const assessment = await db.assessment.findUnique({
    where: { id: attempt.assessmentId },
    select: { durationMinutes: true },
  });
  const duration = assessment?.durationMinutes ?? 0;

  // Minutes already used up, so a grant can be expressed as time from now
  // rather than time from when the student started.
  const elapsedMinutes = (Date.now() - new Date(attempt.startedAt).getTime()) / 60_000;

  // Extra time on its own, without changing the status. Granted in any amount,
  // as many times as the teacher likes.
  if (addMinutes !== undefined) {
    const minutes = Math.round(Number(addMinutes));
    if (!Number.isFinite(minutes) || minutes === 0)
      return NextResponse.json({ error: "Enter a number of minutes." }, { status: 400 });

    const updated = await db.attempt.update({
      where: { id },
      data: { extraMinutes: Math.max(0, attempt.extraMinutes + minutes) },
    });
    return NextResponse.json({ ok: true, extraMinutes: updated.extraMinutes });
  }

  if (reopen) {
    // Reopening has to give the student a deadline in the future, otherwise
    // the timer is already expired and the attempt submits itself again. The
    // teacher typed a number of minutes, so the new deadline lands exactly
    // that far from now, whatever extra time was granted before.
    const requested = Math.max(1, Math.round(Number(reopenMinutes) || 10));
    const needed = duration > 0 ? Math.ceil(elapsedMinutes + requested - duration) : 0;

    await db.attempt.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        submittedAt: null,
        totalScore: null,
        extraMinutes: needed,
      },
    });
    return NextResponse.json({ ok: true, minutesGiven: requested });
  }

  if (scores) {
    // Marks arrive per criterion. The question total is their sum, so the two
    // can never disagree, and each criterion is clamped to its own allocation.
    const questions = await db.question.findMany({
      where: { assessmentId: attempt.assessmentId },
      select: { id: true, marks: true, criteria: true },
    });

    for (const s of scores as {
      questionId: string;
      criterionScores?: Record<string, number>;
      score?: number;
      feedback?: string;
    }[]) {
      const question = questions.find((q) => q.id === s.questionId);
      if (!question) continue;

      const criteria = ensureCriterionMarks(parseCriteria(question.criteria), question.marks);
      const perCriterion = clampScores(s.criterionScores ?? {}, criteria);
      const total = Object.keys(perCriterion).length
        ? scoresTotal(perCriterion)
        : Math.min(Math.max(Number(s.score) || 0, 0), question.marks);

      await db.answer.upsert({
        where: { attemptId_questionId: { attemptId: id, questionId: s.questionId } },
        create: {
          attemptId: id, questionId: s.questionId, score: total,
          criterionScores: JSON.stringify(perCriterion),
          aiFeedback: s.feedback ?? "",
        },
        update: {
          score: total,
          criterionScores: JSON.stringify(perCriterion),
          ...(s.feedback !== undefined && { aiFeedback: s.feedback }),
        },
      });
    }
  }

  // The teacher decides the levels and the grade, because the boundaries that
  // turn marks into a level differ by subject and by year.
  const levels = normaliseLevels(criterionLevels);
  const finalGrade = normaliseGrade(grade);

  if (criterionLevels !== undefined || grade !== undefined || overallFeedback !== undefined) {
    await db.attempt.update({
      where: { id },
      data: {
        ...(criterionLevels !== undefined && { criterionLevels: JSON.stringify(levels) }),
        ...(grade !== undefined && { grade: finalGrade }),
        ...(overallFeedback !== undefined && { overallFeedback }),
      },
    });
  }

  if (release) {
    const answers = await db.answer.findMany({ where: { attemptId: id } });
    const total = answers.reduce((sum, a) => sum + (a.score ?? a.aiScore ?? 0), 0);
    await db.attempt.update({
      where: { id },
      data: { status: "RELEASED", totalScore: total },
    });
  }

  return NextResponse.json({ ok: true });
}
