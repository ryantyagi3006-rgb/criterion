"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AnswerInput from "./AnswerInput";
import RichText from "../RichText";
import TutorPanel from "./TutorPanel";
import ThemeToggle from "../ThemeToggle";
import CriterionTags from "../CriterionTag";
import StimulusPanel from "../StimulusPanel";
import MediaPanel from "../MediaPanel";
import DiagramStrip from "../DiagramStrip";
import { parseSections, findSection, type Section } from "@/lib/sections";

export type WQuestion = {
  id: string; number: string; section: string; criteria: string;
  text: string; answerFormat: string; options: string; marks: number; topic: string;
  subject: string; difficulty: string; estMinutes: number; tools: string; diagrams: string;
  stimulus: string; stimulusTitle: string; media: string;
};
export type WAttempt = {
  id: string;
  startedAt: string;
  extraMinutes: number;
  answers: { questionId: string; content: string; flagged: boolean }[];
  assessment: {
    id: string; title: string; subject: string; instructions: string; mode: string;
    durationMinutes: number | null; totalMarks: number; sections: string;
    questions: WQuestion[];
  };
};

type Group = { section: Section | null; label: string; questions: WQuestion[] };

/**
 * Questions are shown a section at a time, in the order the paper sets them,
 * so a section's preamble and figures sit above every question they apply to
 * rather than being repeated or lost between pages.
 *
 * A paper with no sections is one group, which is simply the whole paper.
 */
