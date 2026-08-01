import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

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
    for (const s of scores as { questionId: string; score: number; feedback?: string }[]) {
      await db.answer.upsert({
        where: { attemptId_questionId: { attemptId: id, questionId: s.questionId } },
        create: { attemptId: id, questionId: s.questionId, score: s.score, aiFeedback: s.feedback ?? "" },
        update: { score: s.score, ...(s.feedback !== undefined && { aiFeedback: s.feedback }) },
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
