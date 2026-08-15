import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { normaliseMedia } from "@/lib/youtube";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getSession();
  const { id } = await ctx.params;
  if (!session || session.role !== "TEACHER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assessment = await db.assessment.findUnique({ where: { id } });
  if (!assessment || assessment.teacherId !== session.userId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { title, subject, description, instructions, status, mode, durationMinutes, dueDate, questions } = body;

  await db.assessment.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(subject !== undefined && { subject }),
      ...(description !== undefined && { description }),
      ...(instructions !== undefined && { instructions }),
      ...(status !== undefined && { status }),
      ...(mode !== undefined && { mode }),
      ...(durationMinutes !== undefined && { durationMinutes: durationMinutes || null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    },
  });

  // Teacher edits to question metadata. Only questions that genuinely belong
  // to this assessment are touched, so a malformed or stale payload is
  // rejected rather than throwing from deep inside the update.
  if (Array.isArray(questions)) {
    const owned = new Set(
      (await db.question.findMany({ where: { assessmentId: id }, select: { id: true } })).map((q) => q.id)
    );
    const unknown = questions.filter((q) => !q?.id || !owned.has(q.id));
    if (unknown.length)
      return NextResponse.json(
        { error: "One or more questions do not belong to this assessment." },
        { status: 400 }
      );

    for (const q of questions) {
      await db.question.update({
        where: { id: q.id },
        data: {
          text: q.text,
          number: q.number,
          section: q.section,
          criteria: JSON.stringify(q.criteria ?? []),
          stimulus: q.stimulus ?? "",
          stimulusTitle: q.stimulusTitle ?? "",
          media: JSON.stringify(normaliseMedia(q.media)),
          answerFormat: q.answerFormat,
          options: JSON.stringify(q.options ?? []),
          marks: q.marks,
          subject: q.subject,
          topic: q.topic,
          difficulty: q.difficulty,
          estMinutes: q.estMinutes,
          tools: JSON.stringify(q.tools ?? []),
          rubric: q.rubric,
        },
      });
    }
    const all = await db.question.findMany({ where: { assessmentId: id } });
    await db.assessment.update({
      where: { id },
      data: { totalMarks: all.reduce((s, q) => s + q.marks, 0) },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSession();
  const { id } = await ctx.params;
  if (!session || session.role !== "TEACHER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const assessment = await db.assessment.findUnique({ where: { id } });
  if (!assessment || assessment.teacherId !== session.userId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.assessment.update({ where: { id }, data: { status: "ARCHIVED" } });
  return NextResponse.json({ ok: true });
}