function groupQuestions(questions: WQuestion[], sectionsJson: string): Group[] {
  const sections = parseSections(sectionsJson);
  const groups: Group[] = [];
  const index = new Map<string, Group>();

  for (const q of questions) {
    const key = q.section || "";
    let group = index.get(key);
    if (!group) {
      const section = findSection(sections, key);
      group = {
        section: section ?? null,
        // Falls back to the stored label for papers made before sections
        // carried their own title.
        label: section?.title || key || "",
        questions: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    group.questions.push(q);
  }

  return groups.length ? groups : [{ section: null, label: "", questions: [] }];
}

export default function Workspace({ attempt }: { attempt: WAttempt }) {
  const router = useRouter();
  const { assessment } = attempt;
  const questions = assessment.questions;
  const examMode = assessment.mode === "EXAM";

  const groups = useMemo(
    () => groupQuestions(questions, assessment.sections),
    [questions, assessment.sections]
  );

  const [groupIdx, setGroupIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(attempt.answers.map((a) => [a.questionId, a.content]))
  );
  const [flags, setFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(attempt.answers.map((a) => [a.questionId, a.flagged]))
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [zoom, setZoom] = useState(1);
  const [showTutor, setShowTutor] = useState(false);
  const [tutorFor, setTutorFor] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const group = groups[Math.min(groupIdx, groups.length - 1)];

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

  // ---------- time on section ----------
  // Time is attributed to the questions on screen, since a section is worked
  // as a whole rather than one question at a time.
  const enteredAt = useRef(Date.now());
  const trackTime = useCallback((ids: string[]) => {
    const sec = Math.round((Date.now() - enteredAt.current) / 1000);
    enteredAt.current = Date.now();
    if (sec <= 0 || ids.length === 0) return;
    const each = Math.max(1, Math.round(sec / ids.length));
    for (const questionId of ids)
      fetch(`/api/attempts/${attempt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, addTimeSec: each }),
      }).catch(() => {});
  }, [attempt.id]);

  const goToGroup = useCallback((next: number) => {
    if (next < 0 || next >= groups.length) return;
    trackTime(groups[groupIdx]?.questions.map((q) => q.id) ?? []);
    setGroupIdx(next);
    setShowTutor(false);
    setTutorFor(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [groupIdx, groups, trackTime]);

  // ---------- countdown timer ----------
  // Extra time granted by the teacher extends the deadline. It is also what
  // makes a reopened submission usable, since the original deadline has
  // normally passed by then.
  const deadline = useMemo(() => {
    if (!assessment.durationMinutes) return null;
    const minutes = assessment.durationMinutes + (attempt.extraMinutes ?? 0);
    return new Date(attempt.startedAt).getTime() + minutes * 60_000;
  }, [assessment.durationMinutes, attempt.extraMinutes, attempt.startedAt]);
  const [remaining, setRemaining] = useState<number | null>(null);

  const submit = useCallback(async () => {
    setSubmitting(true);
    trackTime(groups[groupIdx]?.questions.map((q) => q.id) ?? []);
    if (timer.current) clearTimeout(timer.current);
    await flush();
    await fetch(`/api/attempts/${attempt.id}/submit`, { method: "POST" });
    router.push(`/attempt/${attempt.id}/results`);
    router.refresh();
  }, [attempt.id, flush, groupIdx, groups, router, trackTime]);

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
      if (e.key === "ArrowRight") { e.preventDefault(); goToGroup(groupIdx + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goToGroup(groupIdx - 1); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groupIdx, goToGroup]);

  const answered = questions.filter((qq) => (answers[qq.id] ?? "").trim() !== "").length;
  const flagged = questions.filter((qq) => flags[qq.id]).length;
  const mins = remaining !== null ? Math.floor(remaining / 60000) : null;
  const secs = remaining !== null ? Math.floor((remaining % 60000) / 1000) : null;

  function toggleFlag(id: string) {
    const f = !flags[id];
    setFlags((s) => ({ ...s, [id]: f }));
    queueSave(id, { flagged: f });
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col"
      onCopy={examMode ? (e) => e.preventDefault() : undefined}
      onPaste={examMode ? (e) => e.preventDefault() : undefined}>

      {/* Everything the old side column carried now lives here */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="px-4 h-14 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate text-ink">{assessment.title}</div>
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

        {/* Section bar: progress, where you are, and the paper's instructions */}
        <div className="px-4 pb-2 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto">
            {groups.map((g, i) => {
              const total = g.questions.length;
              const doneHere = g.questions.filter((qq) => (answers[qq.id] ?? "").trim() !== "").length;
              return (
                <button
                  key={g.label + i}
                  onClick={() => goToGroup(i)}
                  aria-current={i === groupIdx ? "step" : undefined}
                  className={`shrink-0 h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                    i === groupIdx ? "bg-teal text-paper" : "bg-paper text-soft border border-line hover:border-teal"
                  }`}
                >
                  {g.label || `Part ${i + 1}`}
                  <span className={`ml-1.5 ${i === groupIdx ? "opacity-80" : ""}`}>
                    {doneHere}/{total}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-3 text-[11px] text-soft">
            <span>{answered} of {questions.length} answered</span>
            {flagged > 0 && <span className="text-amber">{flagged} flagged</span>}
            {!examMode && (
              <button
                onClick={() => { setShowTutor((v) => !v); setTutorFor(null); }}
                className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                  showTutor ? "border-teal bg-tealwash text-tealdeep" : "border-line text-ink hover:border-teal"
                }`}
              >
                Tutor
              </button>
            )}
            <button
              onClick={() => setShowInfo((v) => !v)}
              aria-expanded={showInfo}
              className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                showInfo ? "border-teal bg-tealwash text-tealdeep" : "border-line text-ink hover:border-teal"
              }`}
            >
              Instructions
            </button>
          </div>
        </div>

        {showInfo && (
          <div className="px-4 pb-3 text-[11px] text-soft border-t border-line pt-3">
            {assessment.instructions ? (
              <p className="whitespace-pre-wrap leading-relaxed max-w-3xl">{assessment.instructions}</p>
            ) : (
              <p>No special instructions for this paper.</p>
            )}
            <p className="mt-2">Alt with left and right arrows moves between sections.</p>
          </div>
        )}

        <div className="h-1 bg-paper">
          <div className="h-full bg-teal transition-all"
            style={{ width: `${questions.length ? (answered / questions.length) * 100 : 0}%` }} />
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6" style={{ fontSize: `${zoom}rem` }}>
        <div className="max-w-3xl mx-auto fade-up" key={groupIdx}>
          {(group.label || group.section) && (
            <div className="mb-4">
              <div className="microlabel mb-1">{group.label || "This part"}</div>
              {group.section?.instructions.trim() && (
                <p className="text-sm text-soft leading-relaxed whitespace-pre-wrap">
                  {group.section.instructions}
                </p>
              )}
              {group.section && <DiagramStrip diagrams={JSON.stringify(group.section.images)} />}
            </div>
          )}

          <div className="space-y-4">
            {group.questions.map((q) => (
              <div key={q.id} className="rounded-xl bg-surface border border-line p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">
                      Question {q.number}
                      <span className="ml-2 text-xs font-normal text-soft">
                        {q.marks} mark{q.marks === 1 ? "" : "s"}, about {q.estMinutes} min
                      </span>
                    </h2>
                    <div className="mt-1.5">
                      <CriterionTags subjectGroup={assessment.subject} criteria={q.criteria} />
                    </div>
                  </div>
                  <button
                    onClick={() => toggleFlag(q.id)}
                    className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                      flags[q.id] ? "border-amber bg-amberwash text-amber" : "border-line text-soft hover:border-amber"
                    }`}>
                    {flags[q.id] ? "Flagged" : "Flag"}
                  </button>
                </div>

                <RichText html={q.text} className="mt-4 text-ink leading-relaxed" />
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

                {!examMode && (
                  <div className="mt-3">
                    <button
                      onClick={() => setTutorFor(tutorFor === q.id ? null : q.id)}
                      className="text-xs font-semibold text-tealdeep hover:underline"
                    >
                      {tutorFor === q.id ? "Hide the tutor" : "Ask the tutor about this question"}
                    </button>
                    {tutorFor === q.id && (
                      <div className="mt-2">
                        <TutorPanel questionId={q.id} currentAnswer={answers[q.id] ?? ""} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-5 gap-3">
            <button onClick={() => goToGroup(groupIdx - 1)} disabled={groupIdx === 0}
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40 hover:border-soft transition-colors">
              Previous section
            </button>
            <div className="text-xs text-soft">{groupIdx + 1} of {groups.length}</div>
            {groupIdx < groups.length - 1 ? (
              <button onClick={() => goToGroup(groupIdx + 1)}
                className="rounded-lg bg-teal hover:bg-tealdeep text-paper px-4 py-2 text-sm font-semibold transition-colors">
                Next section
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

      {/* Tutor, opened from the header, for the section as a whole */}
      {showTutor && !examMode && group.questions.length > 0 && (
        <div className="fixed z-40 bottom-4 left-4 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
            <span className="text-sm font-semibold text-ink">Tutor</span>
            <button onClick={() => setShowTutor(false)} className="text-xs font-semibold text-soft hover:text-ink">
              Close
            </button>
          </div>
          <div className="p-3">
            <TutorPanel
              questionId={group.questions[0].id}
              currentAnswer={answers[group.questions[0].id] ?? ""}
            />
          </div>
        </div>
      )}

      {/* Submit confirmation */}
      {confirmSubmit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 backdrop-blur-sm p-4">
          <div className="rounded-xl bg-surface border border-line p-6 max-w-sm w-full shadow-xl fade-up">
            <h3 className="text-xl font-semibold text-ink">Submit this task?</h3>
            <p className="text-sm text-soft mt-2 leading-relaxed">
              You have answered {answered} of {questions.length} questions.
              {answered < questions.length && " Unanswered questions score zero."}
              {flagged > 0 && " You still have flagged questions."}
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
