import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parseDocument, describeAiError } from "@/lib/gemini";

export const maxDuration = 60; // Hobby plan ceiling; raise to 300 on Pro for very long task sheets

// Defaults for a question a teacher adds by hand. Exported so the
// add-question route creates rows that look identical to these.
export const BLANK_QUESTION = {
  section: "",
  criteria: JSON.stringify([{ criterion: "A", strands: "" }]),
  text: "",
  answerFormat: "short_text",
  options: "[]",
  marks: 1,
  topic: "",
  difficulty: "Medium",
  estMinutes: 3,
  skills: "[]",
  tools: "[]",
  rubric: "",
  stimulus: "",
  stimulusTitle: "",
  media: "[]",
  diagrams: "[]",
};

// Two ways in: a multipart upload that the AI parses, or a JSON body that
// creates an empty draft for the teacher to write themselves.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "TEACHER")
    return NextResponse.json({ error: "Teacher account required" }, { status: 403 });

  if (req.headers.get("content-type")?.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "PRACTICE" ? "PRACTICE" : "EXAM";
    const subject = typeof body.subject === "string" && body.subject ? body.subject : "Mathematics";

    const created = await db.assessment.create({
      data: {
        title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Untitled assessment",
        subject,
        description: "",
        instructions: "",
        mode,
        status: "DRAFT",
        totalMarks: 1,
        sourceFileName: "written in Criterion",
        aiConfidence: 0,
        curriculum: "",
        teacherId: session.userId,
        questions: {
          create: [{ order: 0, number: "1", subject, ...BLANK_QUESTION }],
        },
      },
    });
    return NextResponse.json({ id: created.id });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const mode = (form.get("mode") as string) === "PRACTICE" ? "PRACTICE" : "EXAM";
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024)
    return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });

  const type = file.type || "application/pdf";
  const supported =
    type === "application/pdf" ||
    type.startsWith("image/") ||
    type.startsWith("text/") ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (!supported)
    return NextResponse.json(
      { error: "Unsupported file type. Upload a PDF, an image, or a Word .docx file. Older .doc files should be saved as .docx or exported to PDF first." },
      { status: 400 }
    );

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await parseDocument(buffer, type, file.name);
  } catch (e) {
    console.error("Parse failed:", e);
    const info = describeAiError(e);
    return NextResponse.json(
      { error: info.message, retryable: info.retryable },
      { status: info.retryable ? 503 : 502 }
    );
  }

  const totalMarks = parsed.questions.reduce((s, q) => s + q.marks, 0);
  const assessment = await db.assessment.create({
    data: {
      title: parsed.title || file.name,
      subject: parsed.subject || "General",
      description: parsed.description,
      instructions: parsed.instructions,
      durationMinutes: parsed.durationMinutes || null,
      curriculum: parsed.curriculum,
      aiConfidence: parsed.confidence,
      // Keyed by title, which is what each question's `section` field holds.
      sections: JSON.stringify(
        (parsed.sections ?? [])
          .filter((sec) => sec?.title)
          .map((sec) => ({
            key: sec.title,
            title: sec.title,
            instructions: sec.instructions ?? "",
            images: [],
          }))
      ),
      sourceFileName: file.name,
      totalMarks,
      mode,
      teacherId: session.userId,
      questions: {
        create: parsed.questions.map((q, i) => ({
          order: i,
          number: q.number,
          section: q.section ?? "",
          criteria: JSON.stringify(q.criteria ?? []),
          diagrams: JSON.stringify(q.diagrams ?? []),
          stimulus: q.stimulus ?? "",
          stimulusTitle: q.stimulusTitle ?? "",
          media: JSON.stringify(q.media ?? []),
          text: q.text,
          answerFormat: q.answerFormat,
          options: JSON.stringify(q.options),
          marks: q.marks,
          subject: q.subject,
          topic: q.topic,
          difficulty: q.difficulty,
          estMinutes: q.estMinutes || 3,
          skills: JSON.stringify(q.skills),
          tools: JSON.stringify(q.tools),
          rubric: q.rubric,
        })),
      },
    },
  });

  return NextResponse.json({ id: assessment.id });
}
