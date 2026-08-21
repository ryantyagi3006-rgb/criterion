import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parseCriteria, ensureCriterionMarks } from "@/lib/myp";
import { clampScores, scoresTotal } from "@/lib/scores";

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

  const { scores, overallFeedback, release, reopen } = await req.json();

  if (reopen) {
    await db.attempt.update({ where: { id }, data: { status: "IN_PROGRESS", submittedAt: null, totalScore: null } });
    return NextResponse.json({ ok: true });
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

  if (release) {
    const answers = await db.answer.findMany({ where: { attemptId: id } });
    const total = answers.reduce((sum, a) => sum + (a.score ?? a.aiScore ?? 0), 0);
    await db.attempt.update({
      where: { id },
      data: {
        status: "RELEASED",
        totalScore: total,
        ...(overallFeedback !== undefined && { overallFeedback }),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
