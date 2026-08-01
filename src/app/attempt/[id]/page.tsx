import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Workspace from "@/components/workspace/Workspace";

export const dynamic = "force-dynamic";

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/");

  const { id } = await params;
  const attempt = await db.attempt.findUnique({
    where: { id },
    include: {
      answers: true,
      assessment: { include: { questions: { orderBy: { order: "asc" } } } },
    },
  });
  if (!attempt || attempt.studentId !== session.userId) notFound();
  if (attempt.status !== "IN_PROGRESS") redirect(`/attempt/${id}/results`);

  return <Workspace attempt={JSON.parse(JSON.stringify(attempt))} />;
}
