"use client";
import { useEffect, useRef, useState } from "react";
import type { WQuestion } from "./Workspace";

const box = "w-full rounded-lg border border-line bg-paper px-4 py-3 text-sm outline-none focus:border-teal focus:ring-1 focus:ring-teal text-ink placeholder:text-soft";
const chip = "text-xs px-2.5 py-1.5 rounded-lg border border-line font-medium text-soft hover:border-soft transition-colors";

export default function AnswerInput({
  question, value, onChange, examMode,
}: {
  question: WQuestion; value: string; onChange: (v: string) => void; examMode: boolean;
}) {
  switch (question.answerFormat) {
    case "mcq": return <Mcq question={question} value={value} onChange={onChange} />;
    case "math": return <MathInput value={value} onChange={onChange} />;
    case "code": return <CodeInput value={value} onChange={onChange} />;
    case "drawing": return <DrawingInput value={value} onChange={onChange} />;
    case "table": return <TableInput value={value} onChange={onChange} />;
    case "long_text": return <LongText value={value} onChange={onChange} spellCheck={!examMode} />;
    default:
      return (
        <input className={box} value={value} placeholder="Type your answer"
          spellCheck={!examMode} onChange={(e) => onChange(e.target.value)} />
      );
  }
}

/* ---------- Multiple choice ---------- */
function Mcq({ question, value, onChange }: { question: WQuestion; value: string; onChange: (v: string) => void }) {
  const options = JSON.parse(question.options || "[]") as string[];
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Answer options">
      {options.filter((o) => o.trim()).map((opt, i) => {
        const selected = value === opt;
        return (
          <button key={i} role="radio" aria-checked={selected}
            onClick={() => onChange(selected ? "" : opt)}
            className={`w-full text-left flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
              selected
                ? "border-teal bg-tealwash text-tealdeep"
                : "border-line hover:border-teal text-ink"
            }`}>
            <span className={`grid place-items-center w-6 h-6 rounded-full border text-xs font-bold shrink-0 ${
              selected ? "bg-teal border-teal text-paper" : "border-line text-soft"
            }`}>{String.fromCharCode(65 + i)}</span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Long response with word count ---------- */
function LongText({ value, onChange, spellCheck }: { value: string; onChange: (v: string) => void; spellCheck: boolean }) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return (
    <div>
      <textarea className={`${box} min-h-44 leading-relaxed`} value={value} spellCheck={spellCheck}
        placeholder="Write your response here" onChange={(e) => onChange(e.target.value)} />
      <div className="mt-1.5 text-xs text-soft text-right">{words} word{words === 1 ? "" : "s"}</div>
    </div>
  );
}

/* ---------- Math: working area plus symbol palette ---------- */
const SYMBOLS = ["√", "π", "²", "³", "×", "÷", "±", "≤", "≥", "≠", "≈", "°", "θ", "∞", "Δ", "∑", "∫", "½", "¼", "¾"];
function MathInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function insert(sym: string) {
    const el = ref.current;
    if (!el) return onChange(value + sym);
    const start = el.selectionStart;
    const next = value.slice(0, start) + sym + value.slice(el.selectionEnd);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + sym.length, start + sym.length); });
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {SYMBOLS.map((s) => (
          <button key={s} onClick={() => insert(s)} type="button"
            className="w-8 h-8 rounded-lg border border-line bg-paper hover:border-teal text-sm text-ink transition-colors">
            {s}
          </button>
        ))}
      </div>
      <textarea ref={ref} className={`${box} min-h-32 font-mono`} value={value}
        placeholder={"Show your working, e.g.\nc² = a² + b²\nc² = 3² + 4² = 25\nc = 5 m"}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ---------- Code editor with JS run console ---------- */
function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [output, setOutput] = useState<string | null>(null);
  function run() {
    const logs: string[] = [];
    try {
      const fn = new Function("console", value);
      fn({ log: (...a: unknown[]) => logs.push(a.map((x) => typeof x === "object" ? JSON.stringify(x) : String(x)).join(" ")) });
      setOutput(logs.length ? logs.join("\n") : "(no output, use console.log)");
    } catch (e) {
      setOutput(`Error: ${(e as Error).message}`);
    }
  }
  return (
    <div>
      <textarea
        className={`${box} min-h-44 font-mono text-[13px] leading-relaxed`}
        value={value} spellCheck={false} placeholder={"// Write your code here\n// JavaScript runs with the Run button"}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            const el = e.currentTarget;
            const s = el.selectionStart;
            onChange(value.slice(0, s) + "  " + value.slice(el.selectionEnd));
            requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
          }
        }}
      />
      <div className="flex items-center gap-2 mt-2">
        <button onClick={run} className="rounded-lg bg-ink text-paper text-xs font-semibold px-3 py-1.5 hover:opacity-90">Run JavaScript</button>
        {output !== null && <button onClick={() => setOutput(null)} className="text-xs text-soft hover:text-ink">clear</button>}
      </div>
      {output !== null && (
        <pre className="mt-2 rounded-lg bg-ink text-paper text-xs p-3 overflow-x-auto whitespace-pre-wrap">{output}</pre>
      )}
    </div>
  );
}

