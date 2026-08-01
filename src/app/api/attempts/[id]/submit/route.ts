import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { markAttempt } from "@/lib/gemini";

export const maxDuration = 60; // Hobby plan ceiling; raise to 300 on Pro for very long task sheets

// Submit the attempt, then run AI marking against each question's rubric.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await ctx.params;
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const attempt = await db.attempt.findUnique({
    where: { id },
    include: { answers: true, assessment: { include: { questions: true } } },
  });
  if (!attempt || attempt.studentId !== session.userId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (attempt.status !== "IN_PROGRESS")
    return NextResponse.json({ error: "Already submitted" }, { status: 409 });

  await db.attempt.update({
    where: { id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  // AI marking (skipped gracefully when no API key; teacher marks manually).
  try {
    const answerMap: Record<string, string> = {};
    for (const a of attempt.answers) answerMap[a.questionId] = a.content;

    const result = await markAttempt(
      attempt.assessment.questions.map((q) => ({
        id: q.id,
        number: q.number,
        text: q.text,
        marks: q.marks,
        rubric: q.rubric,
        answerFormat: q.answerFormat,
        criteria: q.criteria,
        stimulus: q.stimulus,
      })),
      answerMap
    );

    if (result) {
      for (const r of result.perQuestion) {
        const q = attempt.assessment.questions.find((q) => q.id === r.questionId);
        if (!q) continue;
        const score = Math.min(Math.max(r.score, 0), q.marks);
        await db.answer.upsert({
          where: { attemptId_questionId: { attemptId: id, questionId: r.questionId } },
          create: { attemptId: id, questionId: r.questionId, aiScore: score, aiFeedback: r.feedback, aiConfidence: r.confidence },
          update: { aiScore: score, aiFeedback: r.feedback, aiConfidence: r.confidence },
        });
      }
      await db.attempt.update({
        where: { id },
        data: { status: "MARKED", overallFeedback: result.overallFeedback },
      });
    }
  } catch (e) {
    console.error("AI marking failed (teacher can mark manually):", e);
  }

  return NextResponse.json({ ok: true });
}
