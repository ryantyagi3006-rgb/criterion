import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Start (or resume) an attempt at a published assessment.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await ctx.params;
  if (!session || session.role !== "STUDENT")
    return NextResponse.json({ error: "Student account required" }, { status: 403 });

  const assessment = await db.assessment.findUnique({ where: { id } });
  if (!assessment || assessment.status !== "PUBLISHED")
    return NextResponse.json({ error: "Assessment not available" }, { status: 404 });

  const existing = await db.attempt.findUnique({
    where: { assessmentId_studentId: { assessmentId: id, studentId: session.userId } },
  });
  if (existing) return NextResponse.json({ id: existing.id, resumed: true });

  const attempt = await db.attempt.create({
    data: { assessmentId: id, studentId: session.userId },
  });
  return NextResponse.json({ id: attempt.id, resumed: false });
}