/* ---------- Drawing canvas ---------- */
function DrawingInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState("#2e6e7e");
  const [width, setWidth] = useState(3);
  const [eraser, setEraser] = useState(false);
  const history = useRef<string[]>([]);

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    if (value.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvasRef.current!.width,
      y: ((e.clientY - r.top) / r.height) * canvasRef.current!.height,
    };
  }
  function start(e: React.PointerEvent) {
    history.current.push(canvasRef.current!.toDataURL());
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.strokeStyle = eraser ? "#ffffff" : color;
    ctx.lineWidth = eraser ? 18 : width;
    ctx.lineCap = "round";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL());
  }
  function undo() {
    const prev = history.current.pop();
    if (!prev) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0); onChange(canvasRef.current!.toDataURL()); };
    img.src = prev;
  }
  function clear() {
    history.current.push(canvasRef.current!.toDataURL());
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    onChange("");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {["#2e6e7e", "#1d2a32", "#b91c1c", "#a16207"].map((c) => (
          <button key={c} onClick={() => { setColor(c); setEraser(false); }} aria-label={`Pen colour ${c}`}
            className={`w-7 h-7 rounded-full border-2 ${color === c && !eraser ? "border-ink scale-110" : "border-transparent"}`}
            style={{ background: c }} />
        ))}
        <button onClick={() => setEraser(!eraser)}
          className={`${chip} ${eraser ? "border-teal bg-tealwash text-tealdeep" : ""}`}>
          Eraser
        </button>
        <input type="range" min={1} max={10} value={width} onChange={(e) => setWidth(+e.target.value)} className="w-20 accent-[var(--teal)]" aria-label="Pen width" />
        <button onClick={undo} className={chip}>Undo</button>
        <button onClick={clear} className={chip}>Clear</button>
      </div>
      <canvas ref={canvasRef} width={800} height={500}
        className="w-full rounded-lg border border-line bg-white touch-none cursor-crosshair"
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} />
    </div>
  );
}

/* ---------- Table editor ---------- */
function TableInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [grid, setGrid] = useState<string[][]>(() => {
    try {
      const p = JSON.parse(value);
      if (Array.isArray(p) && p.length) return p;
    } catch {}
    return [["", "", ""], ["", "", ""], ["", "", ""]];
  });
  function update(next: string[][]) {
    setGrid(next);
    onChange(JSON.stringify(next));
  }
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <tbody>
            {grid.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="border border-line p-0">
                    <input
                      className={`w-full px-2 py-2 bg-transparent outline-none focus:bg-tealwash text-ink ${r === 0 ? "font-semibold bg-paper" : ""}`}
                      value={cell} aria-label={`Cell ${r + 1},${c + 1}`}
                      onChange={(e) => update(grid.map((rw, ri) => ri === r ? rw.map((cl, ci) => (ci === c ? e.target.value : cl)) : rw))}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={() => update([...grid, grid[0].map(() => "")])} className={chip}>Add row</button>
        <button onClick={() => update(grid.map((r) => [...r, ""]))} className={chip}>Add column</button>
      </div>
    </div>
  );
}
