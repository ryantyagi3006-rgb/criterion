"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "tutor"; text: string };

// Practice-mode tutor. The server refuses this endpoint for exam-mode tasks.
export default function TutorPanel({ questionId, currentAnswer }: { questionId: string; currentAnswer: string }) {
  const [chat, setChat] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { setChat([]); }, [questionId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...chat, { role: "user", text }];
    setChat(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, answer: currentAnswer, chat: next }),
      });
      const data = await res.json();
      setChat([...next, { role: "tutor", text: res.ok ? data.reply : (data.error ?? "Tutor unavailable") }]);
    } catch {
      setChat([...next, { role: "tutor", text: "Network error. Try again." }]);
    }
    setBusy(false);
  }

  return (
    <div className="rounded-lg border border-line bg-paper flex flex-col max-h-96">
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-32">
        {chat.length === 0 && (
          <div className="text-xs text-soft space-y-1.5">
            <p className="microlabel">Ask the tutor</p>
            {["Give me a hint", "Explain the concept", "Show a similar worked example", "Check my working so far"].map((s) => (
              <button key={s} onClick={() => send(s)}
                className="block w-full text-left rounded-lg bg-surface border border-line px-2.5 py-1.5 hover:border-teal transition-colors text-ink">
                {s}
              </button>
            ))}
          </div>
        )}
        {chat.map((m, i) => (
          <div key={i} className={`text-xs rounded-lg px-3 py-2 whitespace-pre-wrap max-w-[95%] leading-relaxed ${
            m.role === "user"
              ? "ml-auto bg-teal text-paper"
              : "bg-surface text-ink border border-line"
          }`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="text-xs text-soft animate-pulse">Thinking</div>}
        <div ref={bottom} />
      </div>
      <form className="p-2 border-t border-line flex gap-1.5"
        onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask for help"
          className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-teal text-ink" />
        <button disabled={busy} className="rounded-lg bg-teal text-paper px-3 text-xs font-semibold disabled:opacity-50">Send</button>
      </form>
    </div>
  );
}
