import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Remove a question, then close the gap in the ordering.
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; questionId: string }> }
) {
  const session = await getSession();
  const { id, questionId } = await ctx.params;
  if (!session || session.role !== "TEACHER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assessment = await db.assessment.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!assessment || assessment.teacherId !== session.userId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (assessment.questions.length <= 1)
    return NextResponse.json(
      { error: "An assessment needs at least one question." },
      { status: 400 }
    );
  if (!assessment.questions.some((q) => q.id === questionId))
    return NextResponse.json({ error: "Question not found" }, { status: 404 });

  // Answers cascade with the question, so any existing attempts lose only
  // the responses to this question rather than breaking outright.
  await db.question.delete({ where: { id: questionId } });

  const remaining = assessment.questions.filter((q) => q.id !== questionId);
  await Promise.all(
    remaining.map((q, index) =>
      q.order === index
        ? null
        : db.question.update({ where: { id: q.id }, data: { order: index } })
    )
  );

  await db.assessment.update({
    where: { id },
    data: { totalMarks: remaining.reduce((sum, q) => sum + q.marks, 0) },
  });

  return NextResponse.json({ ok: true });
}
