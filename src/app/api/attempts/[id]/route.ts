import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

// Autosave: upsert one answer (content / flag / time spent).
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getSession();
  const { id } = await ctx.params;
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const attempt = await db.attempt.findUnique({ where: { id } });
  if (!attempt || attempt.studentId !== session.userId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (attempt.status !== "IN_PROGRESS")
    return NextResponse.json({ error: "Attempt already submitted" }, { status: 409 });

  const { questionId, content, flagged, addTimeSec } = await req.json();

  // The question has to belong to the paper being attempted. Without this a
  // valid id from another assessment would write a stray answer, and a made
  // up id would throw on the foreign key as an unhandled 500.
  const belongs = await db.question.findFirst({
    where: { id: questionId, assessmentId: attempt.assessmentId },
    select: { id: true },
  });
  if (!belongs)
    return NextResponse.json({ error: "Unknown question" }, { status: 400 });

  const existing = await db.answer.findUnique({
    where: { attemptId_questionId: { attemptId: id, questionId } },
  });

  await db.answer.upsert({
    where: { attemptId_questionId: { attemptId: id, questionId } },
    create: {
      attemptId: id,
      questionId,
      content: content ?? "",
      flagged: !!flagged,
      timeSpentSec: addTimeSec ?? 0,
    },
    update: {
      ...(content !== undefined && { content }),
      ...(flagged !== undefined && { flagged }),
      ...(addTimeSec ? { timeSpentSec: (existing?.timeSpentSec ?? 0) + addTimeSec } : {}),
    },
  });

  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
