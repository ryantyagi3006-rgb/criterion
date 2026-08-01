"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TOOLS } from "@/lib/tools";
import AnswerInput from "./AnswerInput";
import ToolsPanel from "./ToolsPanel";
import TutorPanel from "./TutorPanel";
import ThemeToggle from "../ThemeToggle";
import CriterionTags from "../CriterionTag";
import DiagramStrip from "../DiagramStrip";
import StimulusPanel from "../StimulusPanel";
import MediaPanel from "../MediaPanel";

export type WQuestion = {
  id: string; number: string; section: string; criteria: string;
  text: string; answerFormat: string; options: string; marks: number; topic: string;
  subject: string; difficulty: string; estMinutes: number; tools: string; diagrams: string;
  stimulus: string; stimulusTitle: string; media: string;
};
export type WAttempt = {
  id: string;
  startedAt: string;
  answers: { questionId: string; content: string; flagged: boolean }[];
  assessment: {
    id: string; title: string; subject: string; instructions: string; mode: string;
    durationMinutes: number | null; totalMarks: number;
    questions: WQuestion[];
  };
};

export default function Workspace({ attempt }: { attempt: WAttempt }) {
  const router = useRouter();
  const { assessment } = attempt;
  const questions = assessment.questions;
  const examMode = assessment.mode === "EXAM";

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(attempt.answers.map((a) => [a.questionId, a.content]))
  );
  const [flags, setFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(attempt.answers.map((a) => [a.questionId, a.flagged]))
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [zoom, setZoom] = useState(1);
  const [showTools, setShowTools] = useState(true);
  const [showTutor, setShowTutor] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const q = questions[idx];
  const qTools = useMemo(() => (JSON.parse(q.tools || "[]") as string[]).filter((t) => TOOLS[t]), [q]);

  // ---------- autosave (debounced) ----------
  const pending = useRef<Record<string, { content?: string; flagged?: boolean }>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const batch = pending.current;
    pending.current = {};
    for (const [questionId, patch] of Object.entries(batch)) {
      await fetch(`/api/attempts/${attempt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, ...patch }),
      }).catch(() => {});
    }
    setSaveState("saved");
  }, [attempt.id]);

  const queueSave = useCallback((questionId: string, patch: { content?: string; flagged?: boolean }) => {
    pending.current[questionId] = { ...pending.current[questionId], ...patch };
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1500);
  }, [flush]);

  // ---------- per-question time tracking ----------
  const enteredAt = useRef(Date.now());
  const trackTime = useCallback((questionId: string) => {
    const sec = Math.round((Date.now() - enteredAt.current) / 1000);
    enteredAt.current = Date.now();
    if (sec > 0)
      fetch(`/api/attempts/${attempt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, addTimeSec: sec }),
      }).catch(() => {});
  }, [attempt.id]);

  const goTo = useCallback((next: number) => {
    if (next < 0 || next >= questions.length) return;
    trackTime(questions[idx].id);
    setIdx(next);
    setShowTutor(false);
  }, [idx, questions, trackTime]);

  // ---------- countdown timer ----------
  const deadline = useMemo(() => {
    if (!assessment.durationMinutes) return null;
    return new Date(attempt.startedAt).getTime() + assessment.durationMinutes * 60_000;
  }, [assessment.durationMinutes, attempt.startedAt]);
  const [remaining, setRemaining] = useState<number | null>(null);

  const submit = useCallback(async () => {
    setSubmitting(true);
    trackTime(questions[idx].id);
    if (timer.current) clearTimeout(timer.current);
    await flush();
    await fetch(`/api/attempts/${attempt.id}/submit`, { method: "POST" });
    router.push(`/attempt/${attempt.id}/results`);
    router.refresh();
  }, [attempt.id, flush, idx, questions, router, trackTime]);

  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left === 0) {
        clearInterval(t);
        submit(); // time is up, auto submit
      }
    }, 1000);
    return () => clearInterval(t);
  }, [deadline, submit]);

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return;
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(idx + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(idx - 1); }
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        const f = !flags[q.id];
        setFlags((s) => ({ ...s, [q.id]: f }));
        queueSave(q.id, { flagged: f });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, q, flags, goTo, queueSave]);

  const answered = questions.filter((qq) => (answers[qq.id] ?? "").trim() !== "").length;
  const mins = remaining !== null ? Math.floor(remaining / 60000) : null;
  const secs = remaining !== null ? Math.floor((remaining % 60000) / 1000) : null;

  return (
    <div className="min-h-screen bg-paper flex flex-col"
      onCopy={examMode ? (e) => e.preventDefault() : undefined}
      onPaste={examMode ? (e) => e.preventDefault() : undefined}>

      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="px-4 h-14 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-display font-semibold text-sm truncate text-ink">{assessment.title}</div>
            <div className="text-[11px] text-soft">
              {examMode ? "Exam mode, tutor off" : "Practice mode"} &middot;{" "}
              {saveState === "saving" ? "Saving" : saveState === "saved" ? "All changes saved" : "Autosave on"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {remaining !== null && (
              <div className={`font-mono text-sm font-bold px-3 py-1.5 rounded-lg ${
                remaining < 5 * 60000 ? "bg-amberwash text-amber animate-pulse" : "bg-paper text-ink border border-line"
              }`}>
                {mins}:{String(secs).padStart(2, "0")}
              </div>
            )}
            <div className="hidden sm:flex items-center gap-1 text-soft text-xs font-semibold">
              <button onClick={() => setZoom((z) => Math.max(0.8, z - 0.1))} className="px-2 py-1 rounded hover:bg-paper" aria-label="Zoom out">A-</button>
              <button onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))} className="px-2 py-1 rounded hover:bg-paper" aria-label="Zoom in">A+</button>
              <button onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()}
                className="px-2 py-1 rounded hover:bg-paper" aria-label="Full screen">Full</button>
            </div>
            <ThemeToggle />
            <button onClick={() => setConfirmSubmit(true)}
              className="rounded-lg bg-teal hover:bg-tealdeep text-paper text-sm font-semibold px-4 py-2 transition-colors">
              Submit
            </button>
          </div>
        </div>
        {/* progress bar */}
        <div className="h-1 bg-paper">
          <div className="h-full bg-teal transition-all" style={{ width: `${(answered / questions.length) * 100}%` }} />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Question navigator */}
        <nav className="hidden md:flex flex-col w-52 shrink-0 border-r border-line bg-surface p-3 overflow-y-auto">
          <div className="microlabel mb-2">
            {answered} of {questions.length} answered
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {questions.map((qq, i) => {
              const has = (answers[qq.id] ?? "").trim() !== "";
              return (
                <button key={qq.id} onClick={() => goTo(i)} aria-label={`Question ${qq.number}`}
                  className={`relative h-9 rounded-lg text-xs font-bold transition-colors ${
                    i === idx ? "bg-teal text-paper" :
                    has ? "bg-tealwash text-tealdeep" :
                    "bg-paper text-soft border border-line"
                  }`}>
                  {qq.number}
                  {flags[qq.id] && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber" />}
                </button>
              );
            })}
          </div>
          <div className="mt-4 text-[11px] text-soft space-y-1">
            <p>Alt with arrows to navigate</p>
            <p>Alt F to flag</p>
          </div>
          {assessment.instructions && (
            <div className="mt-4 text-[11px] text-soft border-t border-line pt-3">
              <span className="microlabel">Instructions</span>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed">{assessment.instructions}</p>
            </div>
          )}
        </nav>

        {/* Question area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ fontSize: `${zoom}rem` }}>
          <div className="max-w-3xl mx-auto fade-up" key={q.id}>
            {q.section && <div className="microlabel mb-2">{q.section}</div>}
            <div className="rounded-xl bg-surface border border-line p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">
                    Question {q.number}
                    <span className="ml-2 text-xs font-sans font-normal text-soft">
                      {q.marks} mark{q.marks === 1 ? "" : "s"}, about {q.estMinutes} min
                    </span>
                  </h2>
                  <div className="mt-1.5">
                    <CriterionTags subjectGroup={assessment.subject} criteria={q.criteria} />
                  </div>
                </div>
                <button
                  onClick={() => { const f = !flags[q.id]; setFlags((s) => ({ ...s, [q.id]: f })); queueSave(q.id, { flagged: f }); }}
                  className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                    flags[q.id] ? "border-amber bg-amberwash text-amber" : "border-line text-soft hover:border-amber"
                  }`}>
                  {flags[q.id] ? "Flagged" : "Flag"}
                </button>
              </div>
              <p className="mt-4 text-ink whitespace-pre-wrap leading-relaxed">{q.text}</p>
              <DiagramStrip diagrams={q.diagrams} />
              <MediaPanel media={q.media} />
              <StimulusPanel stimulus={q.stimulus} title={q.stimulusTitle} />

              <div className="mt-5 border-t border-line pt-5">
                <AnswerInput
                  key={q.id}
                  question={q}
                  value={answers[q.id] ?? ""}
                  examMode={examMode}
                  onChange={(v) => { setAnswers((s) => ({ ...s, [q.id]: v })); queueSave(q.id, { content: v }); }}
                />
              </div>
            </div>

            {/* nav buttons */}
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => goTo(idx - 1)} disabled={idx === 0}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40 hover:border-soft transition-colors">
                Previous
              </button>
              <div className="md:hidden text-xs text-soft">{idx + 1} / {questions.length}</div>
              {idx < questions.length - 1 ? (
                <button onClick={() => goTo(idx + 1)}
                  className="rounded-lg bg-teal hover:bg-tealdeep text-paper px-4 py-2 text-sm font-semibold transition-colors">
                  Next
                </button>
              ) : (
                <button onClick={() => setConfirmSubmit(true)}
                  className="rounded-lg bg-teal hover:bg-tealdeep text-paper px-4 py-2 text-sm font-semibold transition-colors">
                  Finish and submit
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Tools / tutor sidebar */}
        {(qTools.length > 0 || !examMode) && (
          <aside className={`hidden lg:flex flex-col shrink-0 border-l border-line bg-surface transition-all ${showTools ? "w-80" : "w-10"}`}>
            <button onClick={() => setShowTools(!showTools)} className="p-2 text-soft hover:text-ink text-sm self-start" aria-label="Toggle tools panel">
              {showTools ? ">" : "<"}
            </button>
            {showTools && (
              <div className="flex-1 overflow-y-auto p-3 pt-0 space-y-3">
                {!examMode && (
                  <button onClick={() => setShowTutor(!showTutor)}
                    className={`w-full rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      showTutor ? "bg-teal text-paper" : "bg-tealwash text-tealdeep hover:bg-teal hover:text-paper"
                    }`}>
                    {showTutor ? "Tutor is open" : "Ask the tutor for a hint"}
                  </button>
                )}
                {showTutor && !examMode && (
                  <TutorPanel questionId={q.id} currentAnswer={answers[q.id] ?? ""} />
                )}
                <ToolsPanel toolIds={qTools} />
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Submit confirmation */}
      {confirmSubmit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 backdrop-blur-sm p-4">
          <div className="rounded-xl bg-surface border border-line p-6 max-w-sm w-full shadow-xl fade-up">
            <h3 className="font-display text-xl font-semibold text-ink">Submit this task?</h3>
            <p className="text-sm text-soft mt-2 leading-relaxed">
              You have answered {answered} of {questions.length} questions.
              {answered < questions.length && " Unanswered questions score zero."}
              {Object.values(flags).some(Boolean) && " You still have flagged questions."}
            </p>
            <p className="text-sm text-soft mt-2">
              Submission is final. Your teacher reviews all marks before release.
            </p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setConfirmSubmit(false)} disabled={submitting}
                className="flex-1 rounded-lg border border-line py-2.5 text-sm font-semibold text-ink">
                Keep working
              </button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 rounded-lg bg-teal hover:bg-tealdeep text-paper py-2.5 text-sm font-semibold disabled:opacity-60">
                {submitting ? "Submitting" : "Submit now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
