import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { tutorReply } from "@/lib/gemini";

export const maxDuration = 60;

// Practice-mode AI tutor. Hard-blocked for exam-mode assessments server-side.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { questionId, answer, chat } = await req.json();
  const question = await db.question.findUnique({
    where: { id: questionId },
    include: { assessment: true },
  });
  if (!question) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (question.assessment.mode !== "PRACTICE")
    return NextResponse.json({ error: "AI tutor is disabled in exam mode" }, { status: 403 });

  const reply = await tutorReply(question.text, answer ?? "", chat ?? []);
  return NextResponse.json({ reply });
}
