"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TOOLS } from "@/lib/tools";
import { CRITERIA, SUBJECT_GROUP_NAMES, criterionName, parseCriteria, ensureCriterionMarks, criteriaTotal, marksForCriterion } from "@/lib/myp";
import CriterionTags from "./CriterionTag";
import DiagramStrip from "./DiagramStrip";
import MediaPanel from "./MediaPanel";
import QuestionImages from "./QuestionImages";
import SectionEditor from "./SectionEditor";
import { parseSections, withSectionsForQuestions, findSection, type Section } from "@/lib/sections";
import { extractVideoId, parseMedia } from "@/lib/youtube";

type Q = {
  id: string; number: string; section: string; criteria: string;
  text: string; answerFormat: string; options: string; marks: number; subject: string;
  topic: string; difficulty: string; estMinutes: number; tools: string; rubric: string; skills: string;
  diagrams: string; stimulus: string; stimulusTitle: string; media: string;
};
type A = {
  id: string; title: string; subject: string; description: string; instructions: string;
  status: string; mode: string; durationMinutes: number | null; totalMarks: number;
  aiConfidence: number; curriculum: string; sourceFileName: string; dueDate: string | null; sections: string;
  questions: Q[];
  attempts: { id: string; status: string; totalScore: number | null; student: { name: string } }[];
};

const FORMATS = ["mcq", "short_text", "long_text", "math", "code", "drawing", "table"];

// Widens a stored question into the shape the editor edits, unpacking the
// JSON columns into arrays and the media list into one URL per line.
function toEditable(q: Q) {
  const media = parseMedia(q.media);
  return {
    ...q,
    optionsArr: JSON.parse(q.options || "[]") as string[],
    diagramsArr: JSON.parse(q.diagrams || "[]") as string[],
    toolsArr: JSON.parse(q.tools || "[]") as string[],
    criteriaArr: ensureCriterionMarks(parseCriteria(q.criteria), q.marks),
    mediaText: media
      .map((m) => `https://www.youtube.com/watch?v=${m.videoId}${m.start ? `&t=${m.start}` : ""}`)
      .join("\n"),
    // Titles are not editable as URLs, so keep them to re-attach on save.
    mediaTitles: Object.fromEntries(media.map((m) => [m.videoId, m.title])),
  };
}
const input = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal text-ink";

