import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { BLANK_QUESTION } from "../../route";

// Append a blank question to an assessment the teacher owns.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await ctx.params;
  if (!session || session.role !== "TEACHER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assessment = await db.assessment.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!assessment || assessment.teacherId !== session.userId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const last = assessment.questions[assessment.questions.length - 1];
  // Continue a plain numeric sequence where possible, otherwise fall back to
  // the count so sub-numbered sheets like "3a" do not produce nonsense.
  const lastNumber = Number(last?.number);
  const nextNumber = Number.isFinite(lastNumber)
    ? String(lastNumber + 1)
    : String(assessment.questions.length + 1);

  const question = await db.question.create({
    data: {
      assessmentId: id,
      order: assessment.questions.length,
      number: nextNumber,
      subject: assessment.subject,
      ...BLANK_QUESTION,
      section: last?.section ?? "",
    },
  });

  await db.assessment.update({
    where: { id },
    data: { totalMarks: assessment.totalMarks + question.marks },
  });

  return NextResponse.json({ question });
}
