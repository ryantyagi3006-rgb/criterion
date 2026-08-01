import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import AssessmentEditor from "@/components/AssessmentEditor";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "TEACHER") redirect("/dashboard");

  const { id } = await params;
  const assessment = await db.assessment.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" }, include: { answers: true } },
      attempts: { include: { student: true } },
    },
  });
  if (!assessment || assessment.teacherId !== session.userId) notFound();

  // Per-question difficulty analytics from released attempts.
  const analytics = assessment.questions.map((q) => {
    const scored = q.answers.filter((a) => (a.score ?? a.aiScore) !== null);
    const avgPct = scored.length
      ? (scored.reduce((s, a) => s + (a.score ?? a.aiScore ?? 0), 0) / (scored.length * q.marks)) * 100
      : null;
    const avgTime = q.answers.length
      ? q.answers.reduce((s, a) => s + a.timeSpentSec, 0) / q.answers.length
      : 0;
    return { questionId: q.id, avgPct, avgTime };
  });

  return (
    <Shell name={session.name} role="TEACHER">
      <AssessmentEditor
        assessment={JSON.parse(JSON.stringify(assessment))}
        analytics={analytics}
      />
    </Shell>
  );
}
