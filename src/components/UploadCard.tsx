"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Teacher upload: task sheet in, draft digital assessment out.
export default function UploadCard({ aiAvailable }: { aiAvailable: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"EXAM" | "PRACTICE">("EXAM");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const [fileName, setFileName] = useState("");
  // Kept so a busy-server failure can be retried without picking the file again.
  const [lastFile, setLastFile] = useState<File | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    setRetryable(false);
    setFileName(file.name);
    setLastFile(file);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      const res = await fetch("/api/assessments", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        setRetryable(!!data.retryable);
        return;
      }
      router.push(`/assessment/${data.id}/edit`);
    } catch {
      setError("Could not reach the server. Check that it is still running, then try again.");
      setRetryable(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="microlabel mb-1">Start here</p>
          <h2 className="font-display text-2xl font-semibold text-ink">Upload a task sheet</h2>
        </div>
        <div className="flex rounded-lg bg-paper border border-line p-0.5 text-xs font-semibold">
          {(["EXAM", "PRACTICE"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md transition-colors ${mode === m ? "bg-surface shadow-sm text-teal" : "text-soft"}`}>
              {m === "EXAM" ? "Exam" : "Practice"}
            </button>
          ))}
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
        onClick={() => !busy && fileRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          drag ? "border-teal bg-tealwash" : "border-line hover:border-teal"
        }`}
      >
        {busy ? (
          <div className="space-y-2">
            <div className="mx-auto w-8 h-8 border-3 border-teal border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-ink">
              Reading <span className="text-teal">{fileName}</span>
            </p>
            <p className="text-xs text-soft">Extracting questions, marks and criteria, assigning tools</p>
          </div>
        ) : (
          <>
            <p className="font-display text-lg font-semibold text-ink">Drop a file here, or click to browse</p>
            <p className="text-xs text-soft mt-2">PDF, DOCX, PNG, JPG. Scans and handwriting welcome. Max 20 MB.</p>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,image/*,application/pdf"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />

      {error && (
        <div className="mt-3 rounded-lg border border-line bg-paper p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          {retryable && lastFile && (
            <button
              type="button"
              onClick={() => upload(lastFile)}
              disabled={busy}
              className="mt-2 rounded-lg bg-teal hover:bg-tealdeep text-paper text-xs font-semibold px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              Try {fileName} again
            </button>
          )}
        </div>
      )}
      {!aiAvailable && (
        <p className="mt-3 text-xs rounded-lg bg-amberwash text-amber p-3">
          No GEMINI_API_KEY set, so uploads produce a sample demo task. Add a free key
          from aistudio.google.com/apikey to .env for real parsing.
        </p>
      )}
      {mode === "PRACTICE" && (
        <p className="mt-3 text-xs text-soft">Practice mode gives students a tutor for hints and worked examples.</p>
      )}

      {/* Writing one by hand, for when there is no sheet to upload. */}
      <div className="mt-5 pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-soft">
          No task sheet? Write {mode === "PRACTICE" ? "a practice set" : "an assessment"} yourself.
        </p>
        <button
          type="button"
          disabled={busy || creating}
          onClick={async () => {
            setCreating(true);
            setError("");
            try {
              const res = await fetch("/api/assessments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode }),
              });
              const data = await res.json();
              if (!res.ok) {
                setError(data.error ?? "Could not create the assessment");
                setCreating(false);
                return;
              }
              router.push(`/assessment/${data.id}/edit`);
            } catch {
              setError("Could not reach the server.");
              setCreating(false);
            }
          }}
          className="shrink-0 rounded-lg border border-teal text-teal hover:bg-tealwash disabled:opacity-50 text-sm font-semibold px-4 py-2 transition-colors"
        >
          {creating ? "Creating" : "Start from scratch"}
        </button>
      </div>
    </div>
  );
}