export default function AssessmentEditor({
  assessment,
  analytics,
}: {
  assessment: A;
  analytics: { questionId: string; avgPct: number | null; avgTime: number }[];
}) {
  const router = useRouter();
  const [meta, setMeta] = useState({
    title: assessment.title, subject: assessment.subject, instructions: assessment.instructions,
    mode: assessment.mode, durationMinutes: assessment.durationMinutes ?? 0,
    dueDate: assessment.dueDate ? assessment.dueDate.slice(0, 10) : "",
  });
  const [questions, setQuestions] = useState(assessment.questions.map(toEditable));
  const [sections, setSections] = useState<Section[]>(() =>
    withSectionsForQuestions(
      parseSections(assessment.sections),
      assessment.questions.map((q) => q.section)
    )
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState(false);

  function patchQ(id: string, patch: Partial<(typeof questions)[0]>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  // Add and remove hit the server straight away, because a question needs a
  // real id before the rest of the editor can address it.
  async function addQuestion() {
    setPendingQuestion(true);
    try {
      const res = await fetch(`/api/assessments/${assessment.id}/questions`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const added = toEditable(data.question as Q);
        setQuestions((qs) => [...qs, added]);
        setOpenId(added.id);
      }
    } finally {
      setPendingQuestion(false);
    }
  }

  async function removeQuestion(id: string) {
    if (questions.length <= 1) return;
    if (!confirm("Delete this question? Any answers students have already given to it are removed too.")) return;
    setPendingQuestion(true);
    try {
      const res = await fetch(`/api/assessments/${assessment.id}/questions/${id}`, { method: "DELETE" });
      if (res.ok) {
        setQuestions((qs) => qs.filter((q) => q.id !== id));
        if (openId === id) setOpenId(null);
      }
    } finally {
      setPendingQuestion(false);
    }
  }

  async function save(status?: string) {
    setSaving(true);
    await fetch(`/api/assessments/${assessment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...meta,
        durationMinutes: meta.durationMinutes || null,
        dueDate: meta.dueDate || null,
        ...(status && { status }),
        sections,
        questions: questions.map((q) => ({
          id: q.id, text: q.text, number: q.number, section: q.section,
          criteria: q.criteriaArr,
          stimulus: q.stimulus, stimulusTitle: q.stimulusTitle,
          diagrams: q.diagramsArr,
          media: q.mediaText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((url) => {
              const videoId = extractVideoId(url) ?? "";
              return { type: "youtube", url, videoId, title: q.mediaTitles[videoId] ?? "", start: 0 };
            }),
          answerFormat: q.answerFormat, options: q.optionsArr, marks: criteriaTotal(q.criteriaArr),
          subject: meta.subject, topic: q.topic, difficulty: q.difficulty,
          estMinutes: q.estMinutes, tools: q.toolsArr, rubric: q.rubric,
        })),
      }),
    });
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
    router.refresh();
  }

  const totalMarks = questions.reduce((s, q) => s + criteriaTotal(q.criteriaArr), 0);

  // Marks distribution across criteria, shown like a task sheet cover page.
  // Each question contributes only the marks set against that criterion, so
  // a question split across two criteria is no longer counted twice.
  const critTotals = CRITERIA.map((c) => ({
    criterion: c,
    marks: questions.reduce((s, q) => s + marksForCriterion(q.criteriaArr, c), 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="microlabel mb-1">Review, then publish</p>
          <h1 className="font-display text-3xl font-semibold text-ink">{meta.title}</h1>
          <p className="text-sm text-soft mt-1">
            {assessment.sourceFileName === "written in Criterion"
              ? "Written by hand"
              : `Parsed from ${assessment.sourceFileName}`}
            {assessment.curriculum && <> &middot; {assessment.curriculum}</>}
            {assessment.aiConfidence > 0 && <> &middot; parse confidence {(assessment.aiConfidence * 100).toFixed(0)}%</>}
            {assessment.aiConfidence > 0 && assessment.aiConfidence < 0.7 && (
              <span className="text-amber"> (low, check each question)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedFlash && <span className="text-xs text-teal font-medium">Saved</span>}
          <button onClick={() => save()} disabled={saving}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-soft transition-colors">
            {saving ? "Saving" : "Save draft"}
          </button>
          {assessment.status !== "PUBLISHED" ? (
            <button onClick={() => save("PUBLISHED")} disabled={saving}
              className="rounded-lg bg-teal hover:bg-tealdeep text-paper px-4 py-2 text-sm font-semibold transition-colors">
              Publish to students
            </button>
          ) : (
            <button onClick={() => save("DRAFT")} disabled={saving}
              className="rounded-lg bg-amber text-paper px-4 py-2 text-sm font-semibold transition-colors">
              Unpublish
            </button>
          )}
        </div>
      </div>

      {/* Criterion coverage */}
      <div className="grid grid-cols-4 gap-3">
        {critTotals.map((c) => (
          <div key={c.criterion} className="rounded-xl border border-line bg-surface p-3 text-center">
            <div className="font-display text-2xl font-semibold text-ink">{c.marks}</div>
            <div className="microlabel mt-0.5">Criterion {c.criterion}</div>
            <div className="text-[11px] text-soft mt-0.5 leading-tight">{criterionName(meta.subject, c.criterion)}</div>
          </div>
        ))}
      </div>

      {/* Assessment settings */}
      <div className="rounded-xl border border-line bg-surface p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <label className="microlabel space-y-1">
          <span>Title</span>
          <input className={input} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        </label>
        <label className="microlabel space-y-1">
          <span>Subject group</span>
          <select className={input} value={meta.subject} onChange={(e) => setMeta({ ...meta, subject: e.target.value })}>
            {!SUBJECT_GROUP_NAMES.includes(meta.subject) && <option value={meta.subject}>{meta.subject}</option>}
            {SUBJECT_GROUP_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="microlabel space-y-1">
          <span>Mode</span>
          <select className={input} value={meta.mode} onChange={(e) => setMeta({ ...meta, mode: e.target.value })}>
            <option value="EXAM">Exam, no tutor</option>
            <option value="PRACTICE">Practice, tutor on</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="microlabel space-y-1">
            <span>Minutes</span>
            <input className={input} type="number" min={0} value={meta.durationMinutes}
              onChange={(e) => setMeta({ ...meta, durationMinutes: +e.target.value })} />
          </label>
          <label className="microlabel space-y-1">
            <span>Due date</span>
            <input className={input} type="date" value={meta.dueDate}
              onChange={(e) => setMeta({ ...meta, dueDate: e.target.value })} />
          </label>
        </div>
        <label className="microlabel space-y-1 sm:col-span-2 lg:col-span-4">
          <span>Instructions shown to students</span>
          <textarea className={input} rows={2} value={meta.instructions}
            onChange={(e) => setMeta({ ...meta, instructions: e.target.value })} />
        </label>
      </div>

      <SectionEditor
        sections={sections}
        questionCounts={questions.reduce<Record<string, number>>((acc, q) => {
          if (q.section) acc[q.section] = (acc[q.section] ?? 0) + 1;
          return acc;
        }, {})}
        onChange={setSections}
      />

      {/* Questions */}
      <section>
        <h2 className="font-display text-2xl font-semibold mb-1 text-ink">Questions</h2>
        <p className="text-sm text-soft mb-4">{questions.length} questions, {totalMarks} marks. Check each criterion mapping before publishing.</p>
        <div className="space-y-3">
          {questions.map((q) => {
            const stat = analytics.find((s) => s.questionId === q.id);
            const open = openId === q.id;
            return (
              <div key={q.id} className="rounded-xl border border-line bg-surface overflow-hidden">
                <button onClick={() => setOpenId(open ? null : q.id)} className="w-full text-left p-4 flex items-start gap-3">
                  <span className="shrink-0 grid place-items-center w-8 h-8 rounded-lg bg-tealwash text-tealdeep text-sm font-bold">
                    {q.number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="mb-1.5">
                      <CriterionTags subjectGroup={meta.subject} criteria={q.criteriaArr} />
                    </div>
                    <p className="text-sm text-ink line-clamp-2">{q.text}</p>
                    <DiagramStrip diagrams={JSON.stringify(q.diagramsArr)} small />
                    <MediaPanel media={q.media} compact />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {q.section && <Tag>{findSection(sections, q.section)?.title || q.section}</Tag>}
                      <Tag>{q.topic}</Tag>
                      <Tag>{q.difficulty}</Tag>
                      <Tag>{q.marks} mk, ~{q.estMinutes} min</Tag>
                      <Tag>{q.answerFormat.replace("_", " ")}</Tag>
                      {q.stimulus.trim() && (
                        <Tag accent>source text, {q.stimulus.trim().split(/\s+/).length} words</Tag>
                      )}
                      {q.toolsArr.map((t) => TOOLS[t] && <Tag key={t} accent>{TOOLS[t].label}</Tag>)}
                      {stat?.avgPct != null && <Tag accent>class avg {stat.avgPct.toFixed(0)}%</Tag>}
                    </div>
                  </div>
                  <span className="text-soft text-xs mt-1">{open ? "Close" : "Edit"}</span>
                </button>

                {open && (
                  <div className="border-t border-line p-4 grid gap-3 sm:grid-cols-2">
                    <label className="microlabel space-y-1 sm:col-span-2">
                      <span>Question text</span>
                      <textarea className={input} rows={3} value={q.text} onChange={(e) => patchQ(q.id, { text: e.target.value })} />
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="microlabel space-y-1">
                        <span>Number</span>
                        <input className={input} value={q.number} onChange={(e) => patchQ(q.id, { number: e.target.value })} />
                      </label>
                      <div className="microlabel space-y-1">
                        <span>Marks</span>
                        <div className={`${input} flex items-center justify-between`} title="Sum of the marks set against each criterion below">
                          <span className="font-semibold text-ink">{criteriaTotal(q.criteriaArr)}</span>
                          <span className="text-[10px] text-soft normal-case tracking-normal">from criteria</span>
                        </div>
                      </div>
                      <label className="microlabel space-y-1">
                        <span>Difficulty</span>
                        <select className={input} value={q.difficulty} onChange={(e) => patchQ(q.id, { difficulty: e.target.value })}>
                          {["Easy", "Medium", "Hard"].map((d) => <option key={d}>{d}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="microlabel">Criteria assessed, toggle any that apply</span>
                      <div className="grid sm:grid-cols-2 gap-2 mt-1.5">
                        {CRITERIA.map((c) => {
                          const active = q.criteriaArr.find((x) => x.criterion === c);
                          return (
                            <div key={c} className={`rounded-lg border p-2 flex items-center gap-2 transition-colors ${
                              active ? "border-teal bg-tealwash" : "border-line"
                            }`}>
                              <button type="button"
                                onClick={() => patchQ(q.id, {
                                  criteriaArr: active
                                    ? q.criteriaArr.filter((x) => x.criterion !== c)
                                    : [...q.criteriaArr, { criterion: c, strands: "", marks: 1 }].sort((a, b) => a.criterion.localeCompare(b.criterion)),
                                })}
                                className="flex items-center gap-2 text-left flex-1 min-w-0">
                                <span className={`grid place-items-center w-6 h-6 rounded text-xs font-bold shrink-0 ${
                                  active ? "bg-teal text-paper" : "bg-paper border border-line text-soft"
                                }`}>{c}</span>
                                <span className={`text-xs truncate ${active ? "text-tealdeep font-medium" : "text-soft"}`}>
                                  {criterionName(meta.subject, c)}
                                </span>
                              </button>
                              {active && (
                                <input
                                  className="w-16 rounded-md border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-teal text-ink"
                                  placeholder="strands"
                                  aria-label={`Strands for criterion ${c}`}
                                  value={active.strands}
                                  onChange={(e) => patchQ(q.id, {
                                    criteriaArr: q.criteriaArr.map((x) => x.criterion === c ? { ...x, strands: e.target.value } : x),
                                  })}
                                />
                              )}
                              {active && (
                                <input
                                  type="number"
                                  min={0}
                                  className="w-14 rounded-md border border-line bg-surface px-2 py-1 text-xs text-right outline-none focus:border-teal text-ink"
                                  aria-label={`Marks for criterion ${c}`}
                                  title={`Marks awarded under criterion ${c}`}
                                  value={active.marks}
                                  onChange={(e) => patchQ(q.id, {
                                    criteriaArr: q.criteriaArr.map((x) =>
                                      x.criterion === c ? { ...x, marks: Math.max(0, Math.round(+e.target.value || 0)) } : x
                                    ),
                                  })}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <label className="microlabel space-y-1">
                      <span>Answer format</span>
                      <select className={input} value={q.answerFormat} onChange={(e) => patchQ(q.id, { answerFormat: e.target.value })}>
                        {FORMATS.map((f) => <option key={f} value={f}>{f.replace("_", " ")}</option>)}
                      </select>
                    </label>
                    <label className="microlabel space-y-1">
                      <span>Topic</span>
                      <input className={input} value={q.topic} onChange={(e) => patchQ(q.id, { topic: e.target.value })} />
                    </label>
                    <label className="microlabel space-y-1">
                      <span>Section</span>
                      <select className={input} value={q.section}
                        onChange={(e) => patchQ(q.id, { section: e.target.value })}>
                        <option value="">No section</option>
                        {sections.map((sec) => (
                          <option key={sec.key} value={sec.key}>{sec.title || "Untitled section"}</option>
                        ))}
                      </select>
                    </label>
                    {q.answerFormat === "mcq" && (
                      <label className="microlabel space-y-1 sm:col-span-2">
                        <span>Options, one per line</span>
                        <textarea className={input} rows={4} value={q.optionsArr.join("\n")}
                          onChange={(e) => patchQ(q.id, { optionsArr: e.target.value.split("\n") })} />
                      </label>
                    )}
                    <div className="sm:col-span-2">
                      <span className="microlabel">Tools available to the student</span>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {Object.entries(TOOLS).map(([id, t]) => (
                          <button key={id} type="button"
                            onClick={() => patchQ(q.id, {
                              toolsArr: q.toolsArr.includes(id) ? q.toolsArr.filter((x) => x !== id) : [...q.toolsArr, id],
                            })}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                              q.toolsArr.includes(id)
                                ? "border-teal bg-tealwash text-tealdeep"
                                : "border-line text-soft"
                            }`}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="microlabel space-y-1 sm:col-span-2">
                      <span>Task-specific clarification, used for marking</span>
                      <textarea className={input} rows={2} value={q.rubric} onChange={(e) => patchQ(q.id, { rubric: e.target.value })} />
                    </label>

                    <div className="sm:col-span-2 space-y-1">
                      <span className="microlabel">
                        Images shown with the question
                        {q.diagramsArr.length > 0 && (
                          <span className="normal-case tracking-normal font-normal"> ({q.diagramsArr.length})</span>
                        )}
                      </span>
                      <QuestionImages
                        images={q.diagramsArr}
                        onChange={(next) => patchQ(q.id, { diagramsArr: next })}
                      />
                    </div>

                    <label className="microlabel space-y-1">
                      <span>Source text label</span>
                      <input
                        className={input}
                        placeholder="Text A: extract from ..."
                        value={q.stimulusTitle}
                        onChange={(e) => patchQ(q.id, { stimulusTitle: e.target.value })}
                      />
                    </label>
                    <label className="microlabel space-y-1">
                      <span>YouTube links, one per line</span>
                      <textarea
                        className={`${input} font-mono text-xs`}
                        rows={2}
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={q.mediaText}
                        onChange={(e) => patchQ(q.id, { mediaText: e.target.value })}
                      />
                    </label>
                    <label className="microlabel space-y-1 sm:col-span-2">
                      <span>
                        Source text shown with the question
                        {q.stimulus.trim() && (
                          <span className="normal-case tracking-normal font-normal">
                            {" "}({q.stimulus.trim().split(/\s+/).length} words)
                          </span>
                        )}
                      </span>
                      <textarea
                        className={`${input} font-serif leading-relaxed`}
                        rows={8}
                        placeholder="Paste or correct the extract, article or transcript the student must read."
                        value={q.stimulus}
                        onChange={(e) => patchQ(q.id, { stimulus: e.target.value })}
                      />
                    </label>

                    <div className="sm:col-span-2 flex justify-end border-t border-line pt-3">
                      <button
                        type="button"
                        onClick={() => removeQuestion(q.id)}
                        disabled={pendingQuestion || questions.length <= 1}
                        title={questions.length <= 1 ? "An assessment needs at least one question" : undefined}
                        className="text-xs font-semibold text-red-600 dark:text-red-400 hover:opacity-70 disabled:opacity-40 transition-opacity"
                      >
                        Delete this question
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addQuestion}
          disabled={pendingQuestion}
          className="mt-3 w-full rounded-xl border border-dashed border-line hover:border-teal text-sm font-semibold text-soft hover:text-teal py-3 transition-colors disabled:opacity-50"
        >
          {pendingQuestion ? "Working" : "Add a question"}
        </button>
      </section>

      {/* Submissions */}
      {assessment.attempts.length > 0 && (
        <section>
          <h2 className="font-display text-2xl font-semibold mb-3 text-ink">Submissions</h2>
          <div className="rounded-xl border border-line bg-surface divide-y divide-line">
            {assessment.attempts.map((t) => (
              <Link key={t.id} href={`/review/${t.id}`} className="flex items-center justify-between p-4 hover:bg-paper transition-colors">
                <span className="font-medium text-sm text-ink">{t.student.name}</span>
                <span className="text-xs text-soft">
                  {t.status === "RELEASED" ? `Released, ${t.totalScore}/${totalMarks}` : t.status.replace("_", " ").toLowerCase()}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Tag({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
      accent ? "bg-tealwash text-tealdeep" : "bg-paper text-soft border border-line"
    }`}>
      {children}
    </span>
  );
}
