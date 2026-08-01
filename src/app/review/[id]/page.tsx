import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import ReviewPanel from "@/components/ReviewPanel";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "TEACHER") redirect("/dashboard");

  const { id } = await params;
  const attempt = await db.attempt.findUnique({
    where: { id },
    include: {
      student: true,
      answers: true,
      assessment: { include: { questions: { orderBy: { order: "asc" } } } },
    },
  });
  if (!attempt || attempt.assessment.teacherId !== session.userId) notFound();

  return (
    <Shell name={session.name} role="TEACHER">
      <ReviewPanel attempt={JSON.parse(JSON.stringify(attempt))} />
    </Shell>
  );
}
